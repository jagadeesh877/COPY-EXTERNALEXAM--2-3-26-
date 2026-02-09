const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkFaculty() {
    console.log('--- Checking Faculty Departments ---');
    const faculty = await prisma.user.findMany({
        where: { role: 'FACULTY' },
        select: { username: true, department: true }
    });
    console.log(faculty);
}

checkFaculty().catch(console.error).finally(() => prisma.$disconnect());
