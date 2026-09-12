import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

async function resetDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/admin-warning-system');
    console.log('✓ Connected to MongoDB');

    // Delete all users
    await User.deleteMany({});
    console.log('✓ Deleted all users');

    // Create fresh admin
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('password123', salt);

    const admin = new User({
      username: 'admin',
      passwordHash: hashedPassword,
      role: 'Super Admin',
      status: 'Active',
      warningsIssued: 0,
      blacklistActionsCount: 0
    });

    await admin.save();
    console.log('\n✓ Admin user created successfully!');
    console.log('\nLogin credentials:');
    console.log('  Username: admin');
    console.log('  Password: password123');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

resetDatabase();
