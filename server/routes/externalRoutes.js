const express = require('express');
const router = express.Router();
const externalStaffController = require('../controllers/externalStaffController');
const { verifyToken, isAdmin, isExternalStaff } = require('../middleware/authMiddleware');

router.get('/assignments', verifyToken, isExternalStaff, externalStaffController.getAssignedAssignments);
router.get('/admin/assignments', verifyToken, isAdmin, externalStaffController.getAllAssignmentsForAdmin);
router.post('/admin/assign-mark-entry', verifyToken, isAdmin, externalStaffController.assignMarkEntry);
router.get('/admin/staff', verifyToken, isAdmin, externalStaffController.getAllExternalStaff);
router.post('/admin/staff', verifyToken, isAdmin, externalStaffController.createExternalStaff);
router.delete('/admin/staff/:id', verifyToken, isAdmin, externalStaffController.deleteExternalStaff);
router.delete('/admin/assignments/:id', verifyToken, isAdmin, externalStaffController.deleteAssignment);

module.exports = router;
