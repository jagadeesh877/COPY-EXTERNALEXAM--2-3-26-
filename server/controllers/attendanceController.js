const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper: Get robust department filter (matches Name OR Code)
const getDeptCriteria = async (deptString) => {
    if (!deptString) return {};
    const deptDef = await prisma.department.findFirst({
        where: { OR: [{ name: deptString }, { code: deptString }] }
    });
    if (deptDef) return { in: [deptDef.name, deptDef.code].filter(Boolean) };
    return deptString;
};

// --- Faculty Actions ---

// Get list of students for attendance (by subject & section)
const getStudentsForAttendance = async (req, res) => {
    const { subjectId, section, date } = req.query;

    console.log(`Getting students for attendance: Subject=${subjectId}, Section=${section}, Date=${date}`);

    try {
        if (!subjectId || !section) {
            return res.status(400).json({ message: 'Subject ID and Section are required' });
        }

        // 1. Get students in this section
        const subject = await prisma.subject.findUnique({ where: { id: parseInt(subjectId) } });
        if (!subject) return res.status(404).json({ message: 'Subject not found' });

        const deptCriteria = await getDeptCriteria(subject.department);

        const students = await prisma.student.findMany({
            where: {
                department: deptCriteria,
                year: Math.ceil(subject.semester / 2),
                semester: subject.semester,
                section: section
            },
            orderBy: { registerNumber: 'asc' }
        });

        // 2. Check if attendance already taken for this date & subject
        // Note: We might need period too if granular, but for now assuming 1 entry per subject/day or handled by period param
        const period = req.query.period ? parseInt(req.query.period) : 0;

        const existingAttendance = await prisma.studentAttendance.findMany({
            where: {
                subjectId: parseInt(subjectId),
                date: date,
                period: period
            }
        });

        // Map existing status if available
        const attendanceMap = {};
        existingAttendance.forEach(a => attendanceMap[a.studentId] = a.status);

        const result = students.map(s => ({
            id: s.id,
            name: s.name,
            registerNumber: s.registerNumber,
            status: attendanceMap[s.id] || 'PRESENT' // Default to Present
        }));

        res.json({
            students: result,
            isAlreadyTaken: existingAttendance.length > 0
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// Submit Attendance
const submitAttendance = async (req, res) => {
    const { subjectId, date, period, attendanceData } = req.body; // attendanceData: [{ studentId, status }]
    const facultyId = req.user.id;

    try {
        const sId = parseInt(subjectId);
        const pId = period ? parseInt(period) : 0; // Default to 0

        // Transaction for atomic update
        const operations = attendanceData.map(record => {
            return prisma.studentAttendance.upsert({
                where: {
                    studentId_subjectId_date_period: {
                        studentId: record.studentId,
                        subjectId: sId,
                        date: date,
                        period: pId
                    }
                },
                update: {
                    status: record.status,
                    facultyId: facultyId
                },
                create: {
                    studentId: record.studentId,
                    subjectId: sId,
                    date: date,
                    period: pId,
                    status: record.status,
                    facultyId: facultyId
                }
            });
        });

        await prisma.$transaction(operations);

        res.json({ message: 'Attendance submitted successfully', count: operations.length });

    } catch (error) {
        console.error('Submit Attendance Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// --- Admin/Report Actions ---

const getAttendanceReport = async (req, res) => {
    const { department, year, section, fromDate, toDate, subjectId } = req.query;

    try {
        const where = {};
        if (department) {
            where.department = await getDeptCriteria(department);
        }
        if (year) where.year = parseInt(year);
        if (section) where.section = section;

        console.log('Attendance Report Query:', JSON.stringify(where, null, 2));

        const students = await prisma.student.findMany({
            where: where,
            include: {
                attendance: {
                    where: {
                        date: { gte: fromDate, lte: toDate },
                        ...(subjectId && { subjectId: parseInt(subjectId) })
                    }
                }
            }
        });

        const report = students.map(s => {
            const total = s.attendance.length;
            const present = s.attendance.filter(a => a.status === 'PRESENT' || a.status === 'OD').length;
            const od = s.attendance.filter(a => a.status === 'OD').length;
            const absent = total - present;
            const percentage = total > 0 ? (present / total) * 100 : 0;

            return {
                id: s.id,
                registerNumber: s.registerNumber,
                name: s.name,
                totalClasses: total,
                present: present,
                od: od,
                absent: absent,
                percentage: percentage.toFixed(2)
            };
        });

        res.json(report);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


module.exports = {
    getStudentsForAttendance,
    submitAttendance,
    getAttendanceReport
};
