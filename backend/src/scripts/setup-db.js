const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function setupDatabase() {
  try {
    console.log('🔄 Setting up database...');
    
    // Run migrations
    console.log('📦 Running migrations...');
    await execAsync('npm run migrate');
    console.log('✅ Migrations completed');
    
    // Run seeding
    console.log('🌱 Seeding database...');
    await execAsync('npm run seed');
    console.log('✅ Database seeded');
    
    console.log('🎉 Database setup completed successfully!');
    console.log('');
    console.log('You can now start the server with: npm run dev');
    console.log('Default admin credentials: admin@example.com / password123');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.log('');
      console.log('💡 It looks like the database tables don\'t exist yet.');
      console.log('   Make sure you have:');
      console.log('   1. Created the database: createdb klub_test_db');
      console.log('   2. Updated your .env file with correct database credentials');
    }
    
    process.exit(1);
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;
