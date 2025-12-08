const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { sequelize } = require('./models');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const ambassadorRoutes = require('./routes/ambassadorRoutes');
const adminRoutes = require('./routes/adminRoutes');
const withdrawalRoutes = require('./routes/withdrawalRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const premiumRoutes = require('./routes/premiumRoutes');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Stucare Ambassador API is running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Stucare Ambassador API is running' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/ambassador', ambassadorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/withdrawal', withdrawalRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin/premium', premiumRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Start listening
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📍 API: http://localhost:${PORT}`);
      console.log(`🏥 Health: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Unable to start server:', error);
    process.exit(1);
  }
}

startServer();
