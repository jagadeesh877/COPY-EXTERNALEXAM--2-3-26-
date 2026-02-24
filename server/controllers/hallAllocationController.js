const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const PDFDocument = require('pdfkit');

// CIA Seating: 2 students per bench, different subjects on same bench
const calculateSeatingCIA = (students, halls) => {
    // 1. Group students by subject
    const subjectPools = {};
    students.forEach(s => {
        if (!subjectPools[s.currentSubjectId]) subjectPools[s.currentSubjectId] = [];
        subjectPools[s.currentSubjectId].push(s);
    });

    const pools = Object.values(subjectPools).sort((a, b) => b.length - a.length);

    // 2. Interleave subjects to ensure diversity
    const interleaved = [];
    let total = students.length;
    while (interleaved.length < total) {
        for (let i = 0; i < pools.length; i++) {
            if (pools[i].length > 0) {
                interleaved.push(pools[i].shift());
            }
        }
    }

    const allocations = [];
    let studentIdx = 0;

    for (const hall of halls) {
        for (const col of hall.columns) {
            for (let b = 1; b <= col.benches; b++) {
                // Bench can take up to 2 students
                for (let pos = 1; pos <= 2; pos++) {
                    if (studentIdx >= interleaved.length) break;

                    const student = interleaved[studentIdx];

                    // Simple subject check for same bench
                    if (pos === 2 && allocations.length > 0) {
                        const prev = allocations[allocations.length - 1];
                        if (prev.benchIndex === b && prev.columnLabel === col.label && prev.hallId === hall.id) {
                            if (prev.subjectId === student.currentSubjectId) {
                                // Try to find a different subject student from further down
                                let swapIdx = studentIdx + 1;
                                while (swapIdx < interleaved.length && interleaved[swapIdx].currentSubjectId === student.currentSubjectId) {
                                    swapIdx++;
                                }
                                if (swapIdx < interleaved.length) {
                                    // Swap
                                    [interleaved[studentIdx], interleaved[swapIdx]] = [interleaved[swapIdx], interleaved[studentIdx]];
                                }
                            }
                        }
                    }

                    const currentStudent = interleaved[studentIdx];
                    allocations.push({
                        hallId: hall.id,
                        studentId: currentStudent.id,
                        subjectId: currentStudent.currentSubjectId,
                        department: currentStudent.department,
                        year: currentStudent.year,
                        seatNumber: `${col.label}${b}${pos === 1 ? 'A' : 'B'}`,
                        benchIndex: b,
                        columnLabel: col.label
                    });
                    studentIdx++;
                }
                if (studentIdx >= interleaved.length) break;
            }
            if (studentIdx >= interleaved.length) break;
        }
        if (studentIdx >= interleaved.length) break;
    }

    return { allocations, remaining: interleaved.slice(studentIdx) };
};

// END_SEM Seating: 1 student per bench, alternate subjects vertically
const calculateSeatingENDSEM = (students, halls) => {
    const subjectPools = {};
    students.forEach(s => {
        if (!subjectPools[s.currentSubjectId]) subjectPools[s.currentSubjectId] = [];
        subjectPools[s.currentSubjectId].push(s);
    });

    const pools = Object.values(subjectPools).sort((a, b) => b.length - a.length);

    const interleaved = [];
    let total = students.length;
    while (interleaved.length < total) {
        for (let i = 0; i < pools.length; i++) {
            if (pools[i].length > 0) {
                interleaved.push(pools[i].shift());
            }
        }
    }

    const allocations = [];
    let studentIdx = 0;

    for (const hall of halls) {
        for (const col of hall.columns) {
            let lastSubjectId = null;
            for (let b = 1; b <= col.benches; b++) {
                if (studentIdx >= interleaved.length) break;

                let student = interleaved[studentIdx];

                // Vertical alternation check
                if (student.currentSubjectId === lastSubjectId) {
                    let swapIdx = studentIdx + 1;
                    while (swapIdx < interleaved.length && interleaved[swapIdx].currentSubjectId === lastSubjectId) {
                        swapIdx++;
                    }
                    if (swapIdx < interleaved.length) {
                        [interleaved[studentIdx], interleaved[swapIdx]] = [interleaved[swapIdx], interleaved[studentIdx]];
                        student = interleaved[studentIdx];
                    }
                }

                allocations.push({
                    hallId: hall.id,
                    studentId: student.id,
                    subjectId: student.currentSubjectId,
                    department: student.department,
                    year: student.year,
                    seatNumber: `${col.label}${b}`,
                    benchIndex: b,
                    columnLabel: col.label
                });

                lastSubjectId = student.currentSubjectId;
                studentIdx++;
            }
            if (studentIdx >= interleaved.length) break;
        }
        if (studentIdx >= interleaved.length) break;
    }

    return { allocations, remaining: interleaved.slice(studentIdx) };
};

exports.getSessions = async (req, res) => {
    try {
        const sessions = await prisma.examSession.findMany({
            include: {
                subjects: { include: { subject: true } },
                _count: { select: { allocations: true } }
            },
            orderBy: { examDate: 'desc' }
        });
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createSession = async (req, res) => {
    try {
        const { examName, examDate, session, examMode, subjectIds } = req.body;

        const result = await prisma.$transaction(async (tx) => {
            const newSession = await tx.examSession.create({
                data: {
                    examName,
                    examDate: new Date(examDate),
                    session,
                    examMode: examMode || "CIA",
                    createdBy: req.user.id
                }
            });

            if (subjectIds && subjectIds.length > 0) {
                await tx.examSessionSubjects.createMany({
                    data: subjectIds.map(id => ({
                        examSessionId: newSession.id,
                        subjectId: parseInt(id)
                    }))
                });
            }

            return newSession;
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getHalls = async (req, res) => {
    try {
        const halls = await prisma.hall.findMany({
            where: { isActive: true },
            orderBy: { hallName: 'asc' }
        });
        res.json(halls);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.addHall = async (req, res) => {
    try {
        const { hallName, blockName, columns } = req.body;

        const totalBenches = columns.reduce((acc, col) => acc + parseInt(col.benches), 0);

        // 1. Create Hall
        const hall = await prisma.hall.create({
            data: {
                hallName,
                blockName,
                totalBenches,
                capacityCIA: totalBenches * 2,
                capacityEND: totalBenches * 1
            }
        });

        // 2. Create Columns
        if (columns && columns.length > 0) {
            const columnPromises = columns.map(col =>
                prisma.hallColumn.create({
                    data: {
                        hallId: hall.id,
                        label: col.label,
                        benches: parseInt(col.benches)
                    }
                })
            );
            await prisma.$transaction(columnPromises);
        }

        const result = await prisma.hall.findUnique({
            where: { id: hall.id },
            include: { columns: true }
        });

        res.json(result);
    } catch (error) {
        console.error("Add Hall Error:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.deleteHall = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.hall.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Hall deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.generateAllocations = async (req, res) => {
    console.log("[API] Generate Allocations called - MODE UPGRADE");
    try {
        const { sessionId, hallIds } = req.body;

        const session = await prisma.examSession.findUnique({
            where: { id: parseInt(sessionId) },
            include: { subjects: true }
        });

        if (!session) return res.status(404).json({ message: "Session not found" });
        if (session.isLocked) return res.status(403).json({ message: "Session is locked. Unlock to regenerate." });

        // 1. Fetch all students registered for these subjects
        const subjectIds = session.subjects.map(s => s.subjectId);
        const subjects = await prisma.subject.findMany({
            where: { id: { in: subjectIds } }
        });

        // NEW: Fetch all departments to handle Name vs Code mismatch
        const allDepts = await prisma.department.findMany();

        let allEligibleStudents = [];
        for (const sub of subjects) {
            // Check if sub.department matches a code or name in our official list
            const deptMatch = allDepts.find(d => d.code === sub.department || d.name === sub.department);
            const searchDept = deptMatch ? deptMatch.name : sub.department;

            console.log(`[DEBUG] Fetching students for ${sub.code} | Sem: ${sub.semester} | Dept Search: ${searchDept}`);

            const studentList = await prisma.student.findMany({
                where: {
                    department: searchDept || undefined,
                    semester: sub.semester
                },
                orderBy: { rollNo: 'asc' }
            });
            studentList.forEach(s => s.currentSubjectId = sub.id);
            allEligibleStudents = [...allEligibleStudents, ...studentList];
        }

        const uniqueStudents = [];
        const seenIds = new Set();
        for (const s of allEligibleStudents) {
            if (!seenIds.has(s.id)) {
                uniqueStudents.push(s);
                seenIds.add(s.id);
            }
        }

        console.log(`[DEBUG] Total unique students found: ${uniqueStudents.length}`);

        if (uniqueStudents.length === 0) {
            return res.status(400).json({
                message: "No eligible students found for the selected subjects. Please check if students are added for the correct department and semester."
            });
        }

        // 2. Fetch selected halls with columns
        const halls = await prisma.hall.findMany({
            where: { id: { in: hallIds.map(id => parseInt(id)) }, isActive: true },
            include: { columns: { orderBy: { label: 'asc' } } }
        });

        const totalCapacity = halls.reduce((acc, h) => {
            return acc + (session.examMode === 'CIA' ? h.capacityCIA : h.capacityEND);
        }, 0);

        if (uniqueStudents.length > totalCapacity) {
            return res.status(400).json({
                message: `Insufficient capacity. Students: ${uniqueStudents.length}, Capacity: ${totalCapacity}`
            });
        }

        // 3. Algorithm choice based on Exam Mode
        const { allocations, remaining } = session.examMode === 'CIA'
            ? calculateSeatingCIA(uniqueStudents, halls)
            : calculateSeatingENDSEM(uniqueStudents, halls);

        // 4. Save to DB within transaction
        await prisma.$transaction(async (tx) => {
            await tx.hallAllocation.deleteMany({ where: { examSessionId: session.id } });

            // Batch create allocations
            for (let i = 0; i < allocations.length; i += 100) {
                const batch = allocations.slice(i, i + 100);
                await tx.hallAllocation.createMany({
                    data: batch.map(a => ({
                        examSessionId: session.id,
                        hallId: a.hallId,
                        studentId: a.studentId,
                        subjectId: a.subjectId,
                        department: a.department,
                        year: a.year,
                        seatNumber: a.seatNumber,
                        benchIndex: a.benchIndex,
                        columnLabel: a.columnLabel
                    }))
                });
            }
        });

        res.json({
            message: `Allocation generated successfully for ${session.examMode} mode`,
            count: allocations.length,
            unallocated: remaining.length
        });

    } catch (error) {
        console.error("Allocation Error:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.getSessionAllocations = async (req, res) => {
    try {
        const { id } = req.params;
        const allocations = await prisma.hallAllocation.findMany({
            where: { examSessionId: parseInt(id) },
            include: {
                student: true,
                subject: true,
                hall: true
            },
            orderBy: [{ hallId: 'asc' }, { rowNumber: 'asc' }, { columnNumber: 'asc' }]
        });
        res.json(allocations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.toggleSessionLock = async (req, res) => {
    try {
        const { id } = req.params;
        const { isLocked } = req.body;
        const session = await prisma.examSession.update({
            where: { id: parseInt(id) },
            data: { isLocked }
        });
        res.json(session);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.deleteSession = async (req, res) => {
    try {
        const { id } = req.params;
        const sessionId = parseInt(id);

        // Delete associated subjects and allocations will be handled by Cascading Deletes defined in Prisma schema
        // But for extra safety or if we want to log what's happening, we can do it here.
        await prisma.examSession.delete({
            where: { id: sessionId }
        });

        res.json({ message: "Exam session and its allocations deleted successfully" });
    } catch (error) {
        console.error("Delete Session Error:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.updateSessionSubjects = async (req, res) => {
    try {
        const { id } = req.params;
        const { subjectIds } = req.body;

        console.log(`Updating subjects for session ${id}:`, subjectIds);

        const session = await prisma.examSession.findUnique({ where: { id: parseInt(id) } });
        if (!session) return res.status(404).json({ message: "Session not found" });

        await prisma.$transaction(async (tx) => {
            // 1. Delete existing subjects
            await tx.examSessionSubjects.deleteMany({
                where: { examSessionId: parseInt(id) }
            });

            // 2. Add new subjects if any
            if (subjectIds && subjectIds.length > 0) {
                // Using individual creates for better compatibility across all DB types
                for (const sid of subjectIds) {
                    await tx.examSessionSubjects.create({
                        data: {
                            examSessionId: parseInt(id),
                            subjectId: parseInt(sid)
                        }
                    });
                }
            }
        });

        const updatedSession = await prisma.examSession.findUnique({
            where: { id: parseInt(id) },
            include: { subjects: true }
        });

        res.json(updatedSession);
    } catch (error) {
        console.error("Update Session Subjects Error:", error);
        res.status(500).json({ message: error.message });
    }
};

// Helper to group register numbers into ranges
const getRegisterRanges = (students) => {
    if (!students || students.length === 0) return "";

    const regNos = students.map(s => s.registerNumber || s.rollNo).filter(Boolean).sort();

    const ranges = [];
    let start = regNos[0];
    let prev = regNos[0];

    for (let i = 1; i <= regNos.length; i++) {
        const current = regNos[i];

        const prevNum = parseInt(String(prev).slice(-3));
        const currNum = current ? parseInt(String(current).slice(-3)) : null;
        const prevPrefix = String(prev).slice(0, -3);
        const currPrefix = current ? String(current).slice(0, -3) : null;

        if (currNum !== prevNum + 1 || prevPrefix !== currPrefix || i === regNos.length) {
            if (start === prev) {
                ranges.push(start);
            } else {
                ranges.push(`${start}-${String(prev).slice(-3)}`);
            }
            start = current;
        }
        prev = current;
    }
    return ranges.join(", ");
};

const getRomanNumeral = (num) => {
    const roman = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
    return roman[num] || num;
};

exports.exportConsolidatedPlan = async (req, res) => {
    try {
        const { id } = req.params;
        const session = await prisma.examSession.findUnique({
            where: { id: parseInt(id) }
        });

        if (!session) return res.status(404).json({ message: "Session not found" });

        const deptsFromDb = await prisma.department.findMany();
        const deptMap = {};
        deptsFromDb.forEach(d => {
            deptMap[d.name] = d.code || d.name;
        });

        const allocations = await prisma.hallAllocation.findMany({
            where: { examSessionId: parseInt(id) },
            include: {
                student: true,
                subject: true,
                hall: { include: { columns: true } }
            },
            orderBy: [
                { hall: { hallName: 'asc' } },
                { year: 'asc' },
                { department: 'asc' },
                { student: { rollNo: 'asc' } }
            ]
        });

        const doc = new PDFDocument({ margin: 30, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Consolidated_Plan_${session.examName.replace(/\s+/g, '_')}.pdf`);
        doc.pipe(res);

        const drawMainHeader = () => {
            const logoPath = require('path').join(process.cwd(), '..', 'client', 'public', 'miet-logo.png');
            try { doc.image(logoPath, 40, 30, { width: 70 }); } catch (e) { }

            doc.fontSize(16).font('Helvetica-Bold').text('M.I.E.T. ENGINEERING COLLEGE', 120, 35, { align: 'center', width: 400 });
            doc.fontSize(10).font('Helvetica').text('(AUTONOMOUS)', 120, 52, { align: 'center', width: 400 });
            doc.fontSize(9).font('Helvetica').text('(AFFILIATED TO ANNA UNIVERSITY, CHENNAI)', 120, 64, { align: 'center', width: 400 });
            doc.fontSize(9).font('Helvetica').text('TIRUCHIRAPPALLI', 120, 75, { align: 'center', width: 400 });
            doc.fontSize(10).font('Helvetica-Bold').text('OFFICE OF THE CONTROLLER OF EXAMINATIONS', 120, 90, { align: 'center', width: 400 });

            // Border for header
            doc.rect(40, 30, 515, 80).stroke();

            // Sub titles border
            doc.rect(40, 115, 515, 30).stroke();
            doc.fontSize(11).font('Helvetica-Bold').text(session.examName.toUpperCase(), 30, 120, { align: 'center', width: 535 });
            doc.fontSize(10).font('Helvetica-Bold').text('CONSOLIDATED HALL PLAN', 30, 134, { align: 'center', width: 535 });
        };

        const hallGroups = {};
        allocations.forEach(a => {
            const hId = a.hallId;
            if (!hallGroups[hId]) {
                hallGroups[hId] = {
                    name: a.hall.hallName,
                    totalStrength: 0,
                    deptData: {}
                };
            }
            const h = hallGroups[hId];
            h.totalStrength++;

            const shortDept = deptMap[a.department] || a.department;
            const key = `${a.subject.semester}-${shortDept}`;
            if (!h.deptData[key]) {
                h.deptData[key] = {
                    sem: a.subject.semester,
                    dept: shortDept,
                    students: []
                };
            }
            h.deptData[key].students.push(a.student);
        });

        drawMainHeader();

        let currentY = 145;
        const colX = { sno: 40, sem: 65, dept: 95, hall: 145, reg: 205, str: 445, total: 495, end: 555 };
        const colW = {
            sno: colX.sem - colX.sno,
            sem: colX.dept - colX.sem,
            dept: colX.hall - colX.dept,
            hall: colX.reg - colX.hall,
            reg: colX.str - colX.reg,
            str: colX.total - colX.str,
            total: colX.end - colX.total
        };

        const drawTableHeader = (y) => {
            doc.rect(colX.sno, y, colX.end - colX.sno, 25).fill('#f0f0f0').stroke('#000000');
            doc.fill('#000000').font('Helvetica-Bold').fontSize(8);

            Object.values(colX).forEach(x => {
                if (x !== colX.end) doc.moveTo(x, y).lineTo(x, y + 25).stroke();
            });

            const textY = y + 8;
            doc.text('S.\nNo.', colX.sno, y + 4, { width: colW.sno, align: 'center' });
            doc.text('Sem', colX.sem, textY, { width: colW.sem, align: 'center' });
            doc.text('Dept.', colX.dept, textY, { width: colW.dept, align: 'center' });
            doc.text('Hall\nName', colX.hall, y + 4, { width: colW.hall, align: 'center' });
            doc.text('Register Number', colX.reg, textY, { width: colW.reg, align: 'center' });
            doc.text('Strength', colX.str, textY, { width: colW.str, align: 'center' });
            doc.text('Total\nStrength', colX.total, y + 4, { width: colW.total, align: 'center' });
            return y + 25;
        };

        doc.lineWidth(0.5);
        currentY = drawTableHeader(currentY);
        let sNo = 1;

        Object.values(hallGroups).forEach(hall => {
            const depts = Object.values(hall.deptData);

            depts.forEach(d => {
                const ranges = getRegisterRanges(d.students);
                d.rangesText = ranges;
                const textHeight = doc.font('Helvetica').fontSize(8).heightOfString(ranges, { width: colW.reg - 8 });
                d.rowHeight = Math.max(20, textHeight + 8);
            });

            const hallHeight = depts.reduce((sum, d) => sum + d.rowHeight, 0);

            if (currentY + hallHeight > 780) {
                doc.addPage();
                drawMainHeader();
                currentY = 145;
                currentY = drawTableHeader(currentY);
            }

            const hallStartY = currentY;
            let rowY = currentY;

            depts.forEach((d) => {
                doc.font('Helvetica').fontSize(8);

                doc.rect(colX.sem, rowY, colW.sem, d.rowHeight).stroke();
                const semText = getRomanNumeral(d.sem);
                doc.text(semText, colX.sem, rowY + (d.rowHeight / 2) - 4, { width: colW.sem, align: 'center' });

                doc.rect(colX.dept, rowY, colW.dept, d.rowHeight).stroke();
                doc.text(d.dept, colX.dept, rowY + (d.rowHeight / 2) - 4, { width: colW.dept, align: 'center' });

                doc.rect(colX.reg, rowY, colW.reg, d.rowHeight).stroke();
                const textH = doc.heightOfString(d.rangesText, { width: colW.reg - 8 });
                doc.text(d.rangesText, colX.reg + 4, rowY + (d.rowHeight / 2) - (textH / 2), { width: colW.reg - 8, align: 'left', lineGap: 1 });

                doc.rect(colX.str, rowY, colW.str, d.rowHeight).stroke();
                doc.text(d.students.length.toString(), colX.str, rowY + (d.rowHeight / 2) - 4, { width: colW.str, align: 'center' });

                rowY += d.rowHeight;
            });

            doc.rect(colX.sno, hallStartY, colW.sno, hallHeight).stroke();
            doc.font('Helvetica').text(sNo.toString(), colX.sno, hallStartY + (hallHeight / 2) - 4, { width: colW.sno, align: 'center' });

            doc.rect(colX.hall, hallStartY, colW.hall, hallHeight).stroke();
            doc.text(hall.name, colX.hall, hallStartY + (hallHeight / 2) - 4, { width: colW.hall, align: 'center' });

            doc.rect(colX.total, hallStartY, colW.total, hallHeight).stroke();
            doc.text(hall.totalStrength.toString(), colX.total, hallStartY + (hallHeight / 2) - 4, { width: colW.total, align: 'center' });

            currentY += hallHeight;
            sNo++;
        });

        doc.end();
    } catch (error) {
        console.error("PDF Export Error:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.exportSeatingGrid = async (req, res) => {
    try {
        const { id } = req.params;
        const session = await prisma.examSession.findUnique({
            where: { id: parseInt(id) }
        });

        if (!session) return res.status(404).json({ message: "Session not found" });

        const deptsFromDb = await prisma.department.findMany();
        const deptMap = {};
        deptsFromDb.forEach(d => {
            deptMap[d.name] = d.code || d.name;
        });

        const allocations = await prisma.hallAllocation.findMany({
            where: { examSessionId: parseInt(id) },
            include: {
                student: true,
                subject: true,
                hall: { include: { columns: true } }
            },
            orderBy: [{ hall: { hallName: 'asc' } }, { columnLabel: 'asc' }, { benchIndex: 'asc' }]
        });

        const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Seating_Grid_${session.examName.replace(/\s+/g, '_')}.pdf`);
        doc.pipe(res);

        const halls = Array.from(new Set(allocations.map(a => a.hallId)));

        // A4 Landscape available width with 30px margins = 841.89 - 60 = ~780
        const availableWidth = 780;

        halls.forEach((hId, index) => {
            if (index > 0) doc.addPage();

            const hallAllocations = allocations.filter(a => a.hallId === hId);
            const hall = hallAllocations[0].hall;

            const logoPath = require('path').join(process.cwd(), '..', 'client', 'public', 'miet-logo.png');
            try { doc.image(logoPath, 40, 30, { width: 70 }); } catch (e) { }

            doc.fontSize(16).font('Helvetica-Bold').text('M.I.E.T. ENGINEERING COLLEGE', 120, 35, { align: 'center', width: availableWidth - 80 });
            doc.fontSize(10).font('Helvetica').text('(AUTONOMOUS)', 120, 52, { align: 'center', width: availableWidth - 80 });
            doc.fontSize(9).font('Helvetica').text('(AFFILIATED TO ANNA UNIVERSITY, CHENNAI)', 120, 64, { align: 'center', width: availableWidth - 80 });
            doc.fontSize(9).font('Helvetica').text('TIRUCHIRAPPALLI', 120, 75, { align: 'center', width: availableWidth - 80 });
            doc.fontSize(10).font('Helvetica-Bold').text('OFFICE OF THE CONTROLLER OF EXAMINATIONS', 120, 90, { align: 'center', width: availableWidth - 80 });

            doc.rect(40, 30, availableWidth, 80).stroke();

            doc.rect(40, 115, availableWidth, 20).stroke();
            doc.fontSize(10).font('Helvetica-Bold').text(session.examName.toUpperCase(), 50, 120);
            doc.fontSize(10).font('Helvetica-Bold').text(`HALL NO - ${hall.hallName}`, availableWidth - 100, 120, { width: 130, align: 'right' });

            const colLabels = hall.columns.map(c => c.label);
            const maxBenches = Math.max(...hall.columns.map(c => c.benches));

            const startX = 40;
            let currentX = startX;
            const blockW = availableWidth / colLabels.length;
            const seatW = blockW < 100 ? 20 : 25; // Responsive to col count
            const stuW = (blockW - seatW) / 2;

            const headerY1 = 145;
            const headerY2 = headerY1 + 15;
            const headerCellH = 35; // Taller headers
            const seatCellH = 30; // Taller seat cells

            colLabels.forEach((label, i) => {
                doc.rect(currentX, headerY1, seatW, 15).stroke();
                if (i === 0) {
                    doc.fontSize(7).font('Helvetica-Bold').text('Stage', currentX, headerY1 + 4, { width: seatW, align: 'center' });
                }

                doc.rect(currentX + seatW, headerY1, stuW * 2, 15).stroke();
                doc.fontSize(9).font('Helvetica-Bold').text(label, currentX + seatW, headerY1 + 3, { width: stuW * 2, align: 'center' });

                const benchAllocations = hallAllocations.filter(a => a.columnLabel === label);
                const leftStus = benchAllocations.filter(a => a.seatNumber.endsWith('A') || a.seatNumber === a.columnLabel + a.benchIndex);
                const rightStus = benchAllocations.filter(a => a.seatNumber.endsWith('B'));

                const getHeaderStr = (stus) => {
                    const unique = [...new Set(stus.map(s => {
                        let dept = deptMap[s.department] || s.department;
                        return `${getRomanNumeral(s.year)} ${dept}`;
                    }))];
                    return unique.join(' /\n');
                };

                let leftStr = getHeaderStr(leftStus);
                let rightStr = getHeaderStr(rightStus);

                if (session.examMode === 'CIA') {
                    doc.rect(currentX + seatW, headerY2, stuW, headerCellH).stroke();
                    doc.rect(currentX + seatW + stuW, headerY2, stuW, headerCellH).stroke();
                    const leftH = doc.fontSize(6).font('Helvetica-Bold').heightOfString(leftStr, { width: stuW - 2 });
                    const rightH = doc.fontSize(6).font('Helvetica-Bold').heightOfString(rightStr, { width: stuW - 2 });
                    doc.text(leftStr, currentX + seatW + 1, headerY2 + (headerCellH / 2) - (leftH / 2), { width: stuW - 2, align: 'center', lineGap: 1 });
                    doc.text(rightStr, currentX + seatW + stuW + 1, headerY2 + (headerCellH / 2) - (rightH / 2), { width: stuW - 2, align: 'center', lineGap: 1 });
                } else {
                    doc.rect(currentX + seatW, headerY2, stuW * 2, headerCellH).stroke();
                    const leftH = doc.fontSize(6).font('Helvetica-Bold').heightOfString(leftStr, { width: stuW * 2 - 2 });
                    doc.text(leftStr, currentX + seatW + 1, headerY2 + (headerCellH / 2) - (leftH / 2), { width: stuW * 2 - 2, align: 'center', lineGap: 1 });
                }

                doc.rect(currentX, headerY2, seatW, headerCellH).stroke();

                currentX += blockW;
            });

            let currentY = headerY2 + headerCellH;
            for (let b = 1; b <= maxBenches; b++) {
                currentX = startX;
                colLabels.forEach((label) => {
                    doc.rect(currentX, currentY, seatW, seatCellH).stroke();
                    doc.fontSize(7).font('Helvetica-Bold').text(`${label}${b}`, currentX, currentY + (seatCellH / 2) - 4, { width: seatW, align: 'center' });

                    const benchStus = hallAllocations.filter(a => a.columnLabel === label && a.benchIndex === b);
                    const leftStu = benchStus.find(a => a.seatNumber.endsWith('A') || a.seatNumber === label + b);
                    const rightStu = benchStus.find(a => a.seatNumber.endsWith('B'));

                    if (session.examMode === 'CIA') {
                        doc.rect(currentX + seatW, currentY, stuW, seatCellH).stroke();
                        doc.rect(currentX + seatW + stuW, currentY, stuW, seatCellH).stroke();

                        if (leftStu) {
                            const leftText = leftStu.student.registerNumber || leftStu.student.rollNo;
                            const textFontSize = leftText && leftText.length > 8 ? 7 : 8; // Increased font size
                            const textH = doc.fontSize(textFontSize).font('Helvetica').heightOfString(leftText, { width: stuW, lineBreak: false });
                            doc.text(leftText, currentX + seatW, currentY + (seatCellH / 2) - (textH / 2), { width: stuW, align: 'center', lineBreak: false });
                        }
                        if (rightStu) {
                            const rightText = rightStu.student.registerNumber || rightStu.student.rollNo;
                            const textFontSize = rightText && rightText.length > 8 ? 7 : 8; // Increased font size
                            const textH = doc.fontSize(textFontSize).font('Helvetica').heightOfString(rightText, { width: stuW, lineBreak: false });
                            doc.text(rightText, currentX + seatW + stuW, currentY + (seatCellH / 2) - (textH / 2), { width: stuW, align: 'center', lineBreak: false });
                        }
                    } else {
                        doc.rect(currentX + seatW, currentY, stuW * 2, seatCellH).stroke();
                        if (leftStu) {
                            const leftText = leftStu.student.registerNumber || leftStu.student.rollNo;
                            const textFontSize = leftText && leftText.length > 8 ? 7 : 8; // Increased font size
                            const textH = doc.fontSize(textFontSize).font('Helvetica').heightOfString(leftText, { width: stuW * 2, lineBreak: false });
                            doc.text(leftText, currentX + seatW, currentY + (seatCellH / 2) - (textH / 2), { width: stuW * 2, align: 'center', lineBreak: false });
                        }
                    }

                    currentX += blockW;
                });
                currentY += seatCellH;
            }

            const summaryY = currentY + 20;
            if (summaryY < 550) {
                const deptStats = {};
                hallAllocations.forEach(a => {
                    let dept = deptMap[a.department] || a.department;

                    const key = `${getRomanNumeral(a.year)} ${dept}`;
                    deptStats[key] = (deptStats[key] || 0) + 1;
                });

                const keys = Object.keys(deptStats);
                let statX = startX;
                const statW = 60;
                const statH = Object.keys(deptStats).some(k => k.length > 10) ? 25 : 15;

                keys.forEach(k => {
                    doc.rect(statX, summaryY, statW, statH).stroke();
                    const th = doc.fontSize(6).font('Helvetica-Bold').heightOfString(k, { width: statW - 4 });
                    doc.text(k, statX + 2, summaryY + (statH / 2) - (th / 2), { width: statW - 4, align: 'center' });
                    doc.rect(statX, summaryY + statH, statW, 15).stroke();
                    doc.fontSize(8).font('Helvetica').text(deptStats[k].toString(), statX, summaryY + statH + 4, { width: statW, align: 'center' });
                    statX += statW;
                });

                doc.rect(statX, summaryY, statW, statH).stroke();
                doc.fontSize(7).font('Helvetica-Bold').text('TOTAL', statX, summaryY + (statH / 2) - 4, { width: statW, align: 'center' });
                doc.rect(statX, summaryY + statH, statW, 15).stroke();
                doc.fontSize(8).font('Helvetica-Bold').text(hallAllocations.length.toString(), statX, summaryY + statH + 4, { width: statW, align: 'center' });

                doc.fontSize(10).font('Helvetica-Bold').text('CONTROLLER OF EXAMINATIONS', startX, summaryY + statH + 40, { width: availableWidth, align: 'right' });
            }
        });

        doc.end();
    } catch (error) {
        console.error("Grid Export Error:", error);
        res.status(500).json({ message: error.message });
    }
};

