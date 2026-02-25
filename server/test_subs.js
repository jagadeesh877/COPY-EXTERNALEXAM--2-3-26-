const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const mechanical6 = await prisma.subject.findMany({ where: { department: 'Mechanical', semester: 6 } });
    console.log('Mechanical Sem 6:', mechanical6.map(s => s.name));

    const allMechanical = await prisma.subject.findMany({ where: { department: 'Mechanical' } });
    console.log('All Mechanical:', allMechanical.map(s => s.name));

    const allSubjects = await prisma.subject.findMany();
    console.log('All Subjects count:', allSubjects.length);
    if (allSubjects.length > 0) {
        console.log('First subject:', allSubjects[0]);
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
