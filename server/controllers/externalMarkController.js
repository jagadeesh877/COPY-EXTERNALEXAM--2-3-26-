const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAssignedDummyList = async (req, res) => {
    try {
        if (req.user.role !== 'EXTERNAL_STAFF') {
            return res.status(403).json({ message: "Access denied. Only external staff can enter marks." });
        }

        const staffId = req.user.id;
        const { assignmentId } = req.params;

        // 1. Verify assignment belongs to staff
        const assignment = await prisma.externalMarkAssignment.findUnique({
            where: { id: parseInt(assignmentId) },
            include: { subject: true }
        });

        if (!assignment || assignment.staffId !== staffId) {
            return res.status(403).json({ message: "Unauthorized access to this assignment" });
        }

        // 2. Fetch dummy numbers for this subject
        const mappings = await prisma.subjectDummyMapping.findMany({
            where: {
                subjectId: assignment.subjectId
            },
            select: {
                dummyNumber: true
            }
        });

        // 3. Fetch existing marks to show status
        const existingMarks = await prisma.externalMark.findMany({
            where: { subjectId: assignment.subjectId }
        });

        const marksMap = {};
        existingMarks.forEach(m => {
            marksMap[m.dummyNumber] = m.rawExternal100;
        });

        const resultList = mappings.map(m => ({
            dummyNumber: m.dummyNumber,
            mark: marksMap[m.dummyNumber] || null
        }));

        res.json({
            subject: assignment.subject.name,
            subjectId: assignment.subjectId,
            deadline: assignment.deadline,
            dummyList: resultList
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.submitMarks = async (req, res) => {
    try {
        if (req.user.role !== 'EXTERNAL_STAFF') {
            return res.status(403).json({ message: "Access denied. Only external staff can submit marks." });
        }

        const staffId = req.user.id;
        const { subjectId, marks } = req.body; // marks = [{ dummyNumber, rawMark }]

        // 1. Validation
        if (!Array.isArray(marks)) {
            return res.status(400).json({ message: "Invalid marks format" });
        }

        const subjectInt = parseInt(subjectId);

        // 2. Process each mark
        const submissions = [];
        for (const entry of marks) {
            const { dummyNumber, rawMark } = entry;

            // 🧱 LOCK ENFORCEMENT
            const mapping = await prisma.subjectDummyMapping.findUnique({
                where: { dummyNumber }
            });

            if (mapping && mapping.mappingLocked) {
                continue; // Skip locked mappings for integrity
            }

            const raw100 = parseFloat(rawMark);

            if (isNaN(raw100)) continue; // Skip invalid entries

            // 🧱 RANGE VALIDATION
            if (raw100 < 0 || raw100 > 100) {
                console.warn(`Invalid external mark: ${raw100} for dummy ${dummyNumber}`);
                continue;
            }

            const converted60 = (raw100 / 100) * 60; // Use precise float for consolidation later

            try {
                // Update or create external mark
                const submission = await prisma.externalMark.upsert({
                    where: { dummyNumber },
                    update: {
                        rawExternal100: raw100,
                        convertedExternal60: converted60,
                        submittedBy: staffId,
                        submittedAt: new Date()
                    },
                    create: {
                        subjectId: subjectInt,
                        dummyNumber,
                        rawExternal100: raw100,
                        convertedExternal60: converted60,
                        submittedBy: staffId
                    }
                });
                submissions.push(submission);
            } catch (err) {
                console.error(`Error saving mark for dummy ${dummyNumber}:`, err);
                throw new Error(`Failed to save mark for dummy ${dummyNumber}: ${err.message}`);
            }
        }

        res.json({ message: "Marks submitted successfully", count: submissions.length });
    } catch (error) {
        console.error("Submit Marks Error:", error);
        res.status(500).json({ message: error.message });
    }
};
