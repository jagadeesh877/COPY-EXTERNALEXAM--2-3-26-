const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
const { handleError } = require('../utils/errorUtils');
const { checkTimetableClash, checkFacultyAvailability } = require('../utils/clashUtils');

// --- Faculty Management ---

const getAllFaculty = async (req, res) => {
    try {
        const faculty = await prisma.user.findMany({
            where: { role: 'FACULTY' },
            select: { id: true, username: true, fullName: true, department: true, createdAt: true }
        });
        res.json(faculty);
    } catch (error) {
        handleError(res, error, "Error fetching faculty");
    }
};

const createFaculty = async (req, res) => {
    const { username, password, fullName, department } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newFaculty = await prisma.user.create({
            data: {
                username,
                password: hashedPassword,
                role: 'FACULTY',
                fullName,
                department
            }
        });
        res.status(201).json({ message: 'Faculty created', faculty: { username, fullName } });
    } catch (error) {
        handleError(res, error, "Error creating faculty");
    }
};

const deleteFaculty = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.user.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Faculty deleted' });
    } catch (error) {
        handleError(res, error, "Error deleting faculty");
    }
};
// --- Timetable Management ---

const getTimetable = async (req, res) => {
    try {
        const { department, year, semester, section, facultyId, day } = req.query;

        // Mode 1: Faculty Specific Schedule (used in Faculty Manager Duty Control)
        if (facultyId) {
            const timetable = await prisma.timetable.findMany({
                where: {
                    facultyId: parseInt(facultyId),
                    ...(day && { day: day.toUpperCase() })
                },
                include: { subject: true, faculty: true }
            });
            return res.json(timetable);
        }

        // Mode 2: Grid-based filtering (Admin Timetable Manager)
        if (!department || !year || !semester || !section) {
            console.log(`[TT_v2.1] Skipping fetch: Missing context`);
            return res.json([]);
        }

        const timetable = await prisma.timetable.findMany({
            where: {
                department: department,
                year: parseInt(year),
                semester: parseInt(semester),
                section: section
            },
            include: { subject: true, faculty: true }
        });
        res.json(timetable);
    } catch (error) {
        handleError(res, error, "Error fetching timetable");
    }
};

const saveTimetable = async (req, res) => {
    const { entries, department, year, semester, section } = req.body;
    console.log(`[Timetable] Saving: ${department} Y${year} S${semester} Sec${section} - ${entries?.length || 0} entries`);
    try {
        if (!department || !year || !semester || !section) {
            return res.status(400).json({ message: "Missing filter context for saving timetable" });
        }

        const yr = parseInt(year);
        const sem = parseInt(semester);

        // --- Clash Detection (Bulk Validation) ---
        for (const e of entries) {
            if (!e.day || !e.period) continue;

            const clash = await checkTimetableClash({
                day: e.day,
                period: e.period,
                facultyId: e.facultyId,
                room: e.room
            });

            if (clash) {
                // If the clash is from ANOTHER section/year/department, reject it
                const isSameSlot = clash.department === department &&
                    clash.year === yr &&
                    clash.semester === sem &&
                    clash.section === section;

                if (!isSameSlot) {
                    return res.status(409).json({
                        message: `Clash detected for Period ${e.period} (${e.day})`,
                        details: `Faculty ${clash.faculty?.fullName || 'Teacher'} or Room ${clash.room} is already occupied by ${clash.department} Y${clash.year} ${clash.section}.`
                    });
                }
            }
        }

        await prisma.$transaction(async (tx) => {
            // 1. Delete ALL existing entries for this specific combination
            await tx.timetable.deleteMany({
                where: {
                    department,
                    year: yr,
                    semester: sem,
                    section
                }
            });

            // 2. Insert new entries
            if (entries.length > 0) {
                await tx.timetable.createMany({
                    data: entries.map(e => ({
                        department,
                        year: yr,
                        semester: sem,
                        section,
                        day: e.day,
                        period: e.period,
                        duration: e.duration || 1,
                        type: e.type,
                        subjectName: e.subjectName,
                        facultyName: e.facultyName,
                        room: e.room,
                        subjectId: e.subjectId,
                        facultyId: e.facultyId
                    }))
                });
            }
        });

        res.json({ message: "Timetable updated successfully" });
    } catch (error) {
        handleError(res, error, "Error saving timetable");
    }
};

// --- Faculty Absence & Substitution ---

const getAbsences = async (req, res) => {
    try {
        const absences = await prisma.facultyAbsence.findMany({
            include: { faculty: true }
        });
        res.json(absences);
    } catch (error) {
        handleError(res, error, "Error fetching absences");
    }
};

const markFacultyAbsent = async (req, res) => {
    const { facultyId, date, reason } = req.body;
    try {
        const fId = parseInt(facultyId);

        // Prevent duplicate absences for same day (Full Day)
        const existing = await prisma.facultyAbsence.findFirst({
            where: { facultyId: fId, date, period: 0 }
        });
        if (existing) return res.status(400).json({ message: 'Already marked absent for this date' });

        await prisma.facultyAbsence.create({
            data: { facultyId: fId, date, reason, period: 0 }
        });
        res.json({ message: 'Marked absent' });
    } catch (error) {
        handleError(res, error, "Error marking absence");
    }
};

const removeFacultyAbsence = async (req, res) => {
    const { id } = req.params;
    const { facultyId, date, period, cleanup } = req.query;

    try {
        if (id) {
            await prisma.facultyAbsence.delete({ where: { id: parseInt(id) } });
            return res.json({ message: 'Absence removed' });
        }

        if (!facultyId || !date) {
            return res.status(400).json({ message: "Missing facultyId or date for removal" });
        }

        const fId = parseInt(facultyId);

        if (cleanup === 'true') {
            const mySlots = await prisma.timetable.findMany({
                where: { facultyId: fId },
                select: { id: true }
            });
            const slotIds = mySlots.map(s => s.id);

            await prisma.substitution.deleteMany({
                where: {
                    date: date,
                    timetableId: { in: slotIds }
                }
            });
        }

        await prisma.facultyAbsence.deleteMany({
            where: {
                facultyId: fId,
                date: date,
                ...(period && { period: parseInt(period) })
            }
        });

        res.json({ message: 'Absence(s) removed' });
    } catch (error) {
        handleError(res, error, "Error removing absence");
    }
};

const getSubstitutions = async (req, res) => {
    try {
        const subs = await prisma.substitution.findMany({
            include: {
                timetable: {
                    include: { subject: true, faculty: true }
                },
                substituteFaculty: true
            }
        });
        res.json(subs);
    } catch (error) {
        handleError(res, error, "Error fetching substitutions");
    }
};

const assignSubstitute = async (req, res) => {
    const { timetableId, substituteFacultyId, date } = req.body;
    try {
        const ttId = parseInt(timetableId);
        const subFId = parseInt(substituteFacultyId);

        // 1. Fetch timetable context for availability check
        const ttSlot = await prisma.timetable.findUnique({
            where: { id: ttId }
        });

        if (!ttSlot) return res.status(404).json({ message: 'Timetable slot not found' });

        // 2. Perform availability check
        const availabilityConflict = await checkFacultyAvailability({
            facultyId: subFId,
            date,
            period: ttSlot.period
        });

        if (availabilityConflict) {
            let reasonStr = "Faculty is unavailable";
            if (availabilityConflict.type === 'ABSENCE') reasonStr = "Faculty is marked as ABSENT for this period.";
            if (availabilityConflict.type === 'TEACHING') reasonStr = `Faculty is already teaching "${availabilityConflict.subject}" during this period.`;
            if (availabilityConflict.type === 'SUBSTITUTION') reasonStr = "Faculty is already handling another substitution during this period.";

            return res.status(409).json({
                message: "Substitution conflict",
                details: reasonStr
            });
        }

        const sub = await prisma.substitution.upsert({
            where: {
                timetableId_date: {
                    timetableId: ttId,
                    date
                }
            },
            update: { substituteFacultyId: subFId },
            create: {
                timetableId: ttId,
                substituteFacultyId: subFId,
                date
            }
        });
        res.json(sub);
    } catch (error) {
        handleError(res, error, "Error assigning substitute");
    }
};

const deleteSubstitution = async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.substitution.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Substitution deleted' });
    } catch (error) {
        handleError(res, error, "Error deleting substitution");
    }
};

const getFacultyAvailability = async (req, res) => {
    const { date, period } = req.query;
    try {
        if (!date || !period) {
            return res.status(400).json({ message: "Date and period are required" });
        }

        const faculty = await prisma.user.findMany({
            where: { role: 'FACULTY', isDisabled: false },
            select: { id: true, fullName: true, department: true }
        });

        const availabilityPromises = faculty.map(async (f) => {
            const conflict = await checkFacultyAvailability({
                facultyId: f.id,
                date,
                period
            });
            return {
                ...f,
                conflict: conflict
            };
        });

        const results = await Promise.all(availabilityPromises);
        res.json(results);
    } catch (error) {
        handleError(res, error, "Error checking faculty availability");
    }
};

module.exports = {
    getAllFaculty,
    createFaculty,
    deleteFaculty,
    getTimetable,
    saveTimetable,
    getAbsences,
    markFacultyAbsent,
    removeFacultyAbsence,
    getSubstitutions,
    assignSubstitute,
    deleteSubstitution,
    getFacultyAvailability
};
