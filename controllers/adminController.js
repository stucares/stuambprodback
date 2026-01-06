const { Ambassador, Task, Referral } = require('../models');
const { Op } = require('sequelize');
const { sendUniqueCodeApprovedEmail } = require('../services/emailService');

// Get All Ambassadors
exports.getAllAmbassadors = async (req, res) => {
  try {
    const ambassadors = await Ambassador.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']],
      include: [{
        model: Referral,
        as: 'referrals',
        attributes: ['id', 'status', 'pointsEarned']
      }]
    });

    // Calculate pending and premium referrals for each ambassador
    const ambassadorsWithStats = await Promise.all(ambassadors.map(async (ambassador) => {
      const ambassadorData = ambassador.toJSON();

      // Count how many people used this ambassador's referral code
      const referredUsers = await Ambassador.count({
        where: { referredBy: ambassador.uniqueCode }
      });

      // Count how many of those became premium
      const premiumReferrals = await Ambassador.count({
        where: {
          referredBy: ambassador.uniqueCode,
          isPremium: true
        }
      });

      ambassadorData.totalReferrals = referredUsers;
      ambassadorData.premiumReferrals = premiumReferrals;
      ambassadorData.pendingReferrals = referredUsers - premiumReferrals;

      return ambassadorData;
    }));

    res.json({
      success: true,
      ambassadors: ambassadorsWithStats
    });
  } catch (error) {
    console.error('Get ambassadors error:', error);
    res.status(500).json({ message: 'Failed to fetch ambassadors' });
  }
};

// Get Single Ambassador
exports.getAmbassador = async (req, res) => {
  try {
    const ambassador = await Ambassador.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
      include: [{
        model: Referral,
        as: 'referrals'
      }]
    });

    if (!ambassador) {
      return res.status(404).json({ message: 'Ambassador not found' });
    }

    res.json({
      success: true,
      ambassador
    });
  } catch (error) {
    console.error('Get ambassador error:', error);
    res.status(500).json({ message: 'Failed to fetch ambassador' });
  }
};

// Update Ambassador Stats (Manual)
exports.updateAmbassadorStats = async (req, res) => {
  try {
    const { referralCount, creditPoints, isPremium, premiumType } = req.body;

    const ambassador = await Ambassador.findByPk(req.params.id);

    if (!ambassador) {
      return res.status(404).json({ message: 'Ambassador not found' });
    }

    if (referralCount !== undefined) {
      ambassador.referralCount = referralCount;
      ambassador.updateLevel(); // Update level based on new referral count
    }

    if (creditPoints !== undefined) {
      ambassador.creditPoints = creditPoints;
    }

    // Handle premium status updates
    if (isPremium !== undefined) {
      ambassador.isPremium = isPremium;

      if (isPremium) {
        // Set expiry based on premium type
        const expiryDate = new Date();
        if (premiumType === 'lifetime') {
          // Set to 100 years for lifetime
          expiryDate.setFullYear(expiryDate.getFullYear() + 100);
        } else {
          // Default to 1 month
          expiryDate.setMonth(expiryDate.getMonth() + 1);
        }
        ambassador.premiumExpiresAt = expiryDate;
      } else {
        // Remove premium
        ambassador.premiumExpiresAt = null;
      }
    }

    await ambassador.save();

    res.json({
      success: true,
      message: 'Ambassador stats updated successfully',
      ambassador: {
        id: ambassador.id,
        name: ambassador.name,
        referralCount: ambassador.referralCount,
        creditPoints: ambassador.creditPoints,
        level: ambassador.level,
        isPremium: ambassador.isPremium,
        premiumExpiresAt: ambassador.premiumExpiresAt
      }
    });
  } catch (error) {
    console.error('Update stats error:', error);
    res.status(500).json({ message: 'Failed to update ambassador stats' });
  }
};

// Toggle Ambassador Active Status
exports.toggleAmbassadorStatus = async (req, res) => {
  try {
    const ambassador = await Ambassador.findByPk(req.params.id);

    if (!ambassador) {
      return res.status(404).json({ message: 'Ambassador not found' });
    }

    ambassador.isActive = !ambassador.isActive;
    await ambassador.save();

    res.json({
      success: true,
      message: `Ambassador ${ambassador.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: ambassador.isActive
    });
  } catch (error) {
    console.error('Toggle status error:', error);
    res.status(500).json({ message: 'Failed to update ambassador status' });
  }
};

// Create Task
exports.createTask = async (req, res) => {
  try {
    const { title, description, productLink, messageTemplate, pointsReward, isPremiumOnly } = req.body;

    if (!title || !description || !productLink || !messageTemplate) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const task = await Task.create({
      title,
      description,
      productLink,
      messageTemplate,
      pointsReward: pointsReward || 0,
      isPremiumOnly: isPremiumOnly || false
    });

    res.status(201).json({
      success: true,
      message: `Task created successfully${isPremiumOnly ? ' (Premium Only)' : ''}`,
      task
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Failed to create task' });
  }
};

// Get All Tasks
exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.findAll({
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      tasks
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ message: 'Failed to fetch tasks' });
  }
};

// Update Task
exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const { title, description, productLink, messageTemplate, pointsReward, isActive, isPremiumOnly } = req.body;

    if (title) task.title = title;
    if (description) task.description = description;
    if (productLink) task.productLink = productLink;
    if (messageTemplate) task.messageTemplate = messageTemplate;
    if (pointsReward !== undefined) task.pointsReward = pointsReward;
    if (isActive !== undefined) task.isActive = isActive;
    if (isPremiumOnly !== undefined) task.isPremiumOnly = isPremiumOnly;

    await task.save();

    res.json({
      success: true,
      message: 'Task updated successfully',
      task
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Failed to update task' });
  }
};

// Delete Task
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await task.destroy();

    res.json({
      success: true,
      message: 'Task deleted successfully'
    });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Failed to delete task' });
  }
};

// Get Dashboard Stats
exports.getDashboardStats = async (req, res) => {
  try {
    const totalAmbassadors = await Ambassador.count();
    const activeAmbassadors = await Ambassador.count({ where: { isActive: true } });
    const premiumAmbassadors = await Ambassador.count({
      where: {
        isPremium: true,
        premiumExpiresAt: { [Op.gt]: new Date() }
      }
    });
    const totalTasks = await Task.count();
    const activeTasks = await Task.count({ where: { isActive: true } });
    const premiumTasks = await Task.count({ where: { isPremiumOnly: true, isActive: true } });
    const totalReferrals = await Referral.count();
    const completedReferrals = await Referral.count({ where: { status: 'completed' } });

    // Get top ambassadors
    const topAmbassadors = await Ambassador.findAll({
      order: [['referralCount', 'DESC']],
      limit: 10,
      attributes: ['id', 'name', 'email', 'referralCount', 'creditPoints', 'level', 'isPremium']
    });

    res.json({
      success: true,
      stats: {
        totalAmbassadors,
        activeAmbassadors,
        premiumAmbassadors,
        totalTasks,
        activeTasks,
        premiumTasks,
        totalReferrals,
        completedReferrals,
        topAmbassadors
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard stats' });
  }
};

// Approve unique code for ambassador
exports.approveUniqueCode = async (req, res) => {
  try {
    const { approved } = req.body;
    const ambassador = await Ambassador.findByPk(req.params.id);

    if (!ambassador) {
      return res.status(404).json({ message: 'Ambassador not found' });
    }

    ambassador.uniqueCodeApproved = approved;
    await ambassador.save();

    // Send email if approved
    if (approved) {
      sendUniqueCodeApprovedEmail({
        name: ambassador.name,
        email: ambassador.email,
        uniqueCode: ambassador.uniqueCode
      }).catch(err => console.error('Failed to send approval email:', err));
    }

    res.json({
      success: true,
      message: approved ? 'Unique code approved and shared with ambassador' : 'Unique code approval revoked',
      ambassador: {
        id: ambassador.id,
        name: ambassador.name,
        uniqueCode: ambassador.uniqueCode,
        uniqueCodeApproved: ambassador.uniqueCodeApproved
      }
    });
  } catch (error) {
    console.error('Approve unique code error:', error);
    res.status(500).json({ message: 'Failed to approve unique code' });
  }
};

// Bulk update ambassadors from CSV
exports.bulkUpdateFromCSV = async (req, res) => {
  try {
    const { data, pointsPerReferral } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ message: 'Invalid CSV data' });
    }

    const results = {
      updated: 0,
      failed: 0,
      errors: []
    };

    // Process each row
    for (const row of data) {
      try {
        const { uniqueCode, referralCount } = row;

        if (!uniqueCode || referralCount === undefined) {
          results.failed++;
          results.errors.push({ uniqueCode: uniqueCode || 'Unknown', error: 'Missing required fields' });
          continue;
        }

        // Find ambassador by unique code
        const ambassador = await Ambassador.findOne({ where: { uniqueCode } });

        if (!ambassador) {
          results.failed++;
          results.errors.push({ uniqueCode, error: 'Ambassador not found' });
          continue;
        }

        // Update referral count only
        // Points will be awarded automatically when referred users purchase premium
        const newReferralCount = parseInt(referralCount);

        // Update ambassador
        ambassador.referralCount = newReferralCount;
        ambassador.updateLevel(); // Update level based on new referral count

        await ambassador.save();

        results.updated++;
      } catch (error) {
        results.failed++;
        results.errors.push({ uniqueCode: row.uniqueCode, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Bulk update completed. Updated: ${results.updated}, Failed: ${results.failed}`,
      results
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({ message: 'Failed to process bulk update' });
  }
};

// Download New Ambassador Unique Codes
exports.downloadNewAmbassadorCodes = async (req, res) => {
  try {
    // Find all ambassadors whose code hasn't been downloaded yet
    const ambassadors = await Ambassador.findAll({
      where: {
        codeDownloaded: false,
        uniqueCode: { [Op.ne]: null } // Ensure uniqueCode is not null
      },
      attributes: ['name', 'uniqueCode', 'id']
    });

    if (ambassadors.length === 0) {
      return res.json({
        success: true,
        message: 'No new codes found',
        data: []
      });
    }

    // Prepare CSV data
    const csvData = ambassadors.map(a => ({
      name: a.name,
      uniqueCode: a.uniqueCode
    }));

    // Mark as downloaded
    await Ambassador.update(
      { codeDownloaded: true },
      {
        where: {
          id: { [Op.in]: ambassadors.map(a => a.id) }
        }
      }
    );

    res.json({
      success: true,
      message: `Found ${ambassadors.length} new codes`,
      data: csvData
    });
  } catch (error) {
    console.error('Download codes error:', error);
    res.status(500).json({ message: 'Failed to download codes' });
  }
};
