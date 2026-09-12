import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.js';
import warningRoutes from './routes/warnings.js';
import blacklistRoutes from './routes/blacklist.js';
import userRoutes from './routes/users.js';
import auditRoutes from './routes/audit.js';
import dashboardRoutes from './routes/dashboard.js';

const app = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
  })
);
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/admin-warning-system')
  .then(() => {
    console.log('✓ MongoDB connected');
  })
  .catch((err) => {
    console.error('✗ MongoDB connection error:', err.message);
    console.log('\n⚠️  WARNING: MongoDB is not connected!');
    console.log('   The server will attempt to reconnect automatically.');
    console.log('\n📝 To fix this:');
    console.log('   1. Install MongoDB from: https://www.mongodb.com/try/download/community');
    console.log('   2. Start MongoDB: mongod');
    console.log('   3. Or update .env with MongoDB Atlas connection string');
    console.log('   4. Restart this server\n');
  });

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/warnings', warningRoutes);
app.use('/api/blacklist', blacklistRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/dashboard', dashboardRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
