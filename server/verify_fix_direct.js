const { getDashboardStats } = require('./controllers/adminController');

// Mock Request and Response
const req = {};
const res = {
    json: (data) => {
        console.log('--- GET DASHBOARD STATS RESPONSE ---');
        console.log('Total Students:', data.students);
        console.log('Total Faculty:', data.faculty);
        console.log('Department Data (Filtered):');
        const relevant = data.departmentData.filter(d =>
            d.dept.includes('First Year') || d.dept.includes('MECHANICAL')
        );
        console.log(JSON.stringify(relevant, null, 2));
    },
    status: (code) => {
        console.log(`Status: ${code}`);
        return { json: (err) => console.log(err) };
    }
};

req.user = { id: 1, role: 'ADMIN' };

async function runTest() {
    try {
        await getDashboardStats(req, res);
    } catch (error) {
        console.error('Test Failed:', error);
    }
}

runTest();
