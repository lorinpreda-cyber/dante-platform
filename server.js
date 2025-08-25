const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const moment = require('moment');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const taskRoutes = require('./routes/tasks');
const scheduleRoutes = require('./routes/schedule');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Make moment available in all templates
app.locals.moment = moment;

// Routes
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/tasks', taskRoutes);
app.use('/schedule', scheduleRoutes);
// Root route
app.get('/', (req, res) => {
  res.redirect('/auth/login');
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Page not found',
    path: req.path 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

app.listen(PORT, () => {
  console.log(`Dante Platform server running on port ${PORT}`);
  console.log(`Visit: http://localhost:${PORT}`);
  console.log(`Login: http://localhost:${PORT}/auth/login`);
});