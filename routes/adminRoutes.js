const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const withdrawalController = require('../controllers/withdrawalController');
const { authenticateAdmin } = require('../middleware/auth');

// All routes require admin authentication
router.use(authenticateAdmin);

// Ambassador management
router.get('/ambassadors', adminController.getAllAmbassadors);
router.get('/ambassadors/download-new-codes', adminController.downloadNewAmbassadorCodes);
router.get('/ambassadors/:id', adminController.getAmbassador);
router.put('/ambassadors/:id/stats', adminController.updateAmbassadorStats);
router.put('/ambassadors/:id/toggle-status', adminController.toggleAmbassadorStatus);
router.put('/ambassadors/:id/approve-code', adminController.approveUniqueCode);
router.post('/ambassadors/bulk-update', adminController.bulkUpdateFromCSV);

// Task management
router.post('/tasks', adminController.createTask);
router.get('/tasks', adminController.getAllTasks);
router.put('/tasks/:id', adminController.updateTask);
router.delete('/tasks/:id', adminController.deleteTask);

// Withdrawal management
router.get('/withdrawals', withdrawalController.getAllWithdrawals);
router.put('/withdrawals/:id', withdrawalController.updateWithdrawalStatus);

// System settings
router.get('/settings', withdrawalController.getSystemSettings);
router.put('/settings', withdrawalController.updateSystemSettings);

// Dashboard stats
router.get('/dashboard/stats', adminController.getDashboardStats);

module.exports = router;
