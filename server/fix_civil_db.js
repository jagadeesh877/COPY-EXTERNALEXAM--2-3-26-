const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Fetching departments...");
    const depts = await prisma.department.findMany();

    // Find civil dept code
    const civilDept = depts.find(d => d.name.toLowerCase().includes('civil'));
    const civilCode = civilDept?.code || 'CIVIL';
    console.log("Using Code:", civilCode);

    // Fetch bad subjects
    const allSubs = await prisma.subject.findMany();
    const badSubs = allSubs.filter(s => s.department && s.department.toLowerCase().includes('civil') && s.department !== civilCode);

    console.log("Found bad subjects needing fix:", badSubs.map(s => ({ id: s.id, code: s.code, dept: s.department })));

    let updatedCount = 0;
    for (const sub of badSubs) {
        await prisma.subject.update({
            where: { id: sub.id },
            data: { department: civilCode }
        });
        updatedCount++;
    }

    console.log(`Successfully updated ${updatedCount} subjects.`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
