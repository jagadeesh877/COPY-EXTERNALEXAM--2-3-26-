const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getDeptCriteria } = require('../utils/deptUtils');

// --- Faculty Actions ---

// Get list of students for attendance (by subject & section)
const getStudentsForAttendance = async (req, res) => {
    const { subjectId, section, date } = req.query;
    try {
        const facultyId = parseInt(req.user.id);
        // Try to find the specific assignment for this faculty to get the correct department(s)
        const assignment = await prisma.facultyAssignment.findFirst({
            where: { facultyId, subjectId: parseInt(subjectId), section }
        });

        const subject = await prisma.subject.findUnique({ where: { id: parseInt(subjectId) } });
        if (!subject) return res.status(404).json({ message: 'Subject not found' });

        // Use assignment department if available (handles MECH, CIVIL etc), fallback to subject department
        const deptCriteria = await getDeptCriteria(assignment?.department || subject.department);

        const students = await prisma.student.findMany({
            where: {
                ...deptCriteria,
                semester: subject.semester,
                section: section
            },
            orderBy: { rollNo: 'asc' }
        });

        const period = req.query.period ? parseInt(req.query.period) : 0;
        const existingAttendance = await prisma.studentAttendance.findMany({
            where: { subjectId: parseInt(subjectId), date: date, period: period }
        });

        const attendanceMap = {};
        existingAttendance.forEach(a => attendanceMap[a.studentId] = a.status);

        const result = students.map(s => ({
            id: s.id,
            rollNo: s.rollNo, // Added Roll No
            name: s.name,
            registerNumber: s.registerNumber,
            status: attendanceMap[s.id] || 'PRESENT'
        }));

        res.json({ students: result, isAlreadyTaken: existingAttendance.length > 0 });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Submit Attendance
const submitAttendance = async (req, res) => {
    const { subjectId, date, period, attendanceData } = req.body;
    const facultyId = req.user.id;
    try {
        const sId = parseInt(subjectId);
        const pId = period ? parseInt(period) : 0;

        const operations = attendanceData.map(record => {
            return prisma.studentAttendance.upsert({
                where: { studentId_subjectId_date_period: { studentId: record.studentId, subjectId: sId, date: date, period: pId } },
                update: { status: record.status, facultyId: facultyId },
                create: { studentId: record.studentId, subjectId: sId, date: date, period: pId, status: record.status, facultyId: facultyId }
            });
        });

        await prisma.$transaction(operations);
        res.json({ message: 'Attendance submitted successfully', count: operations.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- Admin/Report Actions ---

const getAttendanceReport = async (req, res) => {
    const { department, year, section, fromDate, toDate, subjectId } = req.query;
    try {
        const where = {};

        // If subjectId is provided but no other criteria, get department/semester/section from assignment
        if (subjectId && !department && !year && !section) {
            // Priority: Try to find assignment for the LOGGED-IN faculty first
            let assignment = null;
            if (req.user.role === 'FACULTY' || req.user.role === 'EXTERNAL_STAFF') {
                assignment = await prisma.facultyAssignment.findFirst({
                    where: { subjectId: parseInt(subjectId), facultyId: parseInt(req.user.id) },
                    include: { subject: true }
                });
            }

            // Fallback: If not found or user is Admin, get any assignment for that subject
            if (!assignment) {
                assignment = await prisma.facultyAssignment.findFirst({
                    where: { subjectId: parseInt(subjectId) },
                    include: { subject: true }
                });
            }

            if (assignment) {
                const deptFilter = await getDeptCriteria(assignment.department || assignment.subject.department);
                Object.assign(where, deptFilter);
                where.semester = assignment.subject.semester;
                where.section = assignment.section;
            }
        } else {
            // Broaden search for Year 1 (GEN) students
            if (department || String(year) === '1') {
                const searchDept = String(year) === '1' ? 'GEN' : department;
                const deptFilter = await getDeptCriteria(searchDept);
                Object.assign(where, deptFilter);
            }
            if (year) where.year = parseInt(year);
            if (section) where.section = section;
        }

        const students = await prisma.student.findMany({
            where: { ...where },
            include: {
                attendance: {
                    where: {
                        date: { gte: fromDate, lte: toDate },
                        ...(subjectId && { subjectId: parseInt(subjectId) })
                    }
                }
            },
            orderBy: { rollNo: 'asc' }
        });

        const report = students.map(s => {
            const total = s.attendance.length;
            const present = s.attendance.filter(a => a.status === 'PRESENT' || a.status === 'OD').length;
            const od = s.attendance.filter(a => a.status === 'OD').length;
            const absent = total - present;
            const percentage = total > 0 ? ((present / total) * 100).toFixed(2) : '0.00';

            return {
                id: s.id,
                rollNo: s.rollNo,
                registerNumber: s.registerNumber,
                name: s.name,
                totalClasses: total,
                present,
                od,
                absent,
                percentage
            };
        });

        let distinctSlots = [];
        if (subjectId) {
            distinctSlots = await prisma.studentAttendance.groupBy({
                by: ['date', 'period'],
                where: {
                    subjectId: parseInt(subjectId),
                    date: { gte: fromDate, lte: toDate }
                }
            });
        }

        res.json({
            students: report,
            totalPeriodsConducted: distinctSlots.length
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getStudentsForAttendance,
    submitAttendance,
    getAttendanceReport
};
