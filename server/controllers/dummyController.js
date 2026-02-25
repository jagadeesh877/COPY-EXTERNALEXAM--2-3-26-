const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.generateMapping = async (req, res) => {
    try {
        const { department, semester, subjectId, startingDummy, boardCode, qpCode, absentStudentIds = [] } = req.body;

        const deptRecord = await prisma.department.findFirst({
            where: { OR: [{ code: department }, { name: department }] }
        });
        const deptCode = deptRecord ? (deptRecord.code || deptRecord.name) : department;

        // 1. Fetch students (sorted by registerNumber ASC)
        const students = await prisma.student.findMany({
            where: { department: deptCode, semester: parseInt(semester) },
            orderBy: { registerNumber: 'asc' }
        });

        if (students.length === 0) {
            return res.status(404).json({ message: "No students found for given criteria" });
        }

        // 2. Fetch subject
        const subject = await prisma.subject.findUnique({
            where: { id: parseInt(subjectId) }
        });

        if (!subject) return res.status(404).json({ message: "Subject not found" });

        // 3. Check if mapping already exists and is locked
        const existingLocked = await prisma.subjectDummyMapping.findFirst({
            where: { subjectId: parseInt(subjectId), department, semester: parseInt(semester), mappingLocked: true }
        });

        if (existingLocked) {
            return res.status(400).json({ message: "Mapping is locked and cannot be regenerated" });
        }

        // 4. Generate mappings
        let currentDummy = parseInt(startingDummy);
        const results = [];

        // We will process this inside a transaction to ensure clean state
        await prisma.$transaction(async (tx) => {
            // Remove previous unlocked mappings for this group to start fresh
            await tx.subjectDummyMapping.deleteMany({
                where: { subjectId: parseInt(subjectId), department, semester: parseInt(semester), mappingLocked: false }
            });

            for (const student of students) {
                const isAbsent = absentStudentIds.includes(student.id);
                let dummyNumber = null;

                if (!isAbsent) {
                    dummyNumber = currentDummy.toString();
                    currentDummy++;
                }

                const mapping = await tx.subjectDummyMapping.create({
                    data: {
                        studentId: student.id,
                        originalRegisterNo: student.registerNumber || student.rollNo,
                        subjectId: subject.id,
                        subjectCode: subject.code,
                        department,
                        semester: parseInt(semester),
                        section: student.section || 'A',
                        academicYear: "2023-24", // Dynamic year can be added later
                        dummyNumber,
                        isAbsent,
                        boardCode: boardCode || null,
                        qpCode: qpCode || null
                    }
                });
                results.push(mapping);
            }
        });

        res.json({ message: "Dummy numbers generated successfully", count: results.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getMapping = async (req, res) => {
    try {
        const { department, semester, subjectId } = req.query;

        const deptRecord = await prisma.department.findFirst({
            where: { OR: [{ code: department }, { name: department }] }
        });
        const deptCode = deptRecord ? (deptRecord.code || deptRecord.name) : department;

        // Fetch all students for this group
        const students = await prisma.student.findMany({
            where: {
                department: deptCode,
                semester: parseInt(semester)
            },
            include: {
                dummyMappings: {
                    where: { subjectId: parseInt(subjectId) }
                }
            },
            orderBy: { registerNumber: 'asc' }
        });

        const results = students.map(student => {
            const mapping = student.dummyMappings[0] || null;
            return {
                id: mapping?.id || `temp-${student.id}`,
                studentId: student.id,
                student: { name: student.name },
                originalRegisterNo: student.registerNumber || student.rollNo,
                dummyNumber: mapping?.dummyNumber || null,
                isAbsent: mapping?.isAbsent || false,
                boardCode: mapping?.boardCode || '',
                qpCode: mapping?.qpCode || '',
                marks: mapping?.marks || null,
                mappingLocked: mapping?.mappingLocked || false,
                isTemp: !mapping
            };
        });

        res.json(results);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.lockMapping = async (req, res) => {
    try {
        const { department, semester, subjectId } = req.body;
        await prisma.subjectDummyMapping.updateMany({
            where: {
                department,
                semester: parseInt(semester),
                subjectId: parseInt(subjectId)
            },
            data: { mappingLocked: true }
        });
        res.json({ message: "Mapping locked successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.unlockMapping = async (req, res) => {
    try {
        const { department, semester, subjectId } = req.body;
        await prisma.subjectDummyMapping.updateMany({
            where: {
                department,
                semester: parseInt(semester),
                subjectId: parseInt(subjectId)
            },
            data: { mappingLocked: false }
        });
        res.json({ message: "Mapping unlocked successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.saveMarks = async (req, res) => {
    // Basic fallback for marks entry if done via admin module
    try {
        const { mappings } = req.body; // Array of { id, marks }
        await prisma.$transaction(
            mappings.map(m => prisma.subjectDummyMapping.update({
                where: { id: parseInt(m.id) },
                data: { marks: parseFloat(m.marks) }
            }))
        );
        res.json({ message: "Marks saved successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
