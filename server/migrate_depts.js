const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Fetching all departments...");
    const depts = await prisma.department.findMany();

    // Create a mapping of full name to short code
    const deptMapping = {};
    for (const d of depts) {
        if (d.code) {
            deptMapping[d.name] = d.code;
            // Also map lowercase versions just in case
            deptMapping[d.name.toLowerCase()] = d.code;
        }
    }

    // Add common variations
    deptMapping['Civil Engineering'] = 'CIVIL';
    deptMapping['Computer Science and Engineering'] = 'CSE';
    deptMapping['Computer Science'] = 'CSE';
    deptMapping['Mechanical Engineering'] = 'MECH';
    deptMapping['Mechanical'] = 'MECH';
    deptMapping['Electronics and Communication Engineering'] = 'ECE';
    deptMapping['Electronics'] = 'ECE';
    deptMapping['Electrical and Electronics Engineering'] = 'EEE';
    deptMapping['Electrical'] = 'EEE';
    deptMapping['First Year (General)'] = 'GEN';

    console.log("Migration Mapping:", deptMapping);

    // 1. Update Students
    console.log("Updating Students...");
    const students = await prisma.student.findMany();
    let studentCount = 0;
    for (const s of students) {
        if (s.department && deptMapping[s.department]) {
            await prisma.student.update({
                where: { id: s.id },
                data: { department: deptMapping[s.department] }
            });
            studentCount++;
        }
    }
    console.log(`Updated ${studentCount} students.`);

    // 2. Update Users
    console.log("Updating Users (Faculty)...");
    const users = await prisma.user.findMany();
    let userCount = 0;
    for (const u of users) {
        if (u.department && deptMapping[u.department]) {
            await prisma.user.update({
                where: { id: u.id },
                data: { department: deptMapping[u.department] }
            });
            userCount++;
        }
    }
    console.log(`Updated ${userCount} users.`);

    // 3. Update Timetables
    console.log("Updating Timetables...");
    const timetables = await prisma.timetable.findMany();
    let ttCount = 0;
    for (const tt of timetables) {
        if (tt.department && deptMapping[tt.department]) {
            await prisma.timetable.update({
                where: { id: tt.id },
                data: { department: deptMapping[tt.department] }
            });
            ttCount++;
        }
    }
    console.log(`Updated ${ttCount} timetables.`);

    // 4. Update Subjects
    console.log("Updating Subjects...");
    const subjects = await prisma.subject.findMany();
    let subCount = 0;
    for (const sub of subjects) {
        if (sub.department && deptMapping[sub.department]) {
            await prisma.subject.update({
                where: { id: sub.id },
                data: { department: deptMapping[sub.department] }
            });
            subCount++;
        }
    }
    console.log(`Updated ${subCount} subjects.`);

    // 5. Update Announcements
    console.log("Updating Announcements...");
    const announcements = await prisma.announcement.findMany();
    let annCount = 0;
    for (const ann of announcements) {
        if (ann.department && deptMapping[ann.department]) {
            await prisma.announcement.update({
                where: { id: ann.id },
                data: { department: deptMapping[ann.department] }
            });
            annCount++;
        }
    }
    console.log(`Updated ${annCount} announcements.`);

    // 6. Update Dummy mappings
    console.log("Updating Dummy Mappings...");
    const mappings = await prisma.subjectDummyMapping.findMany();
    let mapCount = 0;
    for (const m of mappings) {
        if (m.department && deptMapping[m.department]) {
            await prisma.subjectDummyMapping.update({
                where: { id: m.id },
                data: { department: deptMapping[m.department] }
            });
            mapCount++;
        }
    }
    console.log(`Updated ${mapCount} dummy mappings.`);

    console.log("Database migration complete!");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
