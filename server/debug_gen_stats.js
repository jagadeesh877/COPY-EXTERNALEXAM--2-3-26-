const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugGen() {
    console.log('--- Debugging First Year (General) Stats ---');

    // 1. Create a First Year Student (Dept = null)
    const student = await prisma.student.create({
        data: {
            registerNumber: 'GEN_TEST_' + Date.now(),
            name: 'Gen Student',
            department: null, // First Year
            year: 1,
            semester: 1,
            section: 'A'
        }
    });
    console.log('Created Student with department: null');

    try {
        // 2. Simulate getDashboardStats Logic
        const departments = await prisma.student.groupBy({
            by: ['department'],
            _count: { id: true }
        });
        console.log('Grouped Depts:', departments);

        const departmentData = await Promise.all(departments.map(async (dept) => {
            const deptName = dept.department;
            console.log(`Processing Group: "${deptName}"`);

            let whereClause = { role: 'FACULTY' };

            if (!deptName || deptName === 'First Year (General)') {
                // Fix: Use OR for nullable/empty checks instead of "in: [null]"
                whereClause.OR = [
                    { department: null },
                    { department: '' },
                    { department: 'First Year (General)' }
                ];
                console.log('Criteria set to First Year (General) Mode (OR Logic)');
            } else {
                const deptDef = await prisma.department.findFirst({
                    where: { OR: [{ name: deptName }, { code: deptName }] }
                });
                if (deptDef) {
                    whereClause.department = { in: [deptDef.name, deptDef.code].filter(Boolean) };
                } else {
                    whereClause.department = deptName;
                }
            }
            console.log('Query Where:', JSON.stringify(whereClause));

            // CRITICAL STEP: The query that might fail or return 0
            const facultyInDept = await prisma.user.count({
                where: whereClause
            });
            console.log(`Faculty Count for ${deptName}: ${facultyInDept}`);

            return {
                dept: dept.department || 'First Year (General)',
                students: dept._count.id,
                faculty: facultyInDept
            };
        }));

        console.log('Result:', departmentData);

    } catch (error) {
        console.error('CRASHED:', error);
    } finally {
        // Cleanup
        await prisma.student.delete({ where: { id: student.id } });
        await prisma.$disconnect();
    }
}

debugGen();
