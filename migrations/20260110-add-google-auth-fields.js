'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('🚀 Starting Google Auth migration...');

    // Add googleId column
    await queryInterface.addColumn('Ambassadors', 'googleId', {
      type: Sequelize.STRING(255),
      allowNull: true,
      unique: true
    }).catch(err => {
      if (err.message.includes('already exists')) {
        console.log('googleId column already exists, skipping...');
      } else {
        throw err;
      }
    });

    // Add isGoogleAuth column
    await queryInterface.addColumn('Ambassadors', 'isGoogleAuth', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false
    }).catch(err => {
      if (err.message.includes('already exists')) {
        console.log('isGoogleAuth column already exists, skipping...');
      } else {
        throw err;
      }
    });

    // Create unique index on googleId
    await queryInterface.addIndex('Ambassadors', ['googleId'], {
      unique: true,
      name: 'ambassadors_google_id_unique',
      where: { googleId: { [Sequelize.Op.ne]: null } }
    }).catch(err => {
      if (err.message.includes('already exists')) {
        console.log('Index already exists, skipping...');
      } else {
        throw err;
      }
    });

    console.log('✅ Google Auth migration completed!');
  },

  async down(queryInterface, Sequelize) {
    console.log('🔙 Rolling back Google Auth migration...');

    await queryInterface.removeIndex('Ambassadors', 'ambassadors_google_id_unique').catch(() => {});
    await queryInterface.removeColumn('Ambassadors', 'googleId').catch(() => {});
    await queryInterface.removeColumn('Ambassadors', 'isGoogleAuth').catch(() => {});

    console.log('✅ Rollback completed!');
  }
};
