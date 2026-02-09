const { getDashboardStats } = require('./controllers/adminController');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const req = {};
const res = {
    json: (data) => {
        console.log('--- DASHBOARD STATS ---');
        console.log('Total entries:', data.departmentData.length);
        data.departmentData.forEach(d => {
            console.log(`Dept: "${d.dept}" | Students: ${d.students} | Faculty: ${d.faculty}`);
        });
    },
    status: (code) => {
        return { json: (err) => console.log('Error:', err.message) };
    }
};

async function verify() {
    try {
        console.log('--- CHECKING DB ---');
        const depts = await prisma.department.findMany();
        console.log('DB Departments:', depts.map(d => d.name));

        await getDashboardStats(req, res);
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
