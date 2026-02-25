const express = require('express');
const router = express.Router();
const dummyController = require('../controllers/dummyController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.post('/generate', verifyToken, isAdmin, dummyController.generateMapping);
router.get('/mapping', verifyToken, isAdmin, dummyController.getMapping);
router.post('/lock', verifyToken, isAdmin, dummyController.lockMapping);
router.post('/unlock', verifyToken, isAdmin, dummyController.unlockMapping);
router.post('/save', verifyToken, isAdmin, dummyController.saveMarks);

module.exports = router;
