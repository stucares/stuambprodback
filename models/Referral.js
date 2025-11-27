const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Referral = sequelize.define('Referral', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  ambassadorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Ambassadors',
      key: 'id'
    }
  },
  referredEmail: {
    type: DataTypes.STRING,
    allowNull: false
  },
  referredName: {
    type: DataTypes.STRING
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'cancelled'),
    defaultValue: 'pending'
  },
  pointsEarned: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  timestamps: true
});

module.exports = Referral;
