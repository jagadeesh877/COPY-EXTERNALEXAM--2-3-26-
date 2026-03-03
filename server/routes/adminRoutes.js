const express = require('express');
const multer = require('multer');
const {
    getAllFaculty, createFaculty, deleteFaculty,
    getTimetable, saveTimetable,
    getAbsences, markFacultyAbsent, removeFacultyAbsence,
    getSubstitutions, assignSubstitute, deleteSubstitution, getFacultyAvailability
} = require('../controllers/adminController');
const {
    createStudent, updateStudent, getStudents, deleteStudent, promoteStudents, bulkUploadStudents, batchAssignRegisterNumbers
} = require('../controllers/studentController');
const {
    createSubject, getSubjects, deleteSubject, assignFaculty, removeFacultyAssignment
} = require('../controllers/subjectController');
const {
    getSessions, createSession, deleteSession, updateSessionSubjects,
    toggleSessionLock, getSessionAllocations, getHalls, addHall, deleteHall,
    generateAllocations, exportConsolidatedPlan, exportSeatingGrid
} = require('../controllers/hallAllocationController');
const {
    getSubjectMarksForAdmin, updateMarksForAdmin, getPendingMarks, getMarksForApproval,
    approveMarks, approveAllMarks, unapproveMarks, unlockMarks, getAllSubjectMarksStatus
} = require('../controllers/markEntryController');
const {
    getDashboardStats, exportAttendanceExcel
} = require('../controllers/reportController');
const {
    getDepartments, getSections, createSection, createDepartment, updateDepartment, deleteDepartment
} = require('../controllers/departmentController');
const { getAttendanceReport } = require('../controllers/attendanceController');
const { verifyToken, isAdmin, isHod } = require('../middleware/authMiddleware');
const { validateStudent, validateFaculty, validateSubject, validateMarks } = require('../middleware/validation');
const { uploadArrears, getArrears, deleteArrear } = require('../controllers/arrearController');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(verifyToken);
router.use(isHod); // Base access for HODs and Admins

router.get('/stats', getDashboardStats);

router.get('/timetable', getTimetable);
router.post('/timetable', saveTimetable);

router.get('/faculty', isAdmin, getAllFaculty); // Faculty management is SuperAdmin only
router.post('/faculty', isAdmin, validateFaculty, createFaculty);
router.delete('/faculty/:id', isAdmin, deleteFaculty);

router.get('/departments', isHod, getDepartments);
router.get('/sections', isHod, getSections);
router.post('/sections', isHod, createSection);
router.post('/departments', isAdmin, createDepartment);
router.put('/departments/:id', isAdmin, updateDepartment);
router.delete('/departments/:id', isAdmin, deleteDepartment);

router.get('/students', isHod, getStudents);
router.post('/students', isHod, validateStudent, createStudent);
router.put('/students/:id', isHod, validateStudent, updateStudent);
router.delete('/students/:id', isAdmin, deleteStudent); // Student deletion is SuperAdmin only

router.get('/subjects', isHod, getSubjects);
router.post('/subjects', isHod, validateSubject, createSubject);
router.delete('/subjects/:id', isAdmin, deleteSubject); // Subject deletion is SuperAdmin only

router.post('/assign-faculty', assignFaculty);
router.delete('/assign-faculty/:id', removeFacultyAssignment);

// Faculty Absence & Substitution Routes
router.get('/faculty-absences', getAbsences);
router.post('/faculty-absences', markFacultyAbsent);
router.options('/faculty-absences', (req, res) => res.sendStatus(200)); // Explicit OPTIONS handling
router.delete('/faculty-absences', removeFacultyAbsence); // Support query-based & cleanup deletion
router.delete('/faculty-absences/:id', removeFacultyAbsence);

router.get('/faculty/availability', getFacultyAvailability);
router.get('/substitutions', getSubstitutions);
router.post('/substitutions', assignSubstitute);
router.delete('/substitutions/:id', deleteSubstitution);

// Admin Marks Management
router.get('/marks/:subjectId', getSubjectMarksForAdmin);
router.post('/marks', validateMarks, updateMarksForAdmin);

// Marks Approval System
router.get('/marks-approval/pending', getPendingMarks);
router.get('/marks-approval/status', getAllSubjectMarksStatus);
router.get('/marks-approval/:subjectId', getMarksForApproval);
router.post('/marks-approval/approve', approveMarks);
router.post('/marks-approval/approve-all', approveAllMarks);
router.post('/marks-approval/unlock', unlockMarks);
router.post('/marks-approval/unapprove', unapproveMarks);

// Attendance Reports
router.get('/attendance/report', getAttendanceReport);
router.get('/attendance/export-excel', exportAttendanceExcel);

router.post('/students/promote', promoteStudents);
router.post('/students/bulk', bulkUploadStudents);
router.post('/students/batch-assign-register', batchAssignRegisterNumbers);

// Arrears
router.get('/arrears', getArrears);
router.post('/arrears/upload', upload.single('file'), uploadArrears);
router.delete('/arrears/:id', deleteArrear);

// Hall Allocation Routes
router.get('/hall-allocation/sessions', getSessions);
router.post('/hall-allocation/sessions', createSession);
router.delete('/hall-allocation/sessions/:id', deleteSession);
router.put('/hall-allocation/sessions/:id/subjects', updateSessionSubjects);
router.patch('/hall-allocation/sessions/:id/lock', toggleSessionLock);
router.get('/hall-allocation/sessions/:id/allocations', getSessionAllocations);
router.get('/hall-allocation/halls', getHalls);
router.post('/hall-allocation/halls', addHall);
router.delete('/hall-allocation/halls/:id', deleteHall);
router.post('/hall-allocation/generate', generateAllocations);
router.get('/hall-allocation/sessions/:id/export', exportConsolidatedPlan);
router.get('/hall-allocation/sessions/:id/export-grid', exportSeatingGrid);

module.exports = router;
