const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');

const app = express();
const PORT = process.env.PORT || 3000; // Railway will automatically set PORT

// Import tasks route
const taskRoutes = require('./routes/tasks');

console.log('🚀 Starting Dante Platform...');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Port:', PORT);

// Production-ready CORS
app.use(cors({ 
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://*.railway.app', process.env.FRONTEND_URL] 
    : true, 
  credentials: true 
}));

// Trust proxy (needed for Railway)
app.set('trust proxy', 1);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Health check endpoint (Railway uses this)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    status: 'Server is working!', 
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes
app.use('/auth', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/tasks', taskRoutes);


// Root redirect
app.get('/', (req, res) => {
  res.redirect('/auth/login');
});

// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  console.error(err.stack);
  res.status(500).send(`Server Error: ${err.message}`);
});

// 404 handler
app.use((req, res) => {
  console.log('❌ 404 - Route not found:', req.url);
  res.status(404).send(`Page not found: ${req.url}`);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Dante platform running on port ${PORT}`);
  console.log(`📧 Admin login: lorin.preda@konecta.com`);
  console.log(`🔑 Admin password: AdminPass123!`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;