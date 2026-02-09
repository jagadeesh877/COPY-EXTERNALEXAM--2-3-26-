const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const logFile = 'debug_output.txt';
function log(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

async function reproduce() {
    fs.writeFileSync(logFile, ''); // clear file
    log('--- Debugging Attendance Report Issue ---');

    // 1. Find a student
    const student = await prisma.student.findFirst();
    if (!student) {
        log('No students found in the database. Cannot reproduce.');
        return;
    }

    log(`Found Student: ${student.name}, Department: "${student.department}"`);

    // 2. Find the Department definition
    const deptDef = await prisma.department.findFirst({
        where: { name: student.department }
    });

    if (!deptDef) {
        log(`WARNING: No Department definition found for name "${student.department}"`);
        const deptByCode = await prisma.department.findFirst({ where: { code: student.department } });
        if (deptByCode) {
            log(`Wait, the student.department holds the CODE, not the Name. Dept Name: ${deptByCode.name}`);
        } else {
            log(`No department found with code "${student.department}" either.`);
        }
    } else {
        log(`Department Definition: Name="${deptDef.name}", Code="${deptDef.code}"`);
    }

    // 3. Simulate Frontend Request
    let frontendSends = '';
    if (deptDef) {
        frontendSends = deptDef.code || deptDef.name;
    } else {
        // Fallback
        frontendSends = student.department;
    }

    log(`Frontend likely sends: "${frontendSends}"`);

    // 4. Simulate Controller Query
    const where = {};
    if (frontendSends) where.department = frontendSends;

    const studentsFound = await prisma.student.findMany({
        where: where
    });

    log(`Controller query with where.department="${frontendSends}" found: ${studentsFound.length} students`);

    if (studentsFound.length === 0) {
        log('[FAILURE] Controller found 0 students due to mismatch.');
    } else {
        log('[SUCCESS] Controller found students.');
    }

    // 5. Check actual attendance for these students
    if (studentsFound.length > 0) {
        const sIds = studentsFound.map(s => s.id);
        const attendance = await prisma.studentAttendance.findMany({
            where: {
                studentId: { in: sIds }
            }
        });
        log(`Found ${attendance.length} attendance records for these students.`);
    }
}

reproduce()
    .catch(e => log(e.toString()))
    .finally(async () => await prisma.$disconnect());
