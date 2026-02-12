const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const pdfService = require('../services/pdfService');

// --- End Semester Mark Entry ---

exports.getEndSemMarks = async (req, res) => {
    try {
        const { department, year, semester, section, subjectId, page = 1, limit = 50 } = req.query;
        const subIdInt = parseInt(subjectId);
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        // 1. Fetch students for the criteria with pagination
        const students = await prisma.student.findMany({
            where: {
                department,
                year: parseInt(year),
                semester: parseInt(semester),
                section
            },
            skip,
            take,
            include: {
                marks: {
                    where: { subjectId: subIdInt },
                    include: { endSemMarks: true }
                },
                dummyMappings: {
                    where: { subjectId: subIdInt }
                }
            }
        });

        // 2. Fetch external marks for this subject
        const externalMarks = await prisma.externalMark.findMany({
            where: { subjectId: subIdInt }
        });

        const extMarksMap = {};
        externalMarks.forEach(em => {
            extMarksMap[em.dummyNumber] = em;
        });

        // 3. Consolidate data
        const consolidated = students.map(student => {
            const ciaRecord = student.marks[0] || {};
            const dummyMapping = student.dummyMappings[0] || {};
            const extRecord = extMarksMap[dummyMapping.dummyNumber] || {};

            // Internal conversion (40%)
            // Requirement: Only use internal marks IF they are approved by Admin
            const internal40 = (ciaRecord.internal && ciaRecord.isApproved)
                ? Math.round(ciaRecord.internal * 0.4)
                : 0;

            const external60 = extRecord.convertedExternal60 ? Math.round(extRecord.convertedExternal60) : 0;
            const total100 = internal40 + external60;

            return {
                id: student.id,
                name: student.name,
                registerNumber: student.registerNumber,
                internal40,
                external60,
                total100,
                dummyNumber: dummyMapping.dummyNumber,
                isLocked: ciaRecord.endSemMarks?.isLocked || false,
                isPublished: ciaRecord.endSemMarks?.isPublished || false,
                grade: ciaRecord.endSemMarks?.grade || 'N/A',
                resultStatus: ciaRecord.endSemMarks?.resultStatus || 'N/A'
            };
        });

        res.json(consolidated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateEndSemMarks = async (req, res) => {
    try {
        const { subjectId, semester, regulation = '2021' } = req.body;
        const subIdInt = parseInt(subjectId);

        // Run in transaction for atomicity
        const resultCount = await prisma.$transaction(async (tx) => {
            // 1. Fetch all data for this subject context
            const students = await tx.student.findMany({
                where: {
                    marks: { some: { subjectId: subIdInt } },
                    dummyMappings: { some: { subjectId: subIdInt } }
                },
                include: {
                    marks: { where: { subjectId: subIdInt }, include: { endSemMarks: true } },
                    dummyMappings: { where: { subjectId: subIdInt } },
                    attendance: { where: { subjectId: subIdInt } }
                }
            });

            const externalMarks = await tx.externalMark.findMany({
                where: { subjectId: subIdInt }
            });

            const extMarksMap = {};
            externalMarks.forEach(em => {
                extMarksMap[em.dummyNumber] = em;
            });

            const grades = await tx.gradeSettings.findMany({ where: { regulation } });

            let count = 0;
            for (const student of students) {
                const ciaRecord = student.marks[0];
                const dummyMapping = student.dummyMappings[0];
                const extRecord = extMarksMap[dummyMapping.dummyNumber];

                if (!ciaRecord || !extRecord) continue;

                // 🧱 IDEMPOTENCY & LOCK CHECK
                if (ciaRecord.endSemMarks?.isLocked || ciaRecord.endSemMarks?.isPublished) {
                    continue; // Skip locked/published results
                }

                // 🧱 ROUNDING BIAS FIX (No intermediate rounding)
                const internalVal = (ciaRecord.internal && ciaRecord.isApproved) ? ciaRecord.internal * 0.4 : 0;
                const externalVal = extRecord.convertedExternal60 || 0;
                const totalMarks = Math.round(internalVal + externalVal);

                // 🧱 EXTERNAL PASS RULE (Check raw 100)
                const isExternalPass = extRecord.rawExternal100 >= 50;

                // Find grade
                const matchedGrade = grades.find(g => totalMarks >= g.minPercentage && totalMarks <= g.maxPercentage)
                    || { grade: 'RA', resultStatus: 'FAIL' };

                let finalResultStatus = (matchedGrade.resultStatus === 'PASS' && isExternalPass) ? 'PASS' : 'FAIL';
                let finalGrade = finalResultStatus === 'PASS' ? matchedGrade.grade : 'RA';

                // 🧱 ATTENDANCE SNAPSHOT
                // Calculate current attendance percentage
                const totalClasses = student.attendance.length;
                const presentCount = student.attendance.filter(a => a.status === 'PRESENT' || a.status === 'OD').length;
                const attPercentage = totalClasses > 0 ? (presentCount / totalClasses) * 100 : 0;

                await tx.endSemMarks.upsert({
                    where: { marksId: ciaRecord.id },
                    update: {
                        externalMarks: extRecord.rawExternal100,
                        totalMarks,
                        grade: finalGrade,
                        resultStatus: finalResultStatus,
                        attendanceSnapshot: attPercentage
                    },
                    create: {
                        marksId: ciaRecord.id,
                        externalMarks: extRecord.rawExternal100,
                        totalMarks,
                        grade: finalGrade,
                        resultStatus: finalResultStatus,
                        attendanceSnapshot: attPercentage
                    }
                });
                count++;
            }
            return count;
        });

        res.json({ message: "Consolidated marks updated and grades calculated", count: resultCount });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// --- GPA/CGPA Engine ---

exports.calculateGPA = async (req, res) => {
    try {
        const { studentId, semester, regulation = '2021' } = req.body;

        const grades = await prisma.gradeSettings.findMany({ where: { regulation } });
        const marks = await prisma.marks.findMany({
            where: { studentId: parseInt(studentId) },
            include: { subject: true, endSemMarks: true }
        });

        // Filter marks for current semester and previous semesters for CGPA
        const currentSemMarks = marks.filter(m => m.subject.semester === parseInt(semester));

        let totalPoints = 0;
        let totalCredits = 0;
        let earnedCredits = 0;
        let semesterPass = true;

        for (const m of currentSemMarks) {
            const credits = m.subject.credits || 3;
            if (!m.endSemMarks || m.endSemMarks.resultStatus === 'FAIL') {
                semesterPass = false;
                totalCredits += credits;
                continue;
            }

            const gradeInfo = grades.find(g => g.grade === m.endSemMarks.grade);
            const gp = gradeInfo ? gradeInfo.gradePoint : 0;

            totalPoints += gp * credits;
            totalCredits += credits;
            earnedCredits += credits;
        }

        const gpa = totalCredits > 0 ? (totalPoints / totalCredits) : 0;

        // CGPA calculation (all past semesters)
        let cumulativePoints = 0;
        let cumulativeCredits = 0;

        for (const m of marks) {
            if (m.subject.semester <= parseInt(semester)) {
                const credits = m.subject.credits || 3;
                if (m.endSemMarks && m.endSemMarks.resultStatus === 'PASS') {
                    const gradeInfo = grades.find(g => g.grade === m.endSemMarks.grade);
                    cumulativePoints += (gradeInfo ? gradeInfo.gradePoint : 0) * credits;
                    cumulativeCredits += credits;
                } else {
                    cumulativeCredits += credits;
                }
            }
        }
        const cgpa = cumulativeCredits > 0 ? (cumulativePoints / cumulativeCredits) : 0;

        await prisma.semesterResult.upsert({
            where: {
                studentId_semester: {
                    studentId: parseInt(studentId),
                    semester: parseInt(semester)
                }
            },
            update: {
                gpa,
                cgpa,
                totalCredits,
                earnedCredits,
                resultStatus: semesterPass ? "PASS" : "FAIL"
            },
            create: {
                studentId: parseInt(studentId),
                semester: parseInt(semester),
                gpa,
                cgpa,
                totalCredits,
                earnedCredits,
                resultStatus: semesterPass ? "PASS" : "FAIL"
            }
        });

        res.json({ gpa, cgpa, resultStatus: semesterPass ? "PASS" : "FAIL" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- Faculty Result View (Read-Only) ---

exports.getFacultyResults = async (req, res) => {
    try {
        const { department, year, semester, section, subjectId } = req.query;

        // 1. Check if Results are Published
        const control = await prisma.semesterControl.findUnique({
            where: {
                department_year_semester_section: {
                    department,
                    year: parseInt(year),
                    semester: parseInt(semester),
                    section
                }
            }
        });

        if (!control || !control.isPublished) {
            return res.status(403).json({ message: "Results for this semester have not been published yet." });
        }

        // 2. Fetch marks (Read-only)
        const students = await prisma.student.findMany({
            where: {
                department,
                year: parseInt(year),
                semester: parseInt(semester),
                section
            },
            include: {
                marks: {
                    where: { subjectId: parseInt(subjectId) },
                    include: { endSemMarks: true }
                },
                results: {
                    where: { semester: parseInt(semester) }
                }
            }
        });

        res.json(students);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// --- Semester Control ---

exports.toggleSemesterControl = async (req, res) => {
    try {
        const { department, year, semester, section, field, value } = req.body;

        const updateData = {};
        updateData[field] = value;

        const control = await prisma.semesterControl.upsert({
            where: {
                department_year_semester_section: {
                    department,
                    year: parseInt(year),
                    semester: parseInt(semester),
                    section
                }
            },
            update: updateData,
            create: {
                department,
                year: parseInt(year),
                semester: parseInt(semester),
                section,
                ...updateData
            }
        });

        // 🧱 FIX ATTENDANCE SNAPSHOT ISSUE (CRITICAL)
        if (field === 'isPublished' && value === true) {
            const students = await prisma.student.findMany({
                where: {
                    department,
                    year: parseInt(year),
                    semester: parseInt(semester),
                    section
                },
                include: {
                    attendance: true,
                    marks: { include: { endSemMarks: true } }
                }
            });

            for (const student of students) {
                for (const mark of student.marks) {
                    if (mark.endSemMarks) {
                        // Per-subject attendance snapshot
                        const subAttendance = student.attendance.filter(a => a.subjectId === mark.subjectId);
                        const total = subAttendance.length;
                        const present = subAttendance.filter(a => a.status === 'PRESENT' || a.status === 'OD').length;
                        const percentage = total > 0 ? (present / total) * 100 : 0;

                        await prisma.endSemMarks.update({
                            where: { id: mark.endSemMarks.id },
                            data: {
                                attendanceSnapshot: percentage,
                                isPublished: true
                            }
                        });
                    }
                }
            }
        }

        res.json(control);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getSemesterControl = async (req, res) => {
    try {
        const { department, year, semester, section } = req.query;

        const control = await prisma.semesterControl.findUnique({
            where: {
                department_year_semester_section: {
                    department,
                    year: parseInt(year),
                    semester: parseInt(semester),
                    section
                }
            }
        });

        // If no control record exists, return default status
        res.json(control || {
            markEntryOpen: false,
            isPublished: false,
            isLocked: false
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getGradeSheet = async (req, res) => {
    try {
        const { studentId, semester } = req.query;

        const student = await prisma.student.findUnique({
            where: { id: parseInt(studentId) },
            include: {
                marks: {
                    include: {
                        subject: true,
                        endSemMarks: true
                    }
                },
                results: {
                    where: { semester: parseInt(semester) }
                }
            }
        });

        if (!student) return res.status(404).send('Student not found');

        const result = student.results[0] || { gpa: 0, resultStatus: 'N/A' };

        const pdfData = {
            studentName: student.name,
            registerNumber: student.registerNumber,
            department: student.department,
            semester,
            gpa: result.gpa,
            resultStatus: result.resultStatus,
            marks: student.marks.map(m => ({
                subjectCode: m.subject.code,
                subjectName: m.subject.name,
                credits: m.subject.credits,
                grade: m.endSemMarks?.grade || 'N/A',
                status: m.endSemMarks?.resultStatus || 'PENDING'
            }))
        };

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=grade_sheet_${studentId}.pdf`);

        pdfService.generateGradeSheet(res, pdfData);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
