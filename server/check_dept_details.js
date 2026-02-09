const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDepts() {
    console.log('--- Checking First Year Details ---');
    const depts = await prisma.department.findMany({
        where: { OR: [{ name: 'First Year (General)' }, { name: { contains: 'Common' } }] }
    });
    depts.forEach(d => {
        console.log(`Name: "${d.name}", Code: "${d.code}", Sections: "${d.sections}", Years: "${d.years}"`);
    });
}

checkDepts().catch(console.error).finally(() => prisma.$disconnect());
