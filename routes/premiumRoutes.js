const express = require('express');
const router = express.Router();
const premiumController = require('../controllers/premiumController');
const { authenticateAdmin } = require('../middleware/auth');

// Public routes (no auth required)
// Premium settings (read-only for users to see pricing)
router.get('/settings', premiumController.getPremiumSettings);
router.get('/referral-settings', premiumController.getReferralSettings);
router.get('/popup-settings', premiumController.getPopupSettings);

// Admin-only routes
router.use(authenticateAdmin);

// Premium members management
router.get('/members', premiumController.getPremiumMembers);
router.put('/members/:ambassadorId/revoke', premiumController.revokePremium);
router.put('/members/:ambassadorId/extend', premiumController.extendPremium);
router.put('/members/:ambassadorId/meeting', premiumController.updateMeeting);

// Premium settings update (admin only)
router.put('/settings', premiumController.updatePremiumSettings);
router.put('/referral-settings', premiumController.updateReferralSettings);
router.put('/popup-settings', premiumController.updatePopupSettings);

module.exports = router;
