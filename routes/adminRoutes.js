const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateAdmin } = require('../middleware/auth');

// All routes require admin authentication
router.use(authenticateAdmin);

// Ambassador management
router.get('/ambassadors', adminController.getAllAmbassadors);
router.get('/ambassadors/:id', adminController.getAmbassador);
router.put('/ambassadors/:id/stats', adminController.updateAmbassadorStats);
router.put('/ambassadors/:id/toggle-status', adminController.toggleAmbassadorStatus);

// Task management
router.post('/tasks', adminController.createTask);
router.get('/tasks', adminController.getAllTasks);
router.put('/tasks/:id', adminController.updateTask);
router.delete('/tasks/:id', adminController.deleteTask);

// Dashboard stats
router.get('/dashboard/stats', adminController.getDashboardStats);

module.exports = router;
