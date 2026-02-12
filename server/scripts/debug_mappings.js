const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMappings() {
    console.log("Checking SubjectDummyMapping Data...");
    const mappingCount = await prisma.subjectDummyMapping.count();
    console.log(`Total Mappings: ${mappingCount}`);

    const targetMappings = await prisma.subjectDummyMapping.findMany({
        where: {
            department: 'Mechanical',
            semester: 6,
            section: 'A',
            subjectId: 3 // Assuming subjectId from common data, but I should check what subjectId refers to Design of Transmission System
        }
    });
    console.log(`Mappings for target filters: ${targetMappings.length}`);

    // Let's find the subjectId for "Design of Transmission System"
    const subject = await prisma.subject.findFirst({
        where: { name: { contains: 'Design of Transmission System' } }
    });
    if (subject) {
        console.log(`Subject Found: ${subject.name} (ID: ${subject.id})`);
        const subMappings = await prisma.subjectDummyMapping.findMany({
            where: { subjectId: subject.id }
        });
        console.log(`Mappings for this subject: ${subMappings.length}`);
    } else {
        console.log("Subject not found!");
    }
}

checkMappings()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
