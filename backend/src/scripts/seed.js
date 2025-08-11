const bcrypt = require('bcryptjs');
const AppDataSource = require('../config/database');

async function seedDatabase() {
  try {
    await AppDataSource.initialize();
    console.log('Database connection established');

    // Create admin user
    const userRepository = AppDataSource.getRepository('User');
    
    const existingAdmin = await userRepository.findOne({ 
      where: { email: 'admin@example.com' } 
    });
    
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('password123', 12);
      
      const adminUser = userRepository.create({
        name: 'Admin User',
        email: 'admin@example.com',
        password_hash: hashedPassword,
        role: 'admin'
      });
      
      await userRepository.save(adminUser);
      console.log('Admin user created: admin@example.com / password123');
    } else {
      console.log('Admin user already exists');
    }

    // Create sample items
    const itemRepository = AppDataSource.getRepository('Item');
    
    const sampleItems = [
      { name: 'Rice', uom: 'kg' },
      { name: 'Dal', uom: 'kg' },
      { name: 'Oil', uom: 'liter' },
      { name: 'Sugar', uom: 'kg' },
      { name: 'Salt', uom: 'kg' },
      { name: 'Onions', uom: 'kg' },
      { name: 'Potatoes', uom: 'kg' },
      { name: 'Tomatoes', uom: 'kg' }
    ];

    for (const itemData of sampleItems) {
      const existingItem = await itemRepository.findOne({ 
        where: { name: itemData.name } 
      });
      
      if (!existingItem) {
        const item = itemRepository.create(itemData);
        await itemRepository.save(item);
        console.log(`Created item: ${itemData.name}`);
      }
    }

    // Create current period
    const periodRepository = AppDataSource.getRepository('Period');
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const periodCode = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    const existingPeriod = await periodRepository.findOne({
      where: { year: currentYear, month: currentMonth }
    });

    if (!existingPeriod) {
      const adminUser = await userRepository.findOne({ 
        where: { email: 'admin@example.com' } 
      });

      const period = periodRepository.create({
        code: periodCode,
        year: currentYear,
        month: currentMonth,
        status: 'OPEN',
        opened_at: new Date(),
        created_by: adminUser.id
      });

      await periodRepository.save(period);
      console.log(`Created current period: ${periodCode}`);
    } else {
      console.log(`Current period already exists: ${periodCode}`);
    }

    console.log('Database seeding completed successfully!');
    
  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

// Run seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
