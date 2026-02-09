const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const logFile = 'debug_output_fix.txt';
function log(msg) {
    console.log(msg);
    fs.appendFileSync(logFile, msg + '\n');
}

// COPIED HELPER FROM CONTROLLER FOR VERIFICATION
const getDeptCriteria = async (deptString) => {
    if (!deptString) return {};
    const deptDef = await prisma.department.findFirst({
        where: { OR: [{ name: deptString }, { code: deptString }] }
    });
    // This is the key fix: It returns an IN clause with BOTH name and code if found
    if (deptDef) return { in: [deptDef.name, deptDef.code].filter(Boolean) };
    return deptString;
};

async function reproduce() {
    fs.writeFileSync(logFile, ''); // clear file
    log('--- Verifying Attendance Report Fix ---');

    // 1. Check for ANY department
    let dept = await prisma.department.findFirst();
    if (!dept) {
        log('No departments found. Creating "Computer Science" / "CSE"...');
        dept = await prisma.department.create({
            data: { name: 'Computer Science', code: 'CSE' }
        });
    }
    log(`Using Department: Name="${dept.name}", Code="${dept.code}"`);

    // 2. Ensure we have a student in this department (using NAME)
    let student = await prisma.student.findFirst({
        where: { department: dept.name }
    });
    if (!student) {
        log(`No student found in "${dept.name}". Creating one...`);
        student = await prisma.student.create({
            data: { registerNumber: 'TEST_' + Date.now(), name: 'Test Student', department: dept.name, year: 1, section: 'A', semester: 1 }
        });
    }
    log(`Testing with Student: ${student.name}, Stored Dept: "${student.department}"`);

    const frontendSends = dept.code || dept.name;
    log(`Scenario: Frontend sends "${frontendSends}", Database has Name "${student.department}"`);

    // 3. Test the FIX logic
    log(`\nApplying Fix Logic with input: "${frontendSends}"...`);

    const where = {};
    if (frontendSends) {
        where.department = await getDeptCriteria(frontendSends);
    }

    log(`Generated Prisma Query Query: ${JSON.stringify(where)}`);

    const studentsFound = await prisma.student.findMany({
        where: where
    });

    log(`Students found: ${studentsFound.length}`);

    if (studentsFound.length > 0) {
        log('[SUCCESS] Fix Verified: Students were found using Department CODE.');
    } else {
        log('[FAILURE] Fix Failed: No students found with Department CODE.');
    }
}

reproduce()
    .catch(e => log(e.toString()))
    .finally(async () => await prisma.$disconnect());
