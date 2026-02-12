const express = require('express');
const router = express.Router();
const dummyController = require('../controllers/dummyController');
const { verifyToken, isAdmin } = require('../middleware/authMiddleware');

router.post('/generate', verifyToken, isAdmin, dummyController.generateMapping);
router.get('/mapping', verifyToken, isAdmin, dummyController.getMapping);
router.post('/lock', verifyToken, isAdmin, dummyController.lockMapping);

module.exports = router;
