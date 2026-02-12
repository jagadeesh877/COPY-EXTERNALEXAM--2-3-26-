const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

// Helper to generate a unique 6-8 digit dummy number
const generateDummyNumber = async () => {
    let dummy;
    let isUnique = false;
    while (!isUnique) {
        // 🧱 SECURE RANDOM GENERATION (6-8 digits)
        dummy = crypto.randomInt(100000, 99999999).toString();
        const existing = await prisma.subjectDummyMapping.findUnique({
            where: { dummyNumber: dummy }
        });
        if (!existing) isUnique = true;
    }
    return dummy;
};

exports.generateMapping = async (req, res) => {
    try {
        const { department, semester, section, subjectId } = req.body;

        // 1. Fetch students
        const students = await prisma.student.findMany({
            where: { department, semester: parseInt(semester), section }
        });

        if (students.length === 0) {
            return res.status(404).json({ message: "No students found for given criteria" });
        }

        // 2. Fetch subject
        const subject = await prisma.subject.findUnique({
            where: { id: parseInt(subjectId) }
        });

        if (!subject) {
            return res.status(404).json({ message: "Subject not found" });
        }

        // 3. Check if mapping already exists and is locked
        const existingLocked = await prisma.subjectDummyMapping.findFirst({
            where: { subjectId: parseInt(subjectId), department, semester: parseInt(semester), section, mappingLocked: true }
        });

        if (existingLocked) {
            return res.status(400).json({ message: "Mapping is locked and cannot be regenerated" });
        }

        // 4. Generate mappings
        const results = [];
        for (const student of students) {
            // Check if mapping already exists for this student + subject
            let mapping = await prisma.subjectDummyMapping.findUnique({
                where: {
                    studentId_subjectId: {
                        studentId: student.id,
                        subjectId: subject.id
                    }
                }
            });

            if (!mapping) {
                const dummyNumber = await generateDummyNumber();
                mapping = await prisma.subjectDummyMapping.create({
                    data: {
                        studentId: student.id,
                        originalRegisterNo: student.registerNumber,
                        subjectId: subject.id,
                        subjectCode: subject.code,
                        department,
                        semester: parseInt(semester),
                        section,
                        academicYear: "2023-24", // Dynamic year can be added later
                        dummyNumber
                    }
                });
            }
            results.push(mapping);
        }

        res.json({ message: "Dummy numbers generated successfully", count: results.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getMapping = async (req, res) => {
    try {
        const { department, semester, section, subjectId } = req.query;
        // Fetch all students for this group
        const students = await prisma.student.findMany({
            where: {
                department,
                semester: parseInt(semester),
                section
            },
            include: {
                dummyMappings: {
                    where: {
                        subjectId: parseInt(subjectId)
                    }
                }
            },
            orderBy: {
                name: 'asc'
            }
        });

        // Transform into a flat structure that the frontend expects
        const results = students.map(student => {
            const mapping = student.dummyMappings[0] || null;
            return {
                id: mapping?.id || `temp-${student.id}`,
                studentId: student.id,
                student: { name: student.name },
                originalRegisterNo: student.registerNumber,
                dummyNumber: mapping?.dummyNumber || 'Not Generated',
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
        const { department, semester, section, subjectId } = req.body;
        await prisma.subjectDummyMapping.updateMany({
            where: {
                department,
                semester: parseInt(semester),
                section,
                subjectId: parseInt(subjectId)
            },
            data: { mappingLocked: true }
        });
        res.json({ message: "Mapping locked successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
