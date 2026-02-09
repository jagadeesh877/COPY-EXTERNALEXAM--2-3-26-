const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runSystemCheck() {
    console.log('=== SYSTEM INTEGRITY CHECK ===');
    const logs = [];
    const log = (msg) => { console.log(msg); logs.push(msg); };

    try {
        // 1. DATA SETUP
        log('\n[1] SETUP: Creating Test Data...');

        // Department vs Code Logic
        const deptName = 'System Check Engineering';
        const deptCode = 'SCE';

        let dept = await prisma.department.upsert({
            where: { name: deptName },
            update: { code: deptCode },
            create: { name: deptName, code: deptCode }
        });
        log(`- Department: ${dept.name} (${dept.code})`);

        // Create Faculty
        const facultyName = 'Faculty Test';
        const facultyUser = await prisma.user.create({
            data: {
                username: 'fac_test_' + Date.now(),
                password: 'hash',
                role: 'FACULTY',
                fullName: facultyName,
                department: deptName
            }
        });
        log(`- Faculty: ${facultyUser.fullName}`);

        // Create Subject
        const subject = await prisma.subject.create({
            data: {
                name: 'System Analysis',
                code: 'SA_' + Date.now(),
                department: deptName,
                semester: 3
            }
        });
        log(`- Subject: ${subject.name}`);

        // Create Student (Linked by CODE to test robustness)
        const student = await prisma.student.create({
            data: {
                registerNumber: 'SYS_' + Date.now(),
                name: 'System Student',
                department: deptCode, // <--- Linked by CODE
                year: 2,
                semester: 3,
                section: 'A'
            }
        });
        log(`- Student: ${student.name} (Dept: ${student.department})`);

        // Assign Faculty
        await prisma.facultyAssignment.create({
            data: {
                facultyId: facultyUser.id,
                subjectId: subject.id,
                section: 'A'
            }
        });
        log(`- Faculty Assigned to Subject/Section A`);


        // 2. TIMETABLE & CONFLICTS
        log('\n[2] TIMETABLE LOGIC...');

        // Create a slot
        const timetable = await prisma.timetable.create({
            data: {
                department: deptName,
                year: 2,
                semester: 3,
                section: 'A',
                day: 'MON',
                period: 1,
                subjectId: subject.id,
                facultyId: facultyUser.id
            }
        });
        log(`- Timetable Slot Created: MON Period 1`);

        // 3. ATTENDANCE & REPORTING
        log('\n[3] ATTENDANCE LOGIC...');

        // Mark Attendance
        await prisma.studentAttendance.create({
            data: {
                studentId: student.id,
                subjectId: subject.id,
                facultyId: facultyUser.id,
                date: '2026-02-10',
                status: 'PRESENT'
            }
        });
        log(`- Attendance Marked for Student`);

        // Verify Report Logic (Simulation)
        // This simulates the Controller Logic we fixed
        const deptCriteria = { in: [deptName, deptCode] };
        const reportStudents = await prisma.student.findMany({
            where: {
                department: { in: deptCriteria.in },
                // year: 2, // Optional logic checks
            },
            include: {
                attendance: { where: { date: '2026-02-10' } }
            }
        });

        if (reportStudents.length > 0) {
            log(`[SUCCESS] Report Logic found ${reportStudents.length} students (linked by Code).`);
        } else {
            log(`[FAILURE] Report Logic FAILED to find students.`);
        }

        // 4. MARKS ENTRY
        log('\n[4] MARKS LOGIC...');
        const marks = await prisma.marks.create({
            data: {
                studentId: student.id,
                subjectId: subject.id,
                cia1_test: 40,
                cia1_assignment: 10,
                internal: 50
            }
        });
        log(`- Marks entered: ${marks.internal}`);

        // Cleanup
        log('\n[CLEANUP] Deleting test data...');
        // Order matters for FK constraints
        await prisma.marks.deleteMany({ where: { studentId: student.id } });
        await prisma.studentAttendance.deleteMany({ where: { studentId: student.id } });
        await prisma.timetable.deleteMany({ where: { id: timetable.id } });
        await prisma.facultyAssignment.deleteMany({ where: { subjectId: subject.id } });
        await prisma.student.delete({ where: { id: student.id } });
        await prisma.subject.delete({ where: { id: subject.id } });
        await prisma.user.delete({ where: { id: facultyUser.id } });
        await prisma.department.deleteMany({ where: { id: dept.id } }).catch(() => { }); // might have other constraints

        log('\n=== SYSTEM CHECK COMPLETED ===');

    } catch (error) {
        log(`\n[CRITICAL ERROR] ${error.message}`);
        console.error(error);
    }
}

runSystemCheck()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
