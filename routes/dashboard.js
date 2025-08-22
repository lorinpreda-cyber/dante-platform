const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const dashboardController = require('../controllers/dashboardController');
const router = express.Router();

router.use(authMiddleware);
router.get('/', dashboardController.getDashboard);

module.exports = router;