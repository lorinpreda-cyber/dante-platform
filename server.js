const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const moment = require('moment');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const taskRoutes = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup - Simplified without layouts temporarily
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Make moment available in all templates
app.locals.moment = moment;

// Test route to verify server works
app.get('/test', (req, res) => {
  res.json({ 
    status: 'Server is working!', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Routes
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/tasks', taskRoutes);

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

// Error handler - Enhanced for debugging
app.use((err, req, res, next) => {
  console.error('=== SERVER ERROR ===');
  console.error('Error:', err);
  console.error('Stack:', err.stack);
  console.error('Request path:', req.path);
  console.error('Request method:', req.method);
  console.error('===================');
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    path: req.path
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Dante Platform server running on port ${PORT}`);
  console.log(`📍 Visit: http://localhost:${PORT}`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/test`);
  console.log(`🔐 Login: http://localhost:${PORT}/auth/login`);
});