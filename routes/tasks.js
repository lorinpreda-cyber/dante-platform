const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const taskController = require('../controllers/taskController');
const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Regular Task Routes
router.get('/', taskController.getTasks);
router.get('/create', taskController.getCreateTask);
router.post('/create', taskController.postCreateTask);

// Schedule Routes (must come before /:id routes to avoid conflicts)
router.get('/schedule', taskController.getSchedule);
router.post('/schedule/create', taskController.postCreateScheduledTask);
router.post('/schedule/:id/update', taskController.postUpdateScheduledTask);
router.delete('/schedule/:id', taskController.deleteScheduledTask);

// Individual Task Routes (these should come after schedule routes)
router.get('/:id', taskController.getTaskDetails);
router.post('/:id/update', taskController.postUpdateTask);
router.post('/:id/complete', taskController.postCompleteTask);
router.post('/:id/assign', taskController.postAssignTask);
router.post('/:id/comments', taskController.postAddComment);

module.exports = router;