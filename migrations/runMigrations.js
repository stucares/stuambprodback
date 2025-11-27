const { sequelize, Admin } = require('../models');

async function runMigrations() {
  try {
    console.log('🔄 Starting database migrations...');

    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Sync all models
    await sequelize.sync({ alter: true });
    console.log('✅ Database tables synchronized');

    // Create default admin if doesn't exist
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@stucare.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const existingAdmin = await Admin.findOne({ where: { email: adminEmail } });
    
    if (!existingAdmin) {
      await Admin.create({
        email: adminEmail,
        password: adminPassword,
        name: 'Super Admin'
      });
      console.log('✅ Default admin account created');
      console.log(`   Email: ${adminEmail}`);
      console.log(`   Password: ${adminPassword}`);
      console.log('   ⚠️  Please change these credentials after first login!');
    } else {
      console.log('ℹ️  Admin account already exists');
    }

    console.log('✅ Migrations completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
