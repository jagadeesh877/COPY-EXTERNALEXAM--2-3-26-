const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Checks for faculty or room clashes on a given day and period.
 * @param {Object} params - { day, period, facultyId, room, excludeTimetableId }
 * @returns {Promise<Object|null>} - Returns the conflicting timetable entry or null.
 */
const checkTimetableClash = async ({ day, period, facultyId, room, excludeTimetableId }) => {
    const where = {
        day,
        period,
        OR: []
    };

    if (facultyId) {
        where.OR.push({ facultyId: parseInt(facultyId) });
    }

    if (room && room.trim() !== '') {
        where.OR.push({ room: room.trim() });
    }

    if (where.OR.length === 0) return null;

    if (excludeTimetableId) {
        where.id = { not: parseInt(excludeTimetableId) };
    }

    return await prisma.timetable.findFirst({
        where,
        include: {
            faculty: { select: { fullName: true } },
            subject: { select: { name: true, code: true } }
        }
    });
};

/**
 * Checks if a faculty member is available for a substitution.
 * @param {Object} params - { facultyId, date, period }
 * @returns {Promise<Object|null>} - Returns conflict details or null.
 */
const checkFacultyAvailability = async ({ facultyId, date, period }) => {
    const fId = parseInt(facultyId);

    // 1. Check if marked absent
    const absence = await prisma.facultyAbsence.findFirst({
        where: {
            facultyId: fId,
            date,
            OR: [
                { period: 0 }, // Full day
                { period: parseInt(period) }
            ]
        }
    });

    if (absence) {
        return { type: 'ABSENCE', reason: absence.reason || 'Marked absent for this period' };
    }

    // 2. Check if already teaching their own class
    // We need to know the day of the week for the specific date
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const dayOfWeek = dayNames[new Date(date).getDay()];

    const teaching = await prisma.timetable.findFirst({
        where: {
            facultyId: fId,
            day: dayOfWeek,
            period: parseInt(period)
        },
        include: { subject: { select: { name: true } } }
    });

    if (teaching) {
        return { type: 'TEACHING', subject: teaching.subject?.name || 'Another class' };
    }

    // 3. Check if already assigned a substitution for this period
    const existingSub = await prisma.substitution.findFirst({
        where: {
            substituteFacultyId: fId,
            date,
            timetable: {
                period: parseInt(period)
            }
        }
    });

    if (existingSub) {
        return { type: 'SUBSTITUTION', details: 'Already handling another substitution' };
    }

    return null;
};

module.exports = {
    checkTimetableClash,
    checkFacultyAvailability
};
