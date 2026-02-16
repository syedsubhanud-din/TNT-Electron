import { User, Template } from '../index';

export const runSeed = async () => {
  try {
    // Check if we already have users
    const userCount = await User.count();
    if (userCount === 0) {
      console.log('🌱 Seeding initial users...');
      await User.create({
        username: 'admin',
        email: 'admin@example.com',
        password: 'admin', // Default password
        settings: { role: 'administrator', theme: 'dark' },
      });
      console.log('✅ Users seeded');
    }

    // Template seeding removed as per user request
    // Only the table will be created via sequelize.sync()
  } catch (error: any) {
    console.error('❌ Seeding failed:', error.message);
  }
};
