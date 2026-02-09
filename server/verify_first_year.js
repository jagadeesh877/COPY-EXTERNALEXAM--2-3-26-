const { getDashboardStats } = require('./controllers/adminController');

const req = {};
const res = {
    json: (data) => {
        console.log('--- DASHBOARD STATS (First Year ONLY) ---');
        const fy = data.departmentData.find(d => d.dept === 'First Year (General)');
        if (fy) {
            console.log(`Dept: "${fy.dept}" | Students: ${fy.students} | Faculty: ${fy.faculty}`);
        } else {
            console.log('First Year (General) NOT FOUND in response');
        }
    },
    status: (code) => {
        return { json: (err) => console.log('Error:', err.message) };
    }
};

getDashboardStats(req, res).catch(console.error);
