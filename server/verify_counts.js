const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyCounts() {
    console.log('--- Verifying Department Stats Counting ---');

    // 1. Ensure we have a department with Name != Code
    const deptName = 'Test Engineering';
    const deptCode = 'TE';

    let dept = await prisma.department.findUnique({ where: { name: deptName } });
    if (!dept) {
        // cleanup if code exists but name different?
        await prisma.department.deleteMany({ where: { code: deptCode } });

        dept = await prisma.department.create({
            data: { name: deptName, code: deptCode }
        });
        console.log(`Created Department: ${deptName} (${deptCode})`);
    } else {
        // Ensure code matches
        if (dept.code !== deptCode) {
            await prisma.department.update({ where: { id: dept.id }, data: { code: deptCode } });
            console.log(`Updated Department Code to ${deptCode}`);
        }
    }

    // 2. Create a student linked by CODE
    const studentCode = 'COUNT_TEST_' + Date.now();
    await prisma.student.create({
        data: {
            registerNumber: studentCode,
            name: 'Count Test Student',
            department: deptCode, // <--- Key usage of CODE
            year: 2,
            section: 'A',
            semester: 3
        }
    });
    console.log(`Created Student linked to Department CODE: "${deptCode}"`);

    // 3. Run the Logic from adminController.js :: getDepartments
    // Logic: where: { department: dept.name }
    const strictCount = await prisma.student.count({
        where: { department: deptName }
    });

    console.log(`[CURRENT LOGIC] Count querying by Name "${deptName}": ${strictCount}`);

    // 4. Run the Proposed Fix Logic
    // Logic: where: { department: { in: [Name, Code] } }
    const fixCount = await prisma.student.count({
        where: {
            department: { in: [deptName, deptCode] }
        }
    });

    console.log(`[FIX LOGIC] Count querying by Name OR Code: ${fixCount}`);

    if (fixCount > strictCount) {
        console.log('\n[FAILURE] Current logic missed students stored by Code!');
        console.log('Admin Dashboard would show incorrect stats.');
    } else {
        console.log('\n[SUCCESS] Current logic works (or test setup failed).');
    }
}

verifyCounts()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
