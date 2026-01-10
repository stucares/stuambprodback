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
const passwordRoutes = require('./routes/passwordRoutes');

// Initialize Express app
const app = express();

// CORS Configuration - support multiple origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5000',
  'https://stucareambassador.com',
  'https://www.stucareambassador.com'
];

// Add CORS_ORIGIN from env if specified
if (process.env.CORS_ORIGIN) {
  allowedOrigins.push(process.env.CORS_ORIGIN);
}

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false,
  maxAge: 86400 // 24 hours - cache preflight requests
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Log all requests in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - Origin: ${req.get('origin') || 'none'}`);
    next();
  });
}

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
app.use('/api/premium', premiumRoutes); // Public premium routes
app.use('/api/admin/premium', premiumRoutes); // Admin premium routes (legacy support)
app.use('/api/password', passwordRoutes); // Password reset routes

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

    // Sync models with database
    // await sequelize.sync({ alter: false });
    console.log('✅ Database synchronized');

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
