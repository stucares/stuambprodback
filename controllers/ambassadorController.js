const { Ambassador, Referral, Task } = require('../models');

// Get Ambassador Profile
exports.getProfile = async (req, res) => {
  try {
    const ambassador = await Ambassador.findByPk(req.ambassador.id, {
      attributes: { exclude: ['password'] }
    });

    // Hide unique code if not approved by admin
    const response = ambassador.toJSON();
    if (!ambassador.uniqueCodeApproved) {
      response.uniqueCode = null;
      response.uniqueCodeMessage = 'Your unique code is pending admin approval';
    }

    res.json({
      success: true,
      ambassador: response
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

// Update Ambassador Profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, age, collegeName, phoneNumber, avatar } = req.body;
    const ambassador = req.ambassador;

    if (name) ambassador.name = name;
    if (age) ambassador.age = age;
    if (collegeName) ambassador.collegeName = collegeName;
    if (phoneNumber) ambassador.phoneNumber = phoneNumber;
    if (avatar) ambassador.avatar = avatar;

    await ambassador.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      ambassador: {
        id: ambassador.id,
        name: ambassador.name,
        email: ambassador.email,
        age: ambassador.age,
        collegeName: ambassador.collegeName,
        phoneNumber: ambassador.phoneNumber
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

// Get Ambassador Statistics
exports.getStats = async (req, res) => {
  try {
    const ambassador = req.ambassador;
    const isPremium = ambassador.isPremium && new Date(ambassador.premiumExpiresAt) > new Date();
    
    const totalReferrals = await Referral.count({
      where: { ambassadorId: ambassador.id }
    });

    const completedReferrals = await Referral.count({
      where: { 
        ambassadorId: ambassador.id,
        status: 'completed'
      }
    });

    const pendingReferrals = await Referral.count({
      where: { 
        ambassadorId: ambassador.id,
        status: 'pending'
      }
    });

    res.json({
      success: true,
      stats: {
        level: ambassador.level,
        referralCount: ambassador.referralCount,
        creditPoints: ambassador.creditPoints,
        totalReferrals,
        completedReferrals,
        pendingReferrals,
        uniqueCode: ambassador.uniqueCode,
        isPremium,
        premiumExpiresAt: ambassador.premiumExpiresAt,
        pointsMultiplier: isPremium ? 2 : 1,
        premiumBenefits: isPremium ? [
          'Exclusive premium tasks with higher rewards',
          '2x points on all referrals',
          'Verified blue tick badge',
          'Priority support'
        ] : []
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
};

// Get All Tasks (filtered by premium status)
exports.getTasks = async (req, res) => {
  try {
    const ambassador = req.ambassador;
    const isPremium = ambassador.isPremium && new Date(ambassador.premiumExpiresAt) > new Date();
    
    // Filter tasks based on premium status
    const whereClause = { isActive: true };
    if (!isPremium) {
      // Regular users only see non-premium tasks
      whereClause.isPremiumOnly = false;
    }
    // Premium users see all tasks (no additional filter needed)
    
    const tasks = await Task.findAll({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    // Replace {{CODE}} placeholder with ambassador's unique code
    const tasksWithCode = tasks.map(task => {
      const taskData = task.toJSON();
      return {
        ...taskData,
        messageTemplate: taskData.messageTemplate.replace(/\{\{CODE\}\}/gi, ambassador.uniqueCode),
        isPremiumTask: taskData.isPremiumOnly
      };
    });

    res.json({
      success: true,
      tasks: tasksWithCode,
      isPremium,
      message: isPremium ? 'Showing all tasks (including premium)' : 'Showing regular tasks only'
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to fetch tasks',
      error: error.message 
    });
  }
};

// Get Referrals History
exports.getReferrals = async (req, res) => {
  try {
    const referrals = await Referral.findAll({
      where: { ambassadorId: req.ambassador.id },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      referrals
    });
  } catch (error) {
    console.error('Get referrals error:', error);
    res.status(500).json({ message: 'Failed to fetch referrals' });
  }
};

// Get Meeting Details
exports.getMeetingDetails = async (req, res) => {
  try {
    const ambassador = req.ambassador;
    
    if (!ambassador.isPremium) {
      return res.json({
        success: true,
        meeting: null,
        message: 'Not a premium member'
      });
    }

    if (!ambassador.meetingScheduled || !ambassador.meetingDate) {
      return res.json({
        success: true,
        meeting: null,
        message: 'Meeting not scheduled yet'
      });
    }

    res.json({
      success: true,
      meeting: {
        date: ambassador.meetingDate.toLocaleDateString('en-IN', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        time: ambassador.meetingDate.toLocaleTimeString('en-IN', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        link: ambassador.meetingLink || 'https://calendly.com/it-stucares/30min'
      }
    });
  } catch (error) {
    console.error('Get meeting details error:', error);
    res.status(500).json({ message: 'Failed to fetch meeting details' });
  }
};
