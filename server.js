require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Route Imports
const authRoutes = require('./routes/auth');
const itemsRoutes = require('./routes/items');
const pricesRoutes = require('./routes/prices');
const notificationsRoutes = require('./routes/notifications');
const comparisonRoutes = require('./routes/comparison');
const searchRoutes = require('./routes/search');
const adminRoutes = require('./routes/admin');
const savedProductsRoutes = require('./routes/savedProducts');
const couponsRoutes = require('./routes/coupons');

// Scheduler Import
const scheduler = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 4000;

// Connect to Database
connectDB().then(() => {
  // Start node-cron scheduler after DB connects
  scheduler.startScheduler();
}).catch((err) => {
  console.error('Failed to connect to database. Scheduler not started.', err.message);
});

// Middleware
app.use(cors({
  origin: '*', // For development, allow all origins. Can be restricted to frontend URL in production
  methods: ['GET', 'POST', 'DELETE', 'PATCH', 'PUT', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Bind API Routes
app.use('/api/auth', authRoutes);
app.use('/api/items', itemsRoutes);
app.use('/api/prices', pricesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/comparison', comparisonRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/saved-products', savedProductsRoutes);
app.use('/api/coupons', couponsRoutes);

// Base route for health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'PriceDekho backend is running' });
});

// Global Error Handler (Must be registered last)
app.use(errorHandler);

// Start Express Server
const server = app.listen(PORT, () => {
  console.log(`Express server listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// Graceful Shutdown Handler
const gracefulShutdown = async () => {
  console.log('Shutdown signal received. Cleaning up processes...');
  server.close(() => {
    console.log('HTTP server closed.');
  });
  
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed.');
    process.exit(0);
  } catch (err) {
    console.error('Error during MongoDB disconnect:', err.message);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
