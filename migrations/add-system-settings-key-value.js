const { DataTypes } = require('sequelize');

module.exports = {
  async up(sequelize) {
    const queryInterface = sequelize.getQueryInterface();
    
    try {
      // Add key and value columns to SystemSettings table
      await queryInterface.addColumn('SystemSettings', 'key', {
        type: DataTypes.STRING,
        allowNull: true, // Allow null initially for existing rows
        comment: 'Setting key (e.g., withdrawal_settings, premium_settings)'
      });

      await queryInterface.addColumn('SystemSettings', 'value', {
        type: DataTypes.TEXT,
        allowNull: true, // Allow null initially for existing rows
        comment: 'JSON string containing setting values'
      });

      console.log('✅ Added key and value columns to SystemSettings');
    } catch (error) {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  },

  async down(sequelize) {
    const queryInterface = sequelize.getQueryInterface();
    
    try {
      await queryInterface.removeColumn('SystemSettings', 'key');
      await queryInterface.removeColumn('SystemSettings', 'value');
      console.log('✅ Removed key and value columns from SystemSettings');
    } catch (error) {
      console.error('❌ Rollback failed:', error.message);
      throw error;
    }
  }
};
