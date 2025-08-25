const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.redirect('/login');
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).render('error', { error: 'Admin access required' });
  }
  next();
};

module.exports = {
  requireAuth,
  requireAdmin
};