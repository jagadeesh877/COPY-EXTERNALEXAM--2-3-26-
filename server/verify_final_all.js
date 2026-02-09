const { getDashboardStats } = require('./controllers/adminController');

const req = {};
const res = {
    json: (data) => {
        console.log('--- DASHBOARD STATS (ALL) ---');
        data.departmentData.forEach(d => {
            console.log(`Dept: "${d.dept}" | Students: ${d.students} | Faculty: ${d.faculty}`);
        });
    },
    status: (code) => {
        return { json: (err) => console.log('Error:', err.message) };
    }
};

getDashboardStats(req, res).catch(console.error);
