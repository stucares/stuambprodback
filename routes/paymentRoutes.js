const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateAmbassador } = require('../middleware/auth');

// Create payment order (protected)
router.post('/create-order', authenticateAmbassador, paymentController.createOrder);

// Verify payment (protected)
router.post('/verify', authenticateAmbassador, paymentController.verifyPayment);

// Get payment status (protected)
router.get('/status/:orderId', authenticateAmbassador, paymentController.getPaymentStatus);

// Get premium status (protected)
router.get('/premium-status', authenticateAmbassador, paymentController.getPremiumStatus);

// Webhook (public - called by Cashfree)
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
