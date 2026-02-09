const { getDashboardStats } = require('./controllers/adminController');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const req = {};
const res = {
    json: (data) => {
        const genDept = data.departmentData.find(d => d.dept === 'First Year (General)');
        if (genDept) {
            console.log(`[VERIFY] First Year Stats -> Students: ${genDept.students}, Faculty: ${genDept.faculty}`);
        } else {
            console.log('[VERIFY] First Year Department NOT FOUND in response!');
        }
    },
    status: (code) => {
        return { json: (err) => console.log('Error:', err.message) };
    }
};

async function run() {
    console.log('--- Creating Dummy Faculty in "First Year (General)" ---');
    const dummy = await prisma.user.create({
        data: {
            username: 'gen_fac_test_' + Date.now(),
            password: 'hashedpassword',
            role: 'FACULTY',
            department: 'First Year (General)',
            fullName: 'Gen Faculty Tester'
        }
    });

    try {
        await getDashboardStats(req, res);
    } catch (e) {
        console.error(e);
    } finally {
        console.log('--- Cleanup ---');
        await prisma.user.delete({ where: { id: dummy.id } });
        await prisma.$disconnect();
    }
}

run();
