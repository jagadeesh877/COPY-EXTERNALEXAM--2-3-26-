const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('--- Departments ---');
    const depts = await prisma.department.findMany();
    console.log(depts);

    console.log('\n--- Student Groups ---');
    const groups = await prisma.student.groupBy({
        by: ['department'],
        _count: true
    });
    console.log(groups);
}

check().catch(console.error).finally(() => prisma.$disconnect());
