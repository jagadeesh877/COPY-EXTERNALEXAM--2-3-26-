const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { handleError } = require('../utils/errorUtils');

const createStudent = async (req, res) => {
    let { rollNo, registerNumber, name, department, year, section, semester, regulation, batch } = req.body;
    try {
        const parsedYear = parseInt(year) || 1;
        const parsedSemester = parseInt(semester) || 1;

        // Relational Support Resolver
        let targetDeptId = req.body.departmentId || null;
        let targetSecId = req.body.sectionId || null;
        const academicYearId = req.body.academicYearId || 1;

        if (!targetDeptId && department) {
            const allDepts = await prisma.department.findMany();
            const deptText = department.trim().toUpperCase();
            const deptObj = allDepts.find(d =>
                (d.code && d.code.toUpperCase() === deptText) ||
                (d.name && d.name.toUpperCase() === deptText)
            );
            if (deptObj) {
                targetDeptId = deptObj.id;
                department = deptObj.code || deptObj.name; // Standardize string to code if possible
            }
        }

        if (!targetSecId && section && parsedSemester) {
            const isFirstYear = parsedSemester <= 2;
            let secObj = await prisma.section.findFirst({
                where: { name: section, semester: parsedSemester, departmentId: isFirstYear ? null : targetDeptId, academicYearId }
            });
            if (!secObj) {
                secObj = await prisma.section.create({
                    data: { name: section, semester: parsedSemester, type: isFirstYear ? "COMMON" : "DEPARTMENT", departmentId: isFirstYear ? null : targetDeptId, academicYearId }
                });
            }
            targetSecId = secObj.id;
        }

        let parsedBatchYear = null;
        if (batch && typeof batch === 'string') {
            const parts = batch.split('-');
            if (parts.length > 0 && parts[0] && !isNaN(parseInt(parts[0]))) {
                parsedBatchYear = String(parseInt(parts[0]));
            }
        } else if (batch && (typeof batch === 'number' || typeof batch === 'string')) {
            const bNum = parseInt(batch);
            if (!isNaN(bNum)) parsedBatchYear = String(bNum);
        }

        const student = await prisma.student.create({
            data: {
                rollNo,
                registerNumber,
                name,
                department, // Legacy String
                year: parsedYear, // Legacy String
                section, // Legacy String
                semester: parseInt(semester), // Legacy String
                regulation: regulation || "2021",
                batch,
                departmentId: targetDeptId,
                sectionId: targetSecId,
                currentSemester: parseInt(semester),
                batchYear: parsedBatchYear,
                academicYearId: academicYearId
            }
        });
        res.status(201).json(student);
    } catch (error) {
        handleError(res, error, "Error creating student");
    }
};

const updateStudent = async (req, res) => {
    const { id } = req.params;
    let { rollNo, registerNumber, name, department, year, section, semester, regulation, batch } = req.body;
    try {
        const studentId = parseInt(id);
        const parsedYear = parseInt(year) || 1;
        const parsedSemester = parseInt(semester) || 1;

        // Relational Support Resolver
        let targetDeptId = req.body.departmentId || null;
        let targetSecId = req.body.sectionId || null;
        const academicYearId = req.body.academicYearId || 1;

        if (!targetDeptId && department) {
            const allDepts = await prisma.department.findMany();
            const deptText = department.trim().toUpperCase();
            const deptObj = allDepts.find(d =>
                (d.code && d.code.toUpperCase() === deptText) ||
                (d.name && d.name.toUpperCase() === deptText)
            );
            if (deptObj) {
                targetDeptId = deptObj.id;
                department = deptObj.code || deptObj.name; // Standardize string to code if possible
            }
        }

        if (!targetSecId && section && parsedSemester) {
            const isFirstYear = parsedSemester <= 2;
            let secObj = await prisma.section.findFirst({
                where: { name: section, semester: parsedSemester, departmentId: isFirstYear ? null : targetDeptId, academicYearId }
            });
            if (!secObj) {
                secObj = await prisma.section.create({
                    data: { name: section, semester: parsedSemester, type: isFirstYear ? "COMMON" : "DEPARTMENT", departmentId: isFirstYear ? null : targetDeptId, academicYearId }
                });
            }
            targetSecId = secObj.id;
        }

        let parsedBatchYear = null;
        if (batch && typeof batch === 'string') {
            const parts = batch.split('-');
            if (parts.length > 0 && parts[0] && !isNaN(parseInt(parts[0]))) {
                parsedBatchYear = String(parseInt(parts[0]));
            }
        } else if (batch && (typeof batch === 'number' || typeof batch === 'string')) {
            const bNum = parseInt(batch);
            if (!isNaN(bNum)) parsedBatchYear = String(bNum);
        }

        const student = await prisma.student.update({
            where: { id: studentId },
            data: {
                rollNo,
                registerNumber,
                name,
                department, // Legacy
                year: parsedYear, // Legacy
                section, // Legacy
                semester: parseInt(semester), // Legacy
                regulation,
                batch,
                departmentId: targetDeptId,
                sectionId: targetSecId,
                currentSemester: parseInt(semester),
                batchYear: parsedBatchYear,
                academicYearId: academicYearId
            }
        });
        res.json(student);
    } catch (error) {
        handleError(res, error, "Error updating student");
    }
};

const deleteStudent = async (req, res) => {
    const { id } = req.params;
    try {
        const studentId = parseInt(id);

        const publishedResults = await prisma.endSemMarks.findFirst({
            where: {
                marks: { studentId },
                OR: [{ isPublished: true }, { isLocked: true }]
            }
        });

        if (publishedResults) {
            return res.status(403).json({
                message: 'CRITICAL: Cannot delete student with published or locked results.'
            });
        }

        const dummyMappings = await prisma.subjectDummyMapping.findMany({
            where: { studentId }
        });
        const dummyNumbers = dummyMappings.map(m => m.dummyNumber);

        await prisma.$transaction([
            prisma.externalMark.deleteMany({ where: { dummyNumber: { in: dummyNumbers } } }),
            prisma.endSemMarks.deleteMany({ where: { marks: { studentId } } }),
            prisma.marks.deleteMany({ where: { studentId } }),
            prisma.studentAttendance.deleteMany({ where: { studentId } }),
            prisma.subjectDummyMapping.deleteMany({ where: { studentId } }),
            prisma.semesterResult.deleteMany({ where: { studentId } }),
            prisma.hallAllocation.deleteMany({ where: { studentId } }),
            prisma.arrearAttempt.deleteMany({ where: { arrear: { studentId } } }),
            prisma.arrear.deleteMany({ where: { studentId } }),
            prisma.student.delete({ where: { id: studentId } })
        ]);

        res.json({ message: 'Student and related records deleted' });
    } catch (error) {
        handleError(res, error, "Failed to delete student");
    }
};

const getStudents = async (req, res) => {
    try {
        const { semester, departmentId, sectionId } = req.query;
        let whereClause = {};

        // Apply high-performance filtering if parameters are passed
        if (semester) {
            whereClause.status = 'ACTIVE';
            if (parseInt(semester) <= 2) {
                if (!sectionId) return res.status(400).json({ error: "sectionId is required for First Year." });
                whereClause.currentSemester = parseInt(semester);
                whereClause.sectionId = parseInt(sectionId);
            } else {
                if (!departmentId || !sectionId) return res.status(400).json({ error: "departmentId and sectionId are required." });
                whereClause.currentSemester = parseInt(semester);
                whereClause.departmentId = parseInt(departmentId);
                whereClause.sectionId = parseInt(sectionId);
            }
        }

        const students = await prisma.student.findMany({
            where: whereClause,
            include: {
                departmentRef: true,
                sectionRef: true,
                academicYear: true
            },
            orderBy: { registerNumber: 'asc' }
        });
        res.json(students);
    } catch (error) {
        handleError(res, error, "Error fetching students");
    }
};

const promoteStudents = async (req, res) => {
    const { studentIds, department, section, semester, year, currentSectionId, nextSemester, departmentSectionMap, targetSectionId, nextAcademicYearId } = req.body;
    try {
        // Resolve Active Academic Year if not provided
        let activeAY = null;
        if (!nextAcademicYearId) {
            activeAY = await prisma.academicYear.findFirst({ where: { isActive: true } });
        }
        const resolvedAYId = nextAcademicYearId ? parseInt(nextAcademicYearId) : (activeAY?.id || 1);

        // Relational Architecture Branch (Phase 2+)
        if (currentSectionId && nextSemester) {
            const students = await prisma.student.findMany({
                where: { sectionId: parseInt(currentSectionId), status: 'ACTIVE' }
            });

            if (students.length === 0) return res.status(400).json({ message: "No active students found in section." });

            let updatedCount = 0;
            await prisma.$transaction(async (tx) => {
                for (const student of students) {
                    let assignedSectionId = targetSectionId;

                    if (parseInt(nextSemester) === 3 && departmentSectionMap) {
                        assignedSectionId = departmentSectionMap[student.departmentId];
                        if (!assignedSectionId) throw new Error(`Missing target section mapping for department ID ${student.departmentId}`);
                    }

                    if (!assignedSectionId) throw new Error("Target section ID is required.");

                    await tx.student.update({
                        where: { id: student.id },
                        data: {
                            currentSemester: parseInt(nextSemester),
                            sectionId: parseInt(assignedSectionId),
                            academicYearId: resolvedAYId,
                            // Legacy sync
                            semester: parseInt(nextSemester),
                            year: Math.ceil(parseInt(nextSemester) / 2)
                        }
                    });

                    // Create Promotion Log
                    await tx.activityLog.create({
                        data: {
                            action: 'STUDENT_PROMOTION',
                            description: `Promoted to Sem ${nextSemester} ${section || ''}`,
                            performedBy: parseInt(req.user.id),
                            targetId: student.id
                        }
                    });

                    updatedCount++;
                }
            });
            return res.json({ message: `Successfully promoted ${updatedCount} students`, count: updatedCount });
        }

        // Legacy String Architecture Branch (Year 3 / 4 fallback)
        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ message: "No students selected for promotion" });
        }

        const students = await prisma.student.findMany({
            where: { id: { in: studentIds.map(id => parseInt(id)) } },
            select: { id: true, registerNumber: true, rollNo: true }
        });

        const ineligible = students.filter(s => !s.registerNumber);
        if (ineligible.length > 0) {
            return res.status(400).json({
                message: "Register Number must be assigned before promotion.",
                details: `Students missing Register Number: ${ineligible.map(s => s.rollNo).join(', ')}`
            });
        }

        // Legacy String Architecture Branch - Resolve Relational IDs for consistency
        const studentsToUpdate = students.map(s => s.id);
        const resolvedSemester = parseInt(semester);
        const resolvedYear = parseInt(year);

        let targetDeptId = null;
        let standardizedDept = department;
        if (department) {
            const allDepts = await prisma.department.findMany();
            const deptText = String(department).trim().toUpperCase();
            const deptObj = allDepts.find(d =>
                (d.code && d.code.toUpperCase() === deptText) ||
                (d.name && d.name.toUpperCase() === deptText)
            );
            if (deptObj) {
                targetDeptId = deptObj.id;
                standardizedDept = deptObj.code || deptObj.name;
            }
        }

        // Resolve Section ID
        let targetSecId = null;
        if (section && resolvedSemester) {
            const isFirstYear = resolvedSemester <= 2;
            const secObj = await prisma.section.findFirst({
                where: {
                    name: section,
                    semester: resolvedSemester,
                    departmentId: isFirstYear ? null : targetDeptId,
                    academicYearId: resolvedAYId
                }
            });
            if (secObj) targetSecId = secObj.id;
        }

        const result = await prisma.student.updateMany({
            where: { id: { in: studentIds.map(id => parseInt(id)) } },
            data: {
                department: standardizedDept,
                section: section,
                semester: resolvedSemester,
                year: resolvedYear,
                departmentId: targetDeptId,
                sectionId: targetSecId,
                currentSemester: resolvedSemester
            }
        });

        res.json({ message: `Successfully promoted ${result.count} students`, count: result.count });
    } catch (error) {
        handleError(res, error, "Error promoting students");
    }
};

const bulkUploadStudents = async (req, res) => {
    const { students } = req.body;
    try {
        if (!students || !Array.isArray(students)) {
            return res.status(400).json({ message: 'Invalid student data format' });
        }

        let createdCount = 0;
        let updatedCount = 0;
        let errors = [];

        for (const s of students) {
            let { rollNo, registerNumber, name, department, year, section, semester, regulation, batch } = s;

            if (!rollNo) {
                errors.push({ rollNo: 'MISSING', error: 'Roll Number is mandatory' });
                continue;
            }

            rollNo = String(rollNo).trim();

            try {
                // Relational Support Resolver (Sync with createStudent)
                let targetDeptId = null;
                let targetSecId = null;
                const academicYearId = 1; // Default for bulk upload

                const parsedYear = parseInt(year) || 1;
                const parsedSemester = parseInt(semester) || 1;

                if (department) {
                    const allDepts = await prisma.department.findMany();
                    const deptText = String(department).trim().toUpperCase();
                    const deptObj = allDepts.find(d =>
                        (d.code && d.code.toUpperCase() === deptText) ||
                        (d.name && d.name.toUpperCase() === deptText)
                    );
                    if (deptObj) {
                        targetDeptId = deptObj.id;
                        department = deptObj.code || deptObj.name; // Standardize
                    }
                }

                if (section && parsedSemester) {
                    const isFirstYear = parsedSemester <= 2;
                    let secObj = await prisma.section.findFirst({
                        where: { name: section, semester: parsedSemester, departmentId: isFirstYear ? null : targetDeptId, academicYearId }
                    });
                    if (!secObj) {
                        secObj = await prisma.section.create({
                            data: { name: section, semester: parsedSemester, type: isFirstYear ? "COMMON" : "DEPARTMENT", departmentId: isFirstYear ? null : targetDeptId, academicYearId }
                        });
                    }
                    targetSecId = secObj.id;
                }

                let parsedBatchYear = null;
                if (batch && typeof batch === 'string') {
                    const parts = batch.split('-');
                    if (parts.length > 0 && parts[0] && !isNaN(parseInt(parts[0]))) {
                        parsedBatchYear = String(parseInt(parts[0]));
                    }
                } else if (batch && (typeof batch === 'number' || typeof batch === 'string')) {
                    const bNum = parseInt(batch);
                    if (!isNaN(bNum)) parsedBatchYear = String(bNum);
                }

                const existing = await prisma.student.findUnique({ where: { rollNo } });

                if (existing) {
                    await prisma.student.update({
                        where: { rollNo },
                        data: {
                            registerNumber: registerNumber || existing.registerNumber,
                            name: name || existing.name,
                            department: department || existing.department,
                            year: parseInt(year) || existing.year,
                            section: section || existing.section,
                            semester: parseInt(semester) || existing.semester,
                            regulation: regulation || existing.regulation,
                            batch: batch || existing.batch,
                            departmentId: targetDeptId || existing.departmentId,
                            sectionId: targetSecId || existing.sectionId,
                            currentSemester: parseInt(semester) || existing.currentSemester,
                            batchYear: parsedBatchYear || existing.batchYear
                        }
                    });
                    updatedCount++;
                } else {
                    await prisma.student.create({
                        data: {
                            rollNo,
                            registerNumber: registerNumber || null,
                            name: name || 'Unknown',
                            department: department || null,
                            year: parseInt(year) || 1,
                            section: section || 'A',
                            semester: parseInt(semester) || 1,
                            regulation: regulation || "2021",
                            batch: batch || null,
                            departmentId: targetDeptId,
                            sectionId: targetSecId,
                            currentSemester: parseInt(semester) || 1,
                            batchYear: parsedBatchYear,
                            academicYearId: academicYearId
                        }
                    });
                    createdCount++;
                }
            } catch (err) {
                errors.push({ rollNo, error: err.message });
            }
        }

        res.json({
            message: `Bulk processing complete. Created: ${createdCount}, Updated: ${updatedCount}`,
            created: createdCount,
            updated: updatedCount,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        handleError(res, error, "Bulk upload failed");
    }
};

const batchAssignRegisterNumbers = async (req, res) => {
    const { studentIds, startNumber, prefix = '' } = req.body;
    try {
        if (!studentIds || !Array.isArray(studentIds) || !startNumber) {
            return res.status(400).json({ message: "Invalid input. studentIds and startNumber are required." });
        }

        let currentNum = parseInt(startNumber);
        if (isNaN(currentNum)) return res.status(400).json({ message: "Start number must be a valid number." });

        const results = await prisma.$transaction(
            studentIds.map((id) =>
                prisma.student.update({
                    where: { id: parseInt(id) },
                    data: { registerNumber: `${prefix}${currentNum++}` }
                })
            )
        );

        res.json({ message: `Successfully assigned register numbers to ${results.length} students`, count: results.length });
    } catch (error) {
        handleError(res, error, "Error in batch register assignment");
    }
};

module.exports = {
    createStudent,
    updateStudent,
    deleteStudent,
    getStudents,
    promoteStudents,
    bulkUploadStudents,
    batchAssignRegisterNumbers
};
