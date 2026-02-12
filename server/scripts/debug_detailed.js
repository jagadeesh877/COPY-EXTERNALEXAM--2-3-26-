const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDetailedData() {
    try {
        console.log("--- Subjects ---");
        const subjects = await prisma.subject.findMany({
            where: { name: { contains: 'Design' } },
            select: { id: true, name: true, code: true, semester: true, department: true }
        });
        console.log(JSON.stringify(subjects, null, 2));

        if (subjects.length > 0) {
            const sub = subjects[0];
            console.log(`\nChecking mappings for Subject ID: ${sub.id} (${sub.name})`);
            const mappingCount = await prisma.subjectDummyMapping.count({
                where: { subjectId: sub.id }
            });
            console.log(`Mapping Count for this subject: ${mappingCount}`);

            const mappings = await prisma.subjectDummyMapping.findMany({
                where: { subjectId: sub.id }
            });
            if (mappings.length > 0) {
                console.log("Sample mapping details:");
                console.log(JSON.stringify(mappings[0], null, 2));
            }
        }

        console.log("\n--- Student Parameters Check ---");
        const studentParams = await prisma.student.findMany({
            where: {
                department: 'Mechanical',
                semester: 6,
                section: 'A'
            },
            take: 1
        });
        console.log("Sample student from filters:");
        console.log(JSON.stringify(studentParams[0], null, 2));

    } catch (err) {
        console.error("DEBUG ERROR:", err);
    }
}

checkDetailedData()
    .finally(() => prisma.$disconnect());
