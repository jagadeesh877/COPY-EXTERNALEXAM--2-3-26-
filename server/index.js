const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const compression = require('compression');

app.use(compression());

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use((req, res, next) => {
    console.log(`[REQUEST] ${req.method} ${req.url}`);
    next();
});

// Basic Health Check
app.get('/', (req, res) => {
    res.send('College ERP API is running');
});


const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const facultyRoutes = require('./routes/facultyRoutes');
const profileRoutes = require('./routes/profileRoutes');
const examRoutes = require('./routes/examRoutes');
const externalRoutes = require('./routes/externalRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const materialRoutes = require('./routes/materialRoutes');

// Routes will be imported here
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/exam', examRoutes);
app.use('/api/external', externalRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/dummy', require('./routes/dummyRoutes'));
app.use('/api/external/marks', require('./routes/externalMarkRoutes'));

const os = require('os');
const networkInterfaces = os.networkInterfaces();
let currentIp = 'localhost';

for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
        if (iface.family === 'IPv4' && !iface.internal) {
            currentIp = iface.address;
            break;
        }
    }
    if (currentIp !== 'localhost') break;
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on:`);
    console.log(`- Local:   http://localhost:${PORT}`);
    console.log(`- Network: http://${currentIp}:${PORT}`);
});
