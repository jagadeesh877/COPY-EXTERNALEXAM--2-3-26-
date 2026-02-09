const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function checkStats() {
    const logFile = 'dashboard_debug.txt';
    const log = (msg) => { console.log(msg); fs.appendFileSync(logFile, msg + '\n'); };
    fs.writeFileSync(logFile, '');

    log('--- Checking Dashboard Stats Logic ---');

    // 1. Get raw groups from Student (what the controller does)
    const departments = await prisma.student.groupBy({
        by: ['department'],
        _count: { id: true }
    });
    log('Student Department Groups: ' + JSON.stringify(departments, null, 2));

    // 2. For each group, try to count faculty using CURRENT LOGIC vs FIXED LOGIC
    for (const group of departments) {
        const deptString = group.department;
        log(`\nEvaluating Group: "${deptString}"`);

        // Current Logic
        const currentCount = await prisma.user.count({
            where: {
                role: 'FACULTY',
                department: deptString === null ? { in: [null, '', 'First Year (General)'] } : deptString
            }
        });
        log(`[CURRENT LOGIC] Faculty Count: ${currentCount}`);

        // Proposed Fix Logic (Lookup Name/Code)
        let fixCount = 0;
        let matchedName = 'N/A';
        if (deptString) {
            const deptDef = await prisma.department.findFirst({
                where: { OR: [{ name: deptString }, { code: deptString }] }
            });

            if (deptDef) {
                const criteria = { in: [deptDef.name, deptDef.code].filter(Boolean) };
                matchedName = `${deptDef.name} / ${deptDef.code}`;
                fixCount = await prisma.user.count({
                    where: {
                        role: 'FACULTY',
                        department: criteria
                    }
                });
                log(`[FIX LOGIC] Matched Dept: ${matchedName}`);
            } else {
                log('[FIX LOGIC] Dept definition not found.');
            }
        }
        log(`[FIX LOGIC] Faculty Count: ${fixCount}`);
    }
}

checkStats()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
