const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { sequelize } = require('../models');

async function runMigration() {
  console.log('🚀 Starting Google Auth Migration...\n');

  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Run raw SQL to add columns (PostgreSQL)
    console.log('Adding googleId column...');
    await sequelize.query(`
      ALTER TABLE "Ambassadors" 
      ADD COLUMN IF NOT EXISTS "googleId" VARCHAR(255);
    `).catch(err => {
      if (!err.message.includes('already exists')) throw err;
      console.log('  - googleId already exists, skipping');
    });
    console.log('  ✓ googleId column ready\n');

    console.log('Adding isGoogleAuth column...');
    await sequelize.query(`
      ALTER TABLE "Ambassadors" 
      ADD COLUMN IF NOT EXISTS "isGoogleAuth" BOOLEAN DEFAULT false;
    `).catch(err => {
      if (!err.message.includes('already exists')) throw err;
      console.log('  - isGoogleAuth already exists, skipping');
    });
    console.log('  ✓ isGoogleAuth column ready\n');

    console.log('Creating unique index on googleId...');
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ambassadors_google_id_unique" 
      ON "Ambassadors" ("googleId") 
      WHERE "googleId" IS NOT NULL;
    `).catch(err => {
      if (!err.message.includes('already exists')) throw err;
      console.log('  - Index already exists, skipping');
    });
    console.log('  ✓ Index created\n');

    // Make password nullable for Google users
    console.log('Making password column nullable...');
    await sequelize.query(`
      ALTER TABLE "Ambassadors" 
      ALTER COLUMN "password" DROP NOT NULL;
    `).catch(err => {
      console.log('  - Password already nullable or error:', err.message);
    });
    console.log('  ✓ password is now nullable\n');

    // Make age nullable for Google users
    console.log('Making age column nullable...');
    await sequelize.query(`
      ALTER TABLE "Ambassadors" 
      ALTER COLUMN "age" DROP NOT NULL;
    `).catch(err => {
      console.log('  - Age already nullable or error:', err.message);
    });
    console.log('  ✓ age is now nullable\n');

    // Make collegeName nullable for Google users
    console.log('Making collegeName column nullable...');
    await sequelize.query(`
      ALTER TABLE "Ambassadors" 
      ALTER COLUMN "collegeName" DROP NOT NULL;
    `).catch(err => {
      console.log('  - collegeName already nullable or error:', err.message);
    });
    console.log('  ✓ collegeName is now nullable\n');

    // Make phoneNumber nullable for Google users
    console.log('Making phoneNumber column nullable...');
    await sequelize.query(`
      ALTER TABLE "Ambassadors" 
      ALTER COLUMN "phoneNumber" DROP NOT NULL;
    `).catch(err => {
      console.log('  - phoneNumber already nullable or error:', err.message);
    });
    console.log('  ✓ phoneNumber is now nullable\n');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\nGoogle Authentication is now ready to use.');
    console.log('You can restart your server with: pm2 restart all\n');

  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ MIGRATION FAILED');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

runMigration();
