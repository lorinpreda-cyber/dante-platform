const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const scheduleController = require('../controllers/scheduleController');
const router = express.Router();

router.use(authMiddleware);

// Schedule routes
router.get('/', scheduleController.getSchedule);
router.get('/my-events', scheduleController.getMyEvents);

// Event management routes
router.post('/events', scheduleController.postCreateEvent);
router.put('/events/:id', scheduleController.putUpdateEvent);
router.delete('/events/:id', scheduleController.deleteEvent);

module.exports = router;