const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Ambassador routes
router.post('/register', authController.registerAmbassador);
router.post('/login', authController.loginAmbassador);

// Admin routes
router.post('/admin/login', authController.loginAdmin);

module.exports = router;
