const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');

const prisma = new PrismaClient();

// --- Faculty Management ---

const getAllFaculty = async (req, res) => {
    try {
        const faculty = await prisma.user.findMany({
            where: { role: 'FACULTY' },
            select: { id: true, username: true, fullName: true, department: true, createdAt: true }
        });
        res.json(faculty);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const createFaculty = async (req, res) => {
    const { username, password, fullName, department } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newFaculty = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                role: 'FACULTY',
                fullName,
                department
            }
        });
        res.status(201).json({ message: 'Faculty created', faculty: { username, fullName } });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'A faculty with this username already exists.' });
        }
        res.status(400).json({ message: 'Error creating faculty', error: error.message });
    }
};

const deleteFaculty = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.user.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Faculty deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- Marks Approval System ---

// Get all pending marks for approval (grouped by subject)
const getPendingMarks = async (req, res) => {
    console.log('getPendingMarks called');
    try {
        // First, get all marks that are not approved
        const unapprovedMarks = await prisma.marks.findMany({
            where: {
                isApproved: false
            },
            include: {
                student: {
                    select: { id: true, name: true, registerNumber: true, department: true, year: true }
                },
                subject: {
                    select: { id: true, code: true, name: true, department: true, semester: true }
                }
            }
        });

        console.log('Unapproved marks found:', unapprovedMarks.length);

        // Group by subject
        const subjectMap = {};
        unapprovedMarks.forEach(mark => {
            const subjectId = mark.subject.id;
            if (!subjectMap[subjectId]) {
                subjectMap[subjectId] = {
                    subjectId: mark.subject.id,
                    subjectCode: mark.subject.code,
                    subjectName: mark.subject.name,
                    department: mark.subject.department,
                    semester: mark.subject.semester,
                    faculty: '', // Will be filled later
                    pendingCount: 0,
                    students: []
                };
            }
            subjectMap[subjectId].pendingCount++;
            subjectMap[subjectId].students.push({
                studentId: mark.student.id,
                name: mark.student.name,
                registerNumber: mark.student.registerNumber,
                department: mark.student.department,
                year: mark.student.year
            });
        });

        // Get faculty assignments for these subjects
        const subjectIds = Object.keys(subjectMap).map(id => parseInt(id));
        if (subjectIds.length > 0) {
            const assignments = await prisma.facultyAssignment.findMany({
                where: {
                    subjectId: { in: subjectIds }
                }
            });

            // Fetched assignments, now fetch faculty names manually
            if (assignments.length > 0) {
                const facultyIds = [...new Set(assignments.map(a => a.facultyId))];
                const facultyUsers = await prisma.user.findMany({
                    where: { id: { in: facultyIds } },
                    select: { id: true, fullName: true }
                });

                const facultyMap = {};
                facultyUsers.forEach(f => facultyMap[f.id] = f.fullName);

                assignments.forEach(assignment => {
                    if (subjectMap[assignment.subjectId]) {
                        const facultyName = facultyMap[assignment.facultyId];
                        if (facultyName) {
                            const currentFaculty = subjectMap[assignment.subjectId].faculty;
                            subjectMap[assignment.subjectId].faculty = currentFaculty
                                ? `${currentFaculty}, ${facultyName}`
                                : facultyName;
                        }
                    }
                });
            }
        }

        const pending = Object.values(subjectMap);

        console.log('Pending subjects to return:', pending.length);
        console.log('Pending data:', JSON.stringify(pending, null, 2));

        res.json(pending);
    } catch (error) {
        console.error('Error in getPendingMarks:', error);
        res.status(500).json({ message: error.message });
    }
};

// Get marks for a specific subject for approval
const getMarksForApproval = async (req, res) => {
    const { subjectId } = req.params;

    try {
        const marks = await prisma.marks.findMany({
            where: {
                subjectId: parseInt(subjectId)
            },
            include: {
                student: {
                    select: {
                        id: true,
                        name: true,
                        registerNumber: true,
                        department: true,
                        year: true,
                        section: true
                    }
                },
                subject: {
                    select: {
                        id: true,
                        code: true,
                        name: true
                    }
                },
                approver: {
                    select: {
                        id: true,
                        fullName: true
                    }
                }
            },
            orderBy: {
                student: {
                    registerNumber: 'asc'
                }
            }
        });

        res.json(marks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Approve marks for specific students
// Old approveMarks removed. Granular version defined above.

// Approve all marks for a subject
const approveAllMarks = async (req, res) => {
    const { subjectId, lock } = req.body;
    const adminId = req.user.id;

    try {
        const updateData = {
            // isApproved: true, // Old deprecated field
            isApproved_cia1: true,
            isApproved_cia2: true,
            isApproved_cia3: true,
            approvedBy: adminId,
            approvedAt: new Date()
        };

        if (lock) {
            // updateData.isLocked = true; // Old deprecated field
            updateData.isLocked_cia1 = true;
            updateData.isLocked_cia2 = true;
            updateData.isLocked_cia3 = true;
        }

        const result = await prisma.marks.updateMany({
            where: {
                subjectId: parseInt(subjectId),
                // isApproved: false // Check if any part is unapproved? 
                // For "Approve All", we just overwrite everything for that subject.
            },
            data: updateData
        });

        res.json({
            message: `Approved all marks for subject${lock ? ' and locked' : ''}`,
            count: result.count
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Reject marks (set back to unapproved)
// Old unapproveMarks and unlockMarks removed. Granular versions are defined below.

const getAllSubjectMarksStatus = async (req, res) => {
    try {
        // Fetch all marks grouped by subject
        const allMarks = await prisma.marks.findMany({
            include: {
                subject: {
                    select: { id: true, code: true, name: true, department: true, semester: true }
                },
                student: {
                    select: { id: true }
                }
            }
        });

        // Group and Aggregate
        const subjectMap = {};

        allMarks.forEach(mark => {
            const sId = mark.subject.id;
            if (!subjectMap[sId]) {
                subjectMap[sId] = {
                    subjectId: sId,
                    subjectCode: mark.subject.code,
                    subjectName: mark.subject.name,
                    department: mark.subject.department,
                    semester: mark.subject.semester,
                    total: 0,

                    // Granular Counts
                    pending_cia1: 0,
                    approved_cia1: 0,
                    locked_cia1: 0,

                    pending_cia2: 0,
                    approved_cia2: 0,
                    locked_cia2: 0,

                    pending_cia3: 0,
                    approved_cia3: 0,
                    locked_cia3: 0,

                    faculty: 'Loading...'
                };
            }
            const s = subjectMap[sId];
            s.total++;

            // Helper to count status
            const incrementStatus = (locked, approved, type) => {
                if (locked) s[`locked_${type}`]++;
                else if (approved) s[`approved_${type}`]++;
                else s[`pending_${type}`]++;
            };

            incrementStatus(mark.isLocked_cia1, mark.isApproved_cia1, 'cia1');
            incrementStatus(mark.isLocked_cia2, mark.isApproved_cia2, 'cia2');
            incrementStatus(mark.isLocked_cia3, mark.isApproved_cia3, 'cia3');
        });

        const result = Object.values(subjectMap);

        // Populate Faculty (Optional: can be heavy, but useful)
        // Let's do a quick optimized fetch for assignments
        const subjectIds = result.map(r => r.subjectId);
        if (subjectIds.length > 0) {
            const assignments = await prisma.facultyAssignment.findMany({
                where: { subjectId: { in: subjectIds } }
            });

            // Fetch faculty names manually
            if (assignments.length > 0) {
                const facultyIds = [...new Set(assignments.map(a => a.facultyId))];
                const facultyUsers = await prisma.user.findMany({
                    where: { id: { in: facultyIds } },
                    select: { id: true, fullName: true }
                });

                const facultyMap = {};
                facultyUsers.forEach(f => facultyMap[f.id] = f.fullName);

                const assignMap = {};
                assignments.forEach(a => {
                    if (!assignMap[a.subjectId]) assignMap[a.subjectId] = [];
                    const name = facultyMap[a.facultyId];
                    if (name) assignMap[a.subjectId].push(name);
                });

                result.forEach(r => {
                    r.faculty = assignMap[r.subjectId]?.join(', ') || 'Unassigned';
                });
            } else {
                result.forEach(r => { r.faculty = 'Unassigned'; });
            }
        } else {
            result.forEach(r => { r.faculty = 'Unassigned'; });
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- Marks Granular Management ---

const unlockMarks = async (req, res) => {
    const { subjectId, studentIds, exam } = req.body; // exam: 'cia1', 'cia2', 'cia3', or 'all'
    try {
        const updateData = {};
        if (exam === 'cia1' || exam === 'all') updateData.isLocked_cia1 = false;
        if (exam === 'cia2' || exam === 'all') updateData.isLocked_cia2 = false;
        if (exam === 'cia3' || exam === 'all') updateData.isLocked_cia3 = false;

        // Backwards compatibility
        if (exam === 'all') updateData.isLocked = false;

        await prisma.marks.updateMany({
            where: {
                subjectId: parseInt(subjectId),
                studentId: { in: studentIds.map(id => parseInt(id)) }
            },
            data: updateData
        });
        res.json({ message: `Unlocked marks for ${studentIds.length} students (${exam || 'all'})` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const unapproveMarks = async (req, res) => {
    const { subjectId, studentIds, exam } = req.body;
    try {
        const updateData = {};

        if (exam === 'cia1' || exam === 'all') {
            updateData.isApproved_cia1 = false;
            updateData.isLocked_cia1 = false;
        }
        if (exam === 'cia2' || exam === 'all') {
            updateData.isApproved_cia2 = false;
            updateData.isLocked_cia2 = false;
        }
        if (exam === 'cia3' || exam === 'all') {
            updateData.isApproved_cia3 = false;
            updateData.isLocked_cia3 = false;
        }

        // Backwards compatibility
        if (exam === 'all') {
            updateData.isApproved = false;
            updateData.isLocked = false;
            updateData.approvedBy = null;
            updateData.approvedAt = null;
        }

        await prisma.marks.updateMany({
            where: {
                subjectId: parseInt(subjectId),
                studentId: { in: studentIds.map(id => parseInt(id)) }
            },
            data: updateData
        });
        res.json({ message: `Reverted approval for ${studentIds.length} students (${exam || 'all'})` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const approveMarks = async (req, res) => {
    const { subjectId, studentIds, lock, exam } = req.body;
    const adminId = req.user.id;

    try {
        const updateData = {
            // approvedBy: adminId, 
            // approvedAt: new Date()
        };

        if (exam === 'cia1') {
            updateData.isApproved_cia1 = true;
            if (lock) updateData.isLocked_cia1 = true;
        }
        else if (exam === 'cia2') {
            updateData.isApproved_cia2 = true;
            if (lock) updateData.isLocked_cia2 = true;
        }
        else if (exam === 'cia3') {
            updateData.isApproved_cia3 = true;
            if (lock) updateData.isLocked_cia3 = true;
        } else {
            // Default 'all' or fallback legacy behavior
            updateData.isApproved_cia1 = true;
            updateData.isApproved_cia2 = true;
            updateData.isApproved_cia3 = true;
            if (lock) {
                updateData.isLocked_cia1 = true;
                updateData.isLocked_cia2 = true;
                updateData.isLocked_cia3 = true;
            }
        }

        await prisma.marks.updateMany({
            where: {
                subjectId: parseInt(subjectId),
                studentId: { in: studentIds.map(id => parseInt(id)) }
            },
            data: updateData
        });

        res.json({ message: `Approved marks for ${studentIds.length} students (${exam})` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- Student Management ---

const createStudent = async (req, res) => {
    let { registerNumber, name, department, year, section, semester } = req.body;
    console.log('[DEBUG] createStudent request:', req.body);
    try {
        const parsedYear = parseInt(year);
        // Requirement: First Year students must NOT be assigned to any department.
        if (parsedYear === 1) {
            department = null;
        }

        const student = await prisma.student.create({
            data: {
                registerNumber,
                name,
                department,
                year: parsedYear,
                section,
                semester: parseInt(semester)
            }
        });
        res.status(201).json(student);
    } catch (error) {
        console.error('[ERROR] createStudent failed:', error);
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'A student with this Register Number already exists.' });
        }
        res.status(400).json({ message: error.message });
    }
}


const updateStudent = async (req, res) => {
    const { id } = req.params;
    let { registerNumber, name, department, year, section, semester } = req.body;
    try {
        const studentId = parseInt(id);
        const parsedYear = parseInt(year);

        // Enforce First Year rules if year is changed to 1
        if (parsedYear === 1) {
            department = null;
        }

        const student = await prisma.student.update({
            where: { id: studentId },
            data: {
                registerNumber,
                name,
                department,
                year: parsedYear,
                section,
                semester: parseInt(semester)
            }
        });
        res.json(student);
    } catch (error) {
        console.error('[ERROR] updateStudent failed:', error);
        res.status(400).json({ message: error.message });
    }
}

const deleteStudent = async (req, res) => {
    const { id } = req.params;
    try {
        const studentId = parseInt(id);

        // Use transaction for atomic deletion
        await prisma.$transaction([
            // Delete marks
            prisma.marks.deleteMany({ where: { studentId } }),
            // Delete attendance records
            prisma.studentAttendance.deleteMany({ where: { studentId } }),
            // Finally delete student
            prisma.student.delete({ where: { id: studentId } })
        ]);

        res.json({ message: 'Student and related data deleted successfully' });
    } catch (error) {
        console.error('Delete Student Error:', error);
        res.status(500).json({ message: 'Failed to delete student', error: error.message });
    }
}


const getStudents = async (req, res) => {
    try {
        const students = await prisma.student.findMany();
        res.json(students);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}


// --- Department Management ---

const getDepartments = async (req, res) => {
    try {
        const depts = await prisma.department.findMany();

        // Enrich with stats
        const enriched = await Promise.all(depts.map(async (dept) => {
            let hodName = 'Unassigned';
            // Only fetch name if hodId is present
            if (dept.hodId) {
                const hod = await prisma.user.findUnique({
                    where: { id: dept.hodId },
                    select: { fullName: true }
                });
                if (hod) hodName = hod.fullName;
            }

            // Stats Aggregation
            const isGeneral = dept.name === 'First Year (General)';

            const deptCriteria = { in: [dept.name, dept.code].filter(Boolean) };

            const studentCount = await prisma.student.count({
                where: isGeneral
                    ? { OR: [{ department: { in: deptCriteria.in } }, { department: null }, { department: '' }], year: 1 }
                    : { department: { in: deptCriteria.in } }
            });
            const facultyCount = await prisma.user.count({
                where: { department: { in: deptCriteria.in }, role: 'FACULTY' }
            });
            const subjectCount = await prisma.subject.count({
                where: isGeneral
                    ? { OR: [{ department: { in: deptCriteria.in } }, { department: null }, { department: '' }], type: 'COMMON' }
                    : { department: { in: deptCriteria.in } }
            });

            return {
                ...dept,
                hodName,
                stats: {
                    students: studentCount,
                    faculty: facultyCount,
                    subjects: subjectCount
                }
            };
        }));

        res.json(enriched);
    } catch (error) {
        console.error('getDepartments Error:', error);
        res.status(500).json({ message: error.message });
    }
};

const createDepartment = async (req, res) => {
    const { name, code, hodId, sections, years } = req.body;
    try {
        const dept = await prisma.department.create({
            data: {
                name,
                code,
                hodId: hodId ? parseInt(hodId) : null,
                sections: sections || 'A,B,C',
                years: years || '2,3,4'
            }
        });
        res.status(201).json(dept);
    } catch (error) {
        console.error('createDepartment Error:', error);
        res.status(400).json({ message: 'Department already exists or error' });
    }
};

const updateDepartment = async (req, res) => {
    const { id } = req.params;
    const { name, code, hodId, sections, years } = req.body;
    try {
        const dept = await prisma.department.update({
            where: { id: parseInt(id) },
            data: {
                name,
                code,
                hodId: hodId ? parseInt(hodId) : null,
                sections: sections,
                years: years
            }
        });
        res.json(dept);
    } catch (error) {
        console.error('updateDepartment Error:', error);
        res.status(400).json({ message: 'Error updating department' });
    }
};

const deleteDepartment = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.department.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Department deleted' });
    } catch (error) {
        res.status(400).json({ message: 'Error deleting department' });
    }
};

// --- Faculty Absence & Substitution ---

const markFacultyAbsent = async (req, res) => {
    const { facultyId, date, reason } = req.body;
    try {
        const fId = parseInt(facultyId);

        // 1. Fetch all classes (periods) for this faculty on this day
        // We need to know the day of the week
        const d = new Date(date);
        const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        const dayName = days[d.getUTCDay()];

        const classes = await prisma.timetable.findMany({
            where: {
                facultyId: fId,
                day: dayName
            }
        });

        if (classes.length === 0) {
            // If no classes, we can either block it or just mark generic absence (period 0) 
            // to show they are away even if no class. Let's mark generic 0.
            await prisma.facultyAbsence.create({
                data: { facultyId: fId, date, reason, period: 0 }
            });
            return res.json({ message: 'Marked absent (No classes scheduled for today)' });
        }

        // 2. Create absence record for EACH period
        const ops = classes.map(cls =>
            prisma.facultyAbsence.upsert({
                where: {
                    facultyId_date_period: {
                        facultyId: fId,
                        date: date,
                        period: cls.period
                    }
                },
                update: { reason },
                create: {
                    facultyId: fId,
                    date,
                    period: cls.period,
                    reason
                }
            })
        );

        // Also add a generic "Period 0" record to indicate the "Whole Day" status was initiated,
        // which helps in UI to show the "Full Day" badge, or we can just rely on periods.
        // Let's rely on periods. But having a "0" record is useful for "General Absence".
        // Let's add 0 as well.
        ops.push(
            prisma.facultyAbsence.upsert({
                where: { facultyId_date_period: { facultyId: fId, date: date, period: 0 } },
                update: { reason },
                create: { facultyId: fId, date, period: 0, reason }
            })
        );

        await prisma.$transaction(ops);

        res.json({ message: `Marked absent for ${classes.length} classes.` });

    } catch (error) {
        console.error("markFacultyAbsent Error:", error);
        res.status(500).json({ message: error.message });
    }
};

const assignSubstitute = async (req, res) => {
    const { timetableId, substituteFacultyId, date } = req.body;
    try {
        const tId = parseInt(timetableId);
        const subId = parseInt(substituteFacultyId);

        if (isNaN(tId) || isNaN(subId)) {
            return res.status(400).json({ message: 'Invalid Timetable ID or Faculty ID. Make sure the timetable is saved.' });
        }

        // Conflict Checks
        const originalSlot = await prisma.timetable.findUnique({ where: { id: tId } });
        if (!originalSlot) return res.status(404).json({ message: 'Timetable slot not found' });

        // 1. Check if substitute is designated as ABSENT for the day
        // 1. Check if substitute is designated as ABSENT for the day OR this specific period
        const isSubAbsent = await prisma.facultyAbsence.findFirst({
            where: {
                facultyId: subId,
                date,
                OR: [
                    { period: 0 },
                    { period: originalSlot.period }
                ]
            }
        });
        if (isSubAbsent) {
            return res.status(400).json({ message: 'Selected faculty is marked ABSENT during this time.' });
        }

        // 2. Check if substitute has a regular class at this time
        const subOriginalClass = await prisma.timetable.findFirst({
            where: { facultyId: subId, day: originalSlot.day, period: originalSlot.period }
        });
        if (subOriginalClass) {
            return res.status(400).json({ message: 'Faculty has a regular class at this time.' });
        }

        // 2. Check if substitute already has a substitution
        const existingSub = await prisma.substitution.findFirst({
            where: {
                substituteFacultyId: subId,
                date,
                timetable: { period: originalSlot.period }
            }
        });

        if (existingSub) {
            return res.status(400).json({ message: 'Faculty already has a substitution at this time.' });
        }

        const sub = await prisma.substitution.create({
            data: {
                timetableId: tId,
                substituteFacultyId: subId,
                date
            }
        });
        res.json(sub);

    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ message: 'Substitution already assigned for this slot.' });
        }
        res.status(500).json({ message: error.message });
    }
};

const getAbsences = async (req, res) => {
    const { date } = req.query;
    try {
        const where = date ? { date } : {};
        const absences = await prisma.facultyAbsence.findMany({
            where,
            include: { faculty: true }
        });
        res.json(absences);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const getSubstitutions = async (req, res) => {
    const { date, originalFacultyId } = req.query;
    try {
        const where = {};
        if (date) where.date = date;
        if (originalFacultyId && originalFacultyId !== 'null' && originalFacultyId !== 'undefined') {
            const fId = parseInt(originalFacultyId);
            if (!isNaN(fId)) {
                where.timetable = {
                    facultyId: fId
                };
            }
        }

        const subs = await prisma.substitution.findMany({
            where,
            include: { substituteFaculty: true, timetable: true }
        });
        res.json(subs);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const deleteSubstitution = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.substitution.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Substitution removed' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete' });
    }
}

// --- Subject Management ---

const createSubject = async (req, res) => {
    let { code, name, shortName, department, semester, type } = req.body;
    console.log('[DEBUG] createSubject request:', req.body);
    try {
        const parsedSemester = parseInt(semester);
        const subjectType = type || "DEPARTMENT";

        if (subjectType === "COMMON") {
            // Requirement: COMMON -> First Year subjects (Sem 1 or 2), Department ID must be NULL
            if (parsedSemester > 2) {
                return res.status(400).json({ message: "Common subjects must be for Semester 1 or 2" });
            }
            department = null;
        } else {
            // Requirement: DEPARTMENT -> Second Year onwards (Sem 3+), Department selection is mandatory
            if (parsedSemester < 3) {
                return res.status(400).json({ message: "Department specific subjects must be for Semester 3 or above" });
            }
            if (!department) {
                return res.status(400).json({ message: "Department is mandatory for department-specific subjects" });
            }
        }

        const subject = await prisma.subject.create({
            data: {
                code,
                name,
                shortName,
                department,
                semester: parsedSemester,
                type: subjectType
            }
        });
        res.status(201).json(subject);
    } catch (error) {
        console.error('[ERROR] createSubject failed:', error);
        res.status(400).json({ message: error.message });
    }
}

const getSubjects = async (req, res) => {
    try {
        const subjects = await prisma.subject.findMany({
            include: {
                facultyAssignments: true
            }
        });

        // Debug Log
        console.log(`Fetched ${subjects.length} subjects.`);
        subjects.forEach(s => console.log(`Subject ${s.code} has ${s.facultyAssignments.length} assignments.`));

        // Fetch ALL users to map names, not just FACULTY role (robustness)
        const faculty = await prisma.user.findMany();
        const facultyMap = {};
        faculty.forEach(f => facultyMap[f.id] = f);

        const subjectsWithFaculty = subjects.map(sub => ({
            ...sub,
            assignments: sub.facultyAssignments.map(assign => ({
                ...assign,
                facultyName: facultyMap[assign.facultyId]?.fullName || `Unknown (ID: ${assign.facultyId})`
            }))
        }));

        res.json(subjectsWithFaculty);
    } catch (error) {
        console.error("getSubjects Error:", error);
        res.status(500).json({ message: error.message });
    }
}

// --- Assign Faculty to Subject ---
const assignFaculty = async (req, res) => {
    const { facultyId, subjectId, section } = req.body;
    try {
        const assignment = await prisma.facultyAssignment.create({
            data: {
                facultyId: parseInt(facultyId),
                subjectId: parseInt(subjectId),
                section
            }
        });
        res.status(201).json(assignment);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}

// --- Admin Marks Management ---

const getSubjectMarksForAdmin = async (req, res) => {
    const { subjectId } = req.params;
    try {
        const subject = await prisma.subject.findUnique({ where: { id: parseInt(subjectId) } });
        if (!subject) return res.status(404).json({ message: 'Subject not found' });

        const students = await prisma.student.findMany({
            where: {
                // If it's a COMMON subject, department is null, so we filter by semester
                // If it's a DEPARTMENT subject, we filter by both department and semester
                department: subject.type === 'COMMON' ? null : subject.department,
                semester: subject.semester
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

const updateMarksForAdmin = async (req, res) => {
    // Admin can perform the same partial updates or full updates.
    const { studentId, subjectId } = req.body;

    try {
        const currentMark = await prisma.marks.findUnique({
            where: { studentId_subjectId: { studentId: parseInt(studentId), subjectId: parseInt(subjectId) } }
        });

        const fieldsToUpdate = {};
        const allowedFields = [
            'cia1_test', 'cia1_assignment', 'cia1_attendance',
            'cia2_test', 'cia2_assignment', 'cia2_attendance',
            'cia3_test', 'cia3_assignment', 'cia3_attendance'
        ];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                fieldsToUpdate[field] = req.body[field] === '' ? null : parseFloat(req.body[field]);
            }
        });

        const merged = { ...currentMark, ...fieldsToUpdate };

        const calculateCIAlo = (test, assign, att) => {
            return (test || 0) + (assign || 0) + (att || 0);
        };

        const cia1Total = calculateCIAlo(merged.cia1_test, merged.cia1_assignment, merged.cia1_attendance);
        const cia2Total = calculateCIAlo(merged.cia2_test, merged.cia2_assignment, merged.cia2_attendance);
        const cia3Total = calculateCIAlo(merged.cia3_test, merged.cia3_assignment, merged.cia3_attendance);

        const totals = [cia1Total, cia2Total, cia3Total];
        totals.sort((a, b) => b - a);
        const internal = (totals[0] + totals[1]) / 2;

        fieldsToUpdate.internal = internal;

        const marks = await prisma.marks.upsert({
            where: {
                studentId_subjectId: {
                    studentId: parseInt(studentId),
                    subjectId: parseInt(subjectId)
                }
            },
            update: fieldsToUpdate,
            create: {
                studentId: parseInt(studentId),
                subjectId: parseInt(subjectId),
                ...fieldsToUpdate
            }
        });

        res.json(marks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


const deleteSubject = async (req, res) => {
    const { id } = req.params;
    try {
        const subjectId = parseInt(id);
        const subject = await prisma.subject.findUnique({ where: { id: subjectId } });

        if (!subject) {
            return res.status(404).json({ message: 'Subject not found' });
        }

        // Use transaction to ensure cleaner cleanup
        await prisma.$transaction([
            // 1. Delete Marks
            prisma.marks.deleteMany({ where: { subjectId: subjectId } }),

            // 2. Delete Faculty Assignments
            prisma.facultyAssignment.deleteMany({ where: { subjectId: subjectId } }),

            // 3. Delete Timetable Entries (matching by subjectId OR name to be safe)
            prisma.timetable.deleteMany({
                where: {
                    OR: [
                        { subjectId: subjectId },
                        { subjectName: subject.name }
                    ]
                }
            }),

            // 4. Finally delete the Subject
            prisma.subject.delete({ where: { id: subjectId } })
        ]);

        res.json({ message: 'Subject and related data deleted successfully' });
    } catch (error) {
        console.error('deleteSubject Error:', error);
        res.status(500).json({ message: 'Failed to delete subject. Ensure no critical dependencies exist.' });
    }
};


const removeFacultyAssignment = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.facultyAssignment.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Assignment removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const getDashboardStats = async (req, res) => {
    try {
        // Basic counts
        const studentCount = await prisma.student.count();
        const facultyCount = await prisma.user.count({ where: { role: 'FACULTY' } });
        const subjectCount = await prisma.subject.count();
        const deptCount = await prisma.department.count();

        // Department-wise data (Iterate over ALL departments to ensure we show them even if empty)
        const allDepts = await prisma.department.findMany();

        const departmentData = await Promise.all(allDepts.map(async (dept) => {
            const deptName = dept.name;
            const isFirstYear = deptName === 'First Year (General)';

            let whereClause = {};

            if (isFirstYear) {
                // First Year includes null, empty, or explicit "First Year (General)"
                whereClause.OR = [
                    { department: null },
                    { department: '' },
                    { department: 'First Year (General)' },
                    { department: 'GEN' }
                ];
            } else {
                // Standard Dept: Match Name OR Code
                // We already have name and code from 'dept' object
                whereClause.department = { in: [dept.name, dept.code].filter(Boolean) };
            }

            const studentCount = await prisma.student.count({
                where: whereClause // Same logic for students
            });

            const facultyCount = await prisma.user.count({
                where: {
                    role: 'FACULTY',
                    ...whereClause // Same logic for faculty
                }
            });

            return {
                dept: dept.name,
                students: studentCount,
                faculty: facultyCount
            };
        }));

        // Performance trend (last 6 months of marks data)
        // We'll calculate average internal marks per month
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const allMarks = await prisma.marks.findMany({
            where: {
                updatedAt: { gte: sixMonthsAgo },
                internal: { not: null }
            },
            select: {
                internal: true,
                updatedAt: true
            }
        });

        // Group by month
        const monthlyData = {};
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        allMarks.forEach(mark => {
            const monthIndex = mark.updatedAt.getMonth();
            const monthName = months[monthIndex];
            if (!monthlyData[monthName]) {
                monthlyData[monthName] = { total: 0, count: 0 };
            }
            monthlyData[monthName].total += mark.internal;
            monthlyData[monthName].count += 1;
        });

        const performanceTrend = Object.keys(monthlyData).slice(-6).map(month => ({
            month,
            average: monthlyData[month].count > 0
                ? Math.round(monthlyData[month].total / monthlyData[month].count)
                : 0,
            target: 75
        }));

        // If no data, provide default structure
        if (performanceTrend.length === 0) {
            const currentMonth = new Date().getMonth();
            for (let i = 5; i >= 0; i--) {
                const monthIndex = (currentMonth - i + 12) % 12;
                performanceTrend.push({
                    month: months[monthIndex],
                    average: 0,
                    target: 75
                });
            }
        }

        // Marks distribution
        const marksData = await prisma.marks.findMany({
            where: { internal: { not: null } },
            select: { internal: true }
        });

        const marksDistribution = [
            { range: '90-100', count: 0, color: '#10b981' },
            { range: '75-89', count: 0, color: '#3b82f6' },
            { range: '60-74', count: 0, color: '#f59e0b' },
            { range: 'Below 60', count: 0, color: '#ef4444' }
        ];

        marksData.forEach(mark => {
            const score = mark.internal;
            if (score >= 90) marksDistribution[0].count++;
            else if (score >= 75) marksDistribution[1].count++;
            else if (score >= 60) marksDistribution[2].count++;
            else marksDistribution[3].count++;
        });

        // Calculate average attendance (mock for now, will be real when attendance module is added)
        // For now, we'll use a placeholder
        const avgAttendance = 88.4;

        // Weekly attendance (placeholder - will be real when attendance tracking is added)
        const attendanceData = [
            { day: 'Mon', rate: 88 },
            { day: 'Tue', rate: 92 },
            { day: 'Wed', rate: 85 },
            { day: 'Thu', rate: 90 },
            { day: 'Fri', rate: 87 }
        ];

        res.json({
            students: studentCount,
            faculty: facultyCount,
            subjects: subjectCount,
            avgAttendance,
            departmentData,
            performanceTrend,
            marksDistribution,
            attendanceData
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ message: error.message });
    }
}


const getTimetable = async (req, res) => {
    const { department, year, semester, section, facultyId, day } = req.query;
    try {
        const where = {};
        if (department) where.department = department;
        if (year) where.year = parseInt(year);
        if (semester) where.semester = parseInt(semester);
        if (section) where.section = section;
        if (facultyId) where.facultyId = parseInt(facultyId);
        if (day) where.day = day;

        const timetable = await prisma.timetable.findMany({
            where
        });
        res.json(timetable);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const saveTimetable = async (req, res) => {
    // Expecting array of entries to upsert
    const { entries, department, year, semester, section } = req.body;

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Delete all existing entries for this specific scope
            await tx.timetable.deleteMany({
                where: {
                    department,
                    year: parseInt(year),
                    semester: parseInt(semester),
                    section
                }
            });

            // 2. Create the new entries
            for (const entry of entries) {
                await tx.timetable.create({
                    data: {
                        department,
                        year: parseInt(year),
                        semester: parseInt(semester),
                        section,
                        day: entry.day,
                        period: parseInt(entry.period),
                        subjectName: entry.subjectName,
                        facultyName: entry.facultyName,
                        facultyId: entry.facultyId ? parseInt(entry.facultyId) : null,
                        room: entry.room,
                        type: entry.type,
                        duration: parseInt(entry.duration) || 1
                    }
                });
            }
        });
        res.json({ message: 'Timetable saved successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to save timetable', error: error.message });
    }
}

const removeFacultyAbsence = async (req, res) => {
    // Support both body and query for delete
    const facultyId = (req.body && req.body.facultyId) || req.query.facultyId;
    const date = (req.body && req.body.date) || req.query.date;
    const period = (req.body && req.body.period) || req.query.period; // Optional
    const cleanup = (req.body && req.body.cleanup) || req.query.cleanup; // Boolean string or value

    const mode = (req.body && req.body.mode) || req.query.mode;

    console.log(`[DEBUG] Remove Absence Request. FacID: ${facultyId}, Date: ${date}, Period: ${period}, Mode: ${mode}, Cleanup: ${cleanup}`);

    if (!facultyId || !date) {
        return res.status(400).json({ message: 'Faculty ID and Date are required' });
    }

    try {
        const operations = [];
        const fId = parseInt(facultyId);
        const pId = period ? parseInt(period) : null;

        if (isNaN(fId)) {
            return res.status(400).json({ message: 'Invalid Faculty ID' });
        }

        // 1. Delete Absence Record


        if (mode === 'from_period' && pId !== null && !isNaN(pId)) {
            // Restore from this period onwards
            operations.push(prisma.facultyAbsence.deleteMany({
                where: {
                    facultyId: fId,
                    date: date,
                    OR: [
                        { period: { gte: pId } },
                        { period: 0 }
                    ]
                }
            }));
            console.log(`[DEBUG] Removing absences for faculty ${fId} on ${date} from period ${pId} onwards (including period 0)`);

        } else if (pId !== null && !isNaN(pId)) {
            // Remove specific period
            operations.push(prisma.facultyAbsence.deleteMany({
                where: {
                    facultyId: fId,
                    date: date,
                    period: pId
                }
            }));
            console.log(`[DEBUG] Removing absence for faculty ${fId} on ${date} for period ${pId}`);
        } else {
            // Remove ALL for that day (Restoring full day)
            operations.push(prisma.facultyAbsence.deleteMany({
                where: {
                    facultyId: fId,
                    date: date
                }
            }));
            console.log(`[DEBUG] Removing all absences for faculty ${fId} on ${date}`);
        }

        // 2. Cleanup Substitutions
        // Only if requested. If removing specific period, we should remove sub for that period?
        if (cleanup === 'true' || cleanup === true) {
            console.log('[DEBUG] Cleanup Requested.');

            const where = {
                date: date,
                timetable: { facultyId: parseInt(facultyId) }
            };

            if (period !== undefined && period !== null && period !== '') {
                where.timetable.period = parseInt(period);
            }

            const subsToDelete = await prisma.substitution.findMany({
                where,
                select: { id: true }
            });

            if (subsToDelete.length > 0) {
                operations.push(prisma.substitution.deleteMany({
                    where: { id: { in: subsToDelete.map(s => s.id) } }
                }));
                console.log(`[DEBUG] Cleaning up ${subsToDelete.length} substitutions.`);
            }
        }

        await prisma.$transaction(operations);

        res.json({ message: 'Absence removed successfully.' });
    } catch (error) {
        console.error("[ERROR] Remove Absence Failed:", error);
        res.status(500).json({ message: error.message });
    }
};

// --- Excel Export for Attendance ---

const exportAttendanceExcel = async (req, res) => {
    const { department, year, section, fromDate, toDate, subjectId } = req.query;

    try {
        // Fetch students with attendance data
        const where = {};
        if (department) where.department = department;
        if (year) where.year = parseInt(year);
        if (section) where.section = section;

        const students = await prisma.student.findMany({
            where: where,
            include: {
                attendance: {
                    where: {
                        date: { gte: fromDate, lte: toDate },
                        ...(subjectId && { subjectId: parseInt(subjectId) })
                    },
                    include: {
                        subject: true
                    }
                }
            },
            orderBy: { registerNumber: 'asc' }
        });

        // Get subject info if specific subject
        let subjectInfo = null;
        if (subjectId) {
            subjectInfo = await prisma.subject.findUnique({
                where: { id: parseInt(subjectId) }
            });
        }

        // Prepare Excel data
        const excelData = students.map(s => {
            const total = s.attendance.length;
            const presentOnly = s.attendance.filter(a => a.status === 'PRESENT').length;
            const od = s.attendance.filter(a => a.status === 'OD').length;
            const effectivePresent = presentOnly + od;
            const absent = total - effectivePresent;
            const percentage = total > 0 ? ((effectivePresent / total) * 100).toFixed(2) : '0.00';
            const status = parseFloat(percentage) >= 75 ? 'Eligible' : 'Shortage';

            return {
                'Reg No': s.registerNumber,
                'Student Name': s.name,
                'Department': s.department,
                'Year': s.year,
                'Semester': s.semester,
                'Section': s.section,
                'Subject Code': subjectInfo ? subjectInfo.code : 'All',
                'Subject Name': subjectInfo ? subjectInfo.name : 'All Subjects',
                'Total Classes': total,
                'Present': presentOnly,
                'OD': od,
                'Absent': absent,
                'Effective Present': effectivePresent,
                'Attendance %': percentage,
                'Status': status
            };
        });

        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Attendance Report');

        // Add columns
        worksheet.columns = [
            { header: 'Reg No', key: 'regNo', width: 15 },
            { header: 'Student Name', key: 'name', width: 25 },
            { header: 'Department', key: 'dept', width: 15 },
            { header: 'Year', key: 'year', width: 10 },
            { header: 'Semester', key: 'sem', width: 10 },
            { header: 'Section', key: 'sec', width: 10 },
            { header: 'Subject Code', key: 'code', width: 15 },
            { header: 'Subject Name', key: 'subject', width: 30 },
            { header: 'Total Classes', key: 'total', width: 15 },
            { header: 'Present', key: 'present', width: 10 },
            { header: 'OD', key: 'od', width: 10 },
            { header: 'Absent', key: 'absent', width: 10 },
            { header: 'Effective Present', key: 'effective', width: 15 },
            { header: 'Attendance %', key: 'percentage', width: 15 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        // Add rows
        excelData.forEach(data => {
            worksheet.addRow({
                regNo: data['Reg No'],
                name: data['Student Name'],
                dept: data['Department'],
                year: data['Year'],
                sem: data['Semester'],
                sec: data['Section'],
                code: data['Subject Code'],
                subject: data['Subject Name'],
                total: data['Total Classes'],
                present: data['Present'],
                od: data['OD'],
                absent: data['Absent'],
                effective: data['Effective Present'],
                percentage: data['Attendance %'],
                status: data['Status']
            });
        });

        // Add footer note
        if (excelData.length > 0) {
            worksheet.addRow([]);
            worksheet.addRow(['Note: OD (On Duty) is treated as Present for all attendance calculations.']);
        }

        // Set headers and send file
        const filename = `Attendance_Report_${department || 'All'}_${subjectInfo ? subjectInfo.code : 'All'}_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Export Excel Error:', error);
        res.status(500).json({ message: error.message });
    }
};

const promoteStudents = async (req, res) => {
    const { studentIds, department, section, semester, year } = req.body;
    try {
        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ message: "No students selected for promotion" });
        }

        const result = await prisma.student.updateMany({
            where: {
                id: { in: studentIds.map(id => parseInt(id)) }
            },
            data: {
                department: department,
                section: section,
                semester: parseInt(semester),
                year: parseInt(year)
            }
        });

        res.json({
            message: `Successfully promoted ${result.count} students`,
            count: result.count
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getAllFaculty,
    createFaculty,
    deleteFaculty,
    createStudent,
    updateStudent,
    getStudents,
    createSubject,
    getSubjects,
    deleteSubject,
    assignFaculty,
    removeFacultyAssignment,
    getDashboardStats,
    getSubjectMarksForAdmin,
    updateMarksForAdmin,
    getTimetable,
    saveTimetable,
    deleteStudent,
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,

    markFacultyAbsent,
    removeFacultyAbsence,
    assignSubstitute,
    getAbsences,
    getSubstitutions,
    deleteSubstitution,

    // Marks Approval
    getPendingMarks, getMarksForApproval, approveMarks, approveAllMarks,
    unapproveMarks, unlockMarks, getAllSubjectMarksStatus,

    // Attendance Export
    exportAttendanceExcel,
    promoteStudents
};
