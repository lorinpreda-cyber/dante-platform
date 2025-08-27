const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const adminController = require('../controllers/adminController');
const router = express.Router();

router.use(authMiddleware);

// Admin only middleware
const adminOnly = (req, res, next) => {
  if (req.profile.role !== 'admin') {
    return res.status(403).render('error', { 
      error: 'Admin access required' 
    });
  }
  next();
};

router.use(adminOnly);

router.get('/', adminController.getDashboard);
router.post('/events/:id/approve', adminController.postApproveEvent);

module.exports = router;