const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    // Add uniqueCodeApproved field to Ambassadors
    await queryInterface.addColumn('Ambassadors', 'uniqueCodeApproved', {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });

    // Add referredBy field to track who referred this ambassador
    await queryInterface.addColumn('Ambassadors', 'referredBy', {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'Unique code of the ambassador who referred this user'
    });

    console.log('✅ Added uniqueCodeApproved and referredBy columns');
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Ambassadors', 'uniqueCodeApproved');
    await queryInterface.removeColumn('Ambassadors', 'referredBy');
  }
};
