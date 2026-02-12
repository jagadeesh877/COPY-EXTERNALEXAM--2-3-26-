const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');

const prisma = new PrismaClient();

// Helper: Get robust department filter (matches Name OR Code)
const getDeptCriteria = async (deptString) => {
    if (!deptString) {
        return {
            OR: [
                { department: null },
                { department: '' },
                { department: 'First Year (General)' },
                { department: 'GEN' }
            ]
        };
    }

    const trimmed = deptString.trim();
    if (trimmed === 'GEN' || trimmed === 'First Year (General)') {
        return {
            OR: [
                { department: 'First Year (General)' },
                { department: 'GEN' },
                { department: null },
                { department: '' }
            ]
        };
    }

    const deptDef = await prisma.department.findFirst({
        where: { OR: [{ name: trimmed }, { code: trimmed }] }
    });

    if (deptDef) {
        const criteria = [deptDef.name, deptDef.code].filter(Boolean).map(s => s.trim());
        return { department: { in: criteria } };
    }

    return { department: trimmed };
};

// Get subjects assigned to the logged-in faculty
const getAssignedSubjects = async (req, res) => {
    const facultyId = req.user.id;
    try {
        const assignments = await prisma.facultyAssignment.findMany({
            where: { facultyId },
            include: {
                subject: true,
            }
        });

        const enhancedAssignments = await Promise.all(assignments.map(async (assignment) => {
            // Count students
            const deptCriteria = await getDeptCriteria(assignment.subject.department);

            const studentCount = await prisma.student.count({
                where: {
                    ...deptCriteria,
                    semester: assignment.subject.semester,
                    section: assignment.section
                }
            });

            // Calculate Avg Marks
            const students = await prisma.student.findMany({
                where: {
                    ...deptCriteria,
                    semester: assignment.subject.semester,
                    section: assignment.section
                },
                include: {
                    marks: { where: { subjectId: assignment.subject.id } }
                }
            });

            const marksData = students
                .map(s => s.marks[0]?.internal)
                .filter(m => m != null);

            const avgMarks = marksData.length > 0
                ? Math.round(marksData.reduce((a, b) => a + b, 0) / marksData.length)
                : 0;

            // Count Weekly Classes
            const weeklyClasses = await prisma.timetable.count({
                where: {
                    facultyId,
                    subjectId: assignment.subject.id,
                }
            });

            return {
                ...assignment,
                studentCount,
                avgMarks,
                weeklyClasses: weeklyClasses || 2
            };
        }));

        res.json(enhancedAssignments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getClassDetails = async (req, res) => {
    const { subjectId } = req.params;
    const facultyId = req.user.id;
    try {
        const assignment = await prisma.facultyAssignment.findFirst({
            where: { subjectId: parseInt(subjectId), facultyId },
            include: { subject: true }
        });

        if (!assignment) return res.status(403).json({ message: 'Not authorized for this class' });

        const deptCriteria = await getDeptCriteria(assignment.subject.department);

        const studentCount = await prisma.student.count({
            where: {
                ...deptCriteria,
                semester: assignment.subject.semester,
                section: assignment.section
            }
        });

        const attendanceRecords = await prisma.studentAttendance.groupBy({
            by: ['date', 'period'],
            where: {
                subjectId: parseInt(subjectId)
            }
        });
        const classesCompleted = attendanceRecords.length;

        const timetableEntries = await prisma.timetable.findMany({
            where: {
                facultyId,
                subjectId: parseInt(subjectId)
            }
        });

        const weeklyHours = timetableEntries.reduce((sum, entry) => sum + (entry.duration || 1), 0);
        const totalWeeks = 15;
        const totalEstimatedClasses = (weeklyHours * totalWeeks) || 45;

        const percentage = Math.min(Math.round((classesCompleted / totalEstimatedClasses) * 100), 100);

        res.json({
            ...assignment,
            studentCount,
            syllabusCompletion: percentage,
            classesCompleted,
            totalEstimatedClasses
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getClassStudents = async (req, res) => {
    const { subjectId } = req.params;
    const facultyId = req.user.id;
    try {
        const assignment = await prisma.facultyAssignment.findFirst({
            where: { subjectId: parseInt(subjectId), facultyId },
            include: { subject: true }
        });

        if (!assignment) return res.status(403).json({ message: 'Not authorized' });

        const deptCriteria = await getDeptCriteria(assignment.subject.department);

        const students = await prisma.student.findMany({
            where: {
                ...deptCriteria,
                semester: assignment.subject.semester,
                section: assignment.section
            },
            include: {
                marks: { where: { subjectId: parseInt(subjectId) } },
                attendance: { where: { subjectId: parseInt(subjectId) } }
            },
            orderBy: { registerNumber: 'asc' }
        });

        const data = students.map(s => {
            const totalClasses = 40;
            const presentCount = s.attendance.filter(a => a.status === 'PRESENT' || a.status === 'OD').length;
            const percentage = Math.round((presentCount / totalClasses) * 100);
            const mark = s.marks[0];

            return {
                id: s.id,
                registerNumber: s.registerNumber,
                name: s.name,
                attendancePercentage: percentage > 100 ? 100 : percentage,
                ciaTotal: mark?.internal || 0,
                status: percentage >= 75 ? 'Eligible' : 'Shortage'
            };
        });

        res.json(data);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getClassAttendance = async (req, res) => {
    const { subjectId } = req.params;
    try {
        const attendance = await prisma.studentAttendance.findMany({
            where: { subjectId: parseInt(subjectId) },
            orderBy: { date: 'desc' }
        });

        const grouped = {};
        attendance.forEach(r => {
            if (!grouped[r.date]) grouped[r.date] = { date: r.date, present: 0, absent: 0, total: 0 };
            grouped[r.date].total++;
            if (r.status === 'PRESENT' || r.status === 'OD') grouped[r.date].present++;
            else grouped[r.date].absent++;
        });

        const result = Object.values(grouped).map(d => ({
            ...d,
            percentage: Math.round((d.present / d.total) * 100)
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getSubjectMarks = async (req, res) => {
    const { subjectId } = req.params;
    try {
        const subject = await prisma.subject.findUnique({ where: { id: parseInt(subjectId) } });
        if (!subject) return res.status(404).json({ message: 'Subject not found' });

        const assignment = await prisma.facultyAssignment.findFirst({
            where: {
                subjectId: parseInt(subjectId),
                facultyId: req.user.id
            }
        });

        if (!assignment) {
            return res.status(403).json({ message: 'You are not assigned to this subject.' });
        }

        const deptCriteria = await getDeptCriteria(subject.department);

        const students = await prisma.student.findMany({
            where: {
                ...deptCriteria,
                semester: subject.semester,
                section: assignment.section
            },
            include: {
                marks: {
                    where: { subjectId: parseInt(subjectId) }
                }
            }
        });

        const result = students.map(s => ({
            studentId: s.id,
            registerNumber: s.registerNumber,
            name: s.name,
            marks: s.marks[0] || {}
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateMarks = async (req, res) => {
    const { studentId, subjectId } = req.body;
    try {
        const currentMark = await prisma.marks.findUnique({
            where: { studentId_subjectId: { studentId: parseInt(studentId), subjectId: parseInt(subjectId) } }
        });

        const cia1Fields = ['cia1_test', 'cia1_assignment', 'cia1_attendance'];
        const cia2Fields = ['cia2_test', 'cia2_assignment', 'cia2_attendance'];
        const cia3Fields = ['cia3_test', 'cia3_assignment', 'cia3_attendance'];

        const updates = req.body;
        const keys = Object.keys(updates);

        const touchingCia1 = keys.some(k => cia1Fields.includes(k));
        const touchingCia2 = keys.some(k => cia2Fields.includes(k));
        const touchingCia3 = keys.some(k => cia3Fields.includes(k));

        // 🧱 FIX LOCK ENFORCEMENT (CRITICAL)
        // 1. Check Semester-level lock
        const student = await prisma.student.findUnique({ where: { id: parseInt(studentId) } });
        const semControl = await prisma.semesterControl.findFirst({
            where: {
                department: student.department || 'GEN',
                year: student.year,
                semester: student.semester,
                section: student.section
            }
        });

        if (semControl && semControl.isLocked) {
            return res.status(403).json({ message: 'Academic integrity rule: Semester is permanently locked by Administrator.' });
        }

        if (currentMark) {
            if (touchingCia1 && currentMark.isLocked_cia1) return res.status(403).json({ message: 'CIA 1 marks are locked.' });
            if (touchingCia2 && currentMark.isLocked_cia2) return res.status(403).json({ message: 'CIA 2 marks are locked.' });
            if (touchingCia3 && currentMark.isLocked_cia3) return res.status(403).json({ message: 'CIA 3 marks are locked.' });
            if (currentMark.isLocked && (touchingCia1 || touchingCia2 || touchingCia3)) return res.status(403).json({ message: 'Marks are globally locked.' });
        }

        const fieldsToUpdate = {};
        const allowedFields = [...cia1Fields, ...cia2Fields, ...cia3Fields];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                const val = req.body[field] === '' ? null : parseFloat(req.body[field]);
                // 🧱 RANGE VALIDATION
                if (val !== null && (val < 0 || val > 100)) {
                    throw new Error(`Invalid mark value for ${field}: ${val}. Must be between 0 and 100.`);
                }
                fieldsToUpdate[field] = val;
            }
        });

        const merged = { ...currentMark, ...fieldsToUpdate };
        const calculateCIAlo = (test, assign, att) => (test || 0) + (assign || 0) + (att || 0);

        const cia1Total = calculateCIAlo(merged.cia1_test, merged.cia1_assignment, merged.cia1_attendance);
        const cia2Total = calculateCIAlo(merged.cia2_test, merged.cia2_assignment, merged.cia2_attendance);
        const cia3Total = calculateCIAlo(merged.cia3_test, merged.cia3_assignment, merged.cia3_attendance);

        const totals = [cia1Total, cia2Total, cia3Total].sort((a, b) => b - a);
        fieldsToUpdate.internal = (totals[0] + totals[1]) / 2;

        if (touchingCia1) fieldsToUpdate.isApproved_cia1 = false;
        if (touchingCia2) fieldsToUpdate.isApproved_cia2 = false;
        if (touchingCia3) fieldsToUpdate.isApproved_cia3 = false;

        const marks = await prisma.marks.upsert({
            where: { studentId_subjectId: { studentId: parseInt(studentId), subjectId: parseInt(subjectId) } },
            update: fieldsToUpdate,
            create: {
                studentId: parseInt(studentId),
                subjectId: parseInt(subjectId),
                isApproved_cia1: false,
                isApproved_cia2: false,
                isApproved_cia3: false,
                ...fieldsToUpdate
            }
        });

        res.json(marks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getFacultyDashboardStats = async (req, res) => {
    try {
        const facultyId = req.user.id;
        const assignments = await prisma.facultyAssignment.findMany({
            where: { facultyId },
            include: { subject: true }
        });

        const assignedSubjects = assignments.length;
        let totalStudents = 0;
        const classPerformance = [];

        for (const assignment of assignments) {
            const deptCriteria = await getDeptCriteria(assignment.subject.department);

            const students = await prisma.student.findMany({
                where: {
                    ...deptCriteria,
                    semester: assignment.subject.semester,
                    section: assignment.section
                },
                include: {
                    marks: { where: { subjectId: assignment.subject.id } }
                }
            });

            totalStudents += students.length;
            const marksData = students.map(s => s.marks[0]?.internal).filter(m => m != null);
            const avgMarks = marksData.length > 0 ? Math.round(marksData.reduce((a, b) => a + b, 0) / marksData.length) : 0;

            classPerformance.push({
                subject: assignment.subject.shortName || assignment.subject.name,
                average: avgMarks,
                students: students.length
            });
        }

        const timetable = await prisma.timetable.findMany({ where: { facultyId } });
        const classesThisWeek = timetable.length;

        let allMarks = [];
        for (const assignment of assignments) {
            const marks = await prisma.marks.findMany({
                where: { subjectId: assignment.subject.id, internal: { not: null } },
                select: { internal: true }
            });
            allMarks = [...allMarks, ...marks.map(m => m.internal)];
        }

        const avgPerformance = allMarks.length > 0 ? (allMarks.reduce((a, b) => a + b, 0) / allMarks.length).toFixed(1) : 0;

        let totalMarksEntries = 0;
        let submittedMarksEntries = 0;

        for (const assignment of assignments) {
            const deptCriteriaStats = await getDeptCriteria(assignment.subject.department);
            const studentsCount = await prisma.student.count({
                where: {
                    ...deptCriteriaStats,
                    semester: assignment.subject.semester,
                    section: assignment.section
                }
            });
            const marksCount = await prisma.marks.count({
                where: { subjectId: assignment.subject.id, internal: { not: null } }
            });
            totalMarksEntries += studentsCount;
            submittedMarksEntries += marksCount;
        }

        const submissionPercentage = totalMarksEntries > 0 ? Math.round((submittedMarksEntries / totalMarksEntries) * 100) : 0;

        res.json({
            assignedSubjects,
            totalStudents,
            classesThisWeek,
            avgPerformance,
            classPerformance,
            marksSubmissionStatus: [
                { name: 'Submitted', value: submissionPercentage, color: '#10b981' },
                { name: 'Pending', value: 100 - submissionPercentage, color: '#f59e0b' }
            ],
            attendanceTrend: [
                { week: 'Week 1', rate: 88 }, { week: 'Week 2', rate: 92 },
                { week: 'Week 3', rate: 85 }, { week: 'Week 4', rate: 90 },
                { week: 'Week 5', rate: 87 }
            ]
        });
    } catch (error) {
        console.error('Faculty dashboard stats error:', error);
        res.status(500).json({ message: error.message });
    }
};

const getMyTimetable = async (req, res) => {
    try {
        const facultyId = parseInt(req.user.id);
        const { date } = req.query;
        let timetable = await prisma.timetable.findMany({ where: { facultyId } });

        if (date) {
            const dateObj = new Date(date);
            const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
            const dayOfWeek = days[dateObj.getUTCDay()];

            const myAbsences = await prisma.facultyAbsence.findMany({ where: { facultyId, date } });
            const isFullDayAbsent = myAbsences.some(a => a.period === 0);
            const mySubstitutedSlots = await prisma.substitution.findMany({
                where: { date, timetable: { facultyId } },
                include: { substituteFaculty: true }
            });

            timetable = timetable.map(t => {
                if (t.day !== dayOfWeek) return t;
                const specificAbsence = myAbsences.find(a => a.period === t.period);
                const sub = mySubstitutedSlots.find(s => s.timetableId === t.id);
                if (isFullDayAbsent || specificAbsence) {
                    return { ...t, isCovered: true, coveredBy: sub ? sub.substituteFaculty.fullName : 'Faculty Absent' };
                }
                return t;
            });

            const substitutions = await prisma.substitution.findMany({
                where: { substituteFacultyId: facultyId, date },
                include: { timetable: true }
            });

            if (substitutions.length > 0) {
                const subEntries = substitutions.map(sub => ({
                    id: `sub-${sub.id}`,
                    ...sub.timetable,
                    day: dayOfWeek,
                    isSubstitute: true,
                    originalFaculty: sub.timetable.facultyName
                }));
                timetable = [...timetable, ...subEntries];
            }
        }
        res.json(timetable);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const exportClassAttendanceExcel = async (req, res) => {
    const { subjectId } = req.params;
    const facultyId = req.user.id;
    try {
        const assignment = await prisma.facultyAssignment.findFirst({
            where: { subjectId: parseInt(subjectId), facultyId },
            include: { subject: true }
        });
        if (!assignment) return res.status(403).json({ message: 'Not authorized' });

        const deptCriteria = await getDeptCriteria(assignment.subject.department);
        const students = await prisma.student.findMany({
            where: { ...deptCriteria, semester: assignment.subject.semester, section: assignment.section },
            include: { attendance: { where: { subjectId: parseInt(subjectId) } } },
            orderBy: { registerNumber: 'asc' }
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Attendance Report');
        worksheet.columns = [
            { header: 'Reg No', key: 'regNo', width: 15 },
            { header: 'Student Name', key: 'name', width: 25 },
            { header: 'Attendance %', key: 'percentage', width: 15 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        students.forEach(s => {
            const total = s.attendance.length;
            const present = s.attendance.filter(a => a.status === 'PRESENT' || a.status === 'OD').length;
            const percentage = total > 0 ? ((present / total) * 100).toFixed(2) : '0.00';
            worksheet.addRow({
                regNo: s.registerNumber,
                name: s.name,
                percentage,
                status: parseFloat(percentage) >= 75 ? 'Eligible' : 'Shortage'
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Attendance_${subjectId}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAssignedSubjects, getSubjectMarks, updateMarks, getFacultyDashboardStats,
    getMyTimetable, getClassDetails, getClassStudents, getClassAttendance, exportClassAttendanceExcel
};
