const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const axios = require('axios');
const passport = require('../config/passport');

// Ambassador routes
router.post('/register', authController.registerAmbassador);
router.post('/login', authController.loginAmbassador);

// Google Authentication Routes

// Token-based authentication (existing - for client-side Google Sign-In)
router.post('/google', authController.googleLogin);

// Server-side OAuth Flow - Initiate
router.get('/google', 
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false 
  })
);

// Server-side OAuth Flow - Callback
router.get('/google/callback', authController.googleCallback);

// Admin routes
router.post('/admin/login', authController.loginAdmin);

// University search proxy (external API doesn't support HTTPS)
router.get('/universities', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name || name.length < 2) {
      return res.json([]);
    }

    const response = await axios.get(
      `http://universities.hipolabs.com/search?name=${encodeURIComponent(name)}`,
      { timeout: 5000 }
    );

    res.json(response.data);
  } catch (error) {
    console.error('University API error:', error.message);
    res.status(500).json({ error: 'Failed to fetch universities' });
  }
});

module.exports = router;
