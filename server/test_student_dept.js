const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const st = await prisma.student.findMany();
    console.log(st.map(s => ({ id: s.id, dept: s.department })));
}
main().finally(() => prisma.$disconnect());
