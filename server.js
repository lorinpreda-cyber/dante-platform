const express = require('express');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');
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
app.use(express.static('public'));

// View engine setup
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('layout', 'layout');

// Make moment available in all templates
app.locals.moment = moment;

// Routes
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/tasks', taskRoutes);

// Root route
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', { 
    error: 'Page not found',
    layout: false 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).render('error', { 
    error: 'Internal server error',
    layout: false 
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});