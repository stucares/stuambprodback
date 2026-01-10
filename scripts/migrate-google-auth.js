/**
 * Google Auth Migration Script
 * 
 * Run this script to add Google authentication columns to your database.
 * 
 * Usage:
 *   node scripts/migrate-google-auth.js
 */

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
