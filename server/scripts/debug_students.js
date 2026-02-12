const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
    console.log("Checking Student Data...");
    const studentCount = await prisma.student.count();
    console.log(`Total Students: ${studentCount}`);

    const mechanicalStudents = await prisma.student.findMany({
        where: { department: 'Mechanical' }
    });
    console.log(`Mechanical Students: ${mechanicalStudents.length}`);

    const grouped = await prisma.student.groupBy({
        by: ['department', 'semester', 'section'],
        _count: { id: true }
    });
    console.log("Students grouped by Dept/Sem/Section:");
    console.table(grouped);

    const targetStudents = await prisma.student.findMany({
        where: {
            department: 'Mechanical',
            semester: 6,
            section: 'A'
        }
    });
    console.log(`Students for Mechanical/Sem 6/Section A: ${targetStudents.length}`);
}

checkData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
