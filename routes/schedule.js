const express = require('express');
const router = express.Router();
const scheduleController = require('../controllers/scheduleController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Schedule management routes
router.get('/', requireAuth, scheduleController.renderAdvancedSchedule);
router.get('/data', requireAuth, scheduleController.getScheduleData);
router.post('/assign', requireAdmin, scheduleController.assignShift);
router.post('/remove', requireAdmin, scheduleController.removeShift);
router.post('/bulk-assign', requireAdmin, scheduleController.bulkAssignShifts);
router.post('/copy', requireAdmin, scheduleController.copyShifts);
router.get('/currently-working', requireAuth, scheduleController.getCurrentlyWorking);

// Personal events routes
router.get('/my-events', requireAuth, scheduleController.renderPersonalEvents);
router.post('/events', requireAuth, scheduleController.createPersonalEvent);
router.put('/events/:id', requireAuth, scheduleController.updatePersonalEvent);
router.delete('/events/:id', requireAuth, scheduleController.deletePersonalEvent);

module.exports = router;