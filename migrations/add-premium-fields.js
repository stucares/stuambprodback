const { sequelize } = require('../models');

const runMigration = async () => {
  try {
    console.log('Starting premium fields migration...');
    
    // Add premium-related columns to Ambassadors table
    const alterQueries = [
      `ALTER TABLE "Ambassadors" ADD COLUMN IF NOT EXISTS "isPremium" BOOLEAN DEFAULT false`,
      `ALTER TABLE "Ambassadors" ADD COLUMN IF NOT EXISTS "premiumExpiresAt" TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE "Ambassadors" ADD COLUMN IF NOT EXISTS "meetingScheduled" BOOLEAN DEFAULT false`,
      `ALTER TABLE "Ambassadors" ADD COLUMN IF NOT EXISTS "meetingDate" TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE "Ambassadors" ADD COLUMN IF NOT EXISTS "meetingLink" VARCHAR(500)`
    ];

    for (const query of alterQueries) {
      try {
        await sequelize.query(query);
        console.log('✅ Executed:', query.substring(0, 80) + '...');
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⏭️ Column already exists, skipping...');
        } else {
          console.error('❌ Error:', error.message);
        }
      }
    }

    console.log('✅ Premium fields migration completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

runMigration();
