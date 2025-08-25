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
// FIX: Remove requireAuth since authMiddleware already handles authentication
router.get('/check-availability', taskController.checkUserAvailability);

// ROUTINE ROUTES (MUST come before /:id routes)
router.get('/my-routine', taskController.getMyRoutine);
router.get('/my-routine/create', taskController.getCreateRoutine);
router.post('/my-routine/create', taskController.postCreateRoutine);
router.get('/team-routines', taskController.getTeamRoutines);
router.get('/my-routine/:id', taskController.getRoutineDetails);
router.post('/my-routine/:id/update', taskController.postUpdateRoutine);
router.delete('/my-routine/:id', taskController.deleteRoutine);

// Schedule Routes (MUST come before /:id routes)
router.get('/schedule', taskController.getSchedule);
router.post('/schedule/create', taskController.postCreateScheduledTask);
router.post('/schedule/:id/update', taskController.postUpdateScheduledTask);
router.delete('/schedule/:id', taskController.deleteScheduledTask);

// Individual Task Routes (MUST come after routine and schedule routes)
router.get('/:id', taskController.getTaskDetails);
router.post('/:id/update', taskController.postUpdateTask);
router.post('/:id/complete', taskController.postCompleteTask);
router.post('/:id/assign', taskController.postAssignTask);
router.post('/:id/comments', taskController.postAddComment);

module.exports = router;