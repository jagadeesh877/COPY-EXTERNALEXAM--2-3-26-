const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAssignedAssignments = async (req, res) => {
    try {
        const staffId = req.user.id;
        const assignments = await prisma.externalMarkAssignment.findMany({
            where: { staffId },
            include: { subject: true }
        });
        res.json(assignments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAllAssignmentsForAdmin = async (req, res) => {
    try {
        const assignments = await prisma.externalMarkAssignment.findMany({
            include: {
                subject: true,
                staff: {
                    select: { fullName: true, username: true }
                }
            }
        });
        res.json(assignments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.assignMarkEntry = async (req, res) => {
    try {
        const { staffId, subjectId, deadline } = req.body;
        const assignment = await prisma.externalMarkAssignment.create({
            data: {
                staffId: parseInt(staffId),
                subjectId: parseInt(subjectId),
                deadline: new Date(deadline),
                status: 'ASSIGNED'
            }
        });
        res.json(assignment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getAllExternalStaff = async (req, res) => {
    try {
        const staff = await prisma.user.findMany({
            where: { role: 'EXTERNAL_STAFF' },
            select: { id: true, username: true, fullName: true, createdAt: true }
        });
        res.json(staff);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createExternalStaff = async (req, res) => {
    try {
        const { username, password, fullName } = req.body;
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                role: 'EXTERNAL_STAFF',
                fullName
            }
        });
        res.json({ message: 'External staff created successfully', user: { id: user.id, username: user.username, fullName: user.fullName } });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'Username already exists' });
        }
        res.status(500).json({ message: error.message });
    }
};

exports.deleteExternalStaff = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.user.delete({
            where: { id: parseInt(id) }
        });
        res.json({ message: 'Staff deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.deleteAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const assignmentId = parseInt(id);
        if (isNaN(assignmentId)) {
            return res.status(400).json({ message: "Invalid assignment ID" });
        }
        await prisma.externalMarkAssignment.delete({
            where: { id: assignmentId }
        });
        res.json({ message: 'Assignment deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
