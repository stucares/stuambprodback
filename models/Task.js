const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  productLink: {
    type: DataTypes.STRING,
    allowNull: false
  },
  productThumbnail: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'URL to product thumbnail image'
  },
  messageTemplate: {
    type: DataTypes.TEXT,
    allowNull: false,
    comment: 'Message template with {{CODE}} placeholder for unique code'
  },
  pointsReward: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true
});

module.exports = Task;
