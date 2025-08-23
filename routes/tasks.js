const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const taskController = require('../controllers/taskController');
const router = express.Router();

router.use(authMiddleware);

router.get('/', taskController.getTasks);
router.get('/create', taskController.getCreateTask);
router.post('/create', taskController.postCreateTask);
router.get('/:id', taskController.getTaskDetails);
router.post('/:id/update', taskController.postUpdateTask);
router.post('/:id/complete', taskController.postCompleteTask);

module.exports = router;