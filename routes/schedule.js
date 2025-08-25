const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Remove requireAuth and requireAdmin from individual routes
router.get('/', scheduleController.renderAdvancedSchedule);
router.get('/data', scheduleController.getScheduleData);
router.post('/assign', scheduleController.assignShift); // Add admin check inside controller
router.post('/remove', scheduleController.removeShift);
router.post('/bulk-assign', scheduleController.bulkAssignShifts);
router.post('/copy', scheduleController.copyShifts);
router.get('/currently-working', scheduleController.getCurrentlyWorking);

// Personal events routes
router.get('/my-events', scheduleController.renderPersonalEvents);
router.post('/events', scheduleController.createPersonalEvent);
router.put('/events/:id', scheduleController.updatePersonalEvent);
router.delete('/events/:id', scheduleController.deletePersonalEvent);

module.exports = router;