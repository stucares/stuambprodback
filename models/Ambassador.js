const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const Ambassador = sequelize.define('Ambassador', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  collegeName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  uniqueCode: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  avatar: {
    type: DataTypes.TEXT('long'),
    defaultValue: 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'
  },
  referralCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  creditPoints: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  upiId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lastWithdrawalAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  isPremium: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  premiumExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  meetingScheduled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  meetingDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  meetingLink: {
    type: DataTypes.STRING,
    allowNull: true
  },
  level: {
    type: DataTypes.STRING,
    defaultValue: 'Rookie'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true,
  hooks: {
    beforeCreate: async (ambassador) => {
      if (ambassador.password) {
        const salt = await bcrypt.genSalt(10);
        ambassador.password = await bcrypt.hash(ambassador.password, salt);
      }
    },
    beforeUpdate: async (ambassador) => {
      if (ambassador.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        ambassador.password = await bcrypt.hash(ambassador.password, salt);
      }
    }
  }
});

// Method to compare password
Ambassador.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to calculate level based on referral count
Ambassador.prototype.updateLevel = function() {
  const count = this.referralCount;
  if (count === 0) {
    this.level = 'Rookie';
  } else if (count >= 1 && count <= 10) {
    this.level = 'Hustler';
  } else if (count >= 11 && count <= 39) {
    this.level = 'Pro';
  } else if (count >= 40 && count <= 79) {
    this.level = 'Master';
  } else if (count >= 80 && count <= 199) {
    this.level = 'Grandmaster';
  } else if (count >= 200) {
    this.level = 'Ace';
  }
};

module.exports = Ambassador;
