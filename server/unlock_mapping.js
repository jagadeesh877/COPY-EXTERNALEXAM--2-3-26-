const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Unlocking Dummy Mappings for MECH, Sem 6...");
    const updated = await prisma.subjectDummyMapping.updateMany({
        where: {
            department: 'MECH',
            semester: 6,
            mappingLocked: true
        },
        data: {
            mappingLocked: false
        }
    });

    console.log(`Successfully unlocked ${updated.count} records!`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
