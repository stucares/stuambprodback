const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addColumn('Tasks', 'productThumbnail', {
      type: DataTypes.STRING,
      allowNull: true,
      comment: 'URL to product thumbnail image'
    });
    console.log('✅ Added productThumbnail column to Tasks table');
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('Tasks', 'productThumbnail');
  }
};
