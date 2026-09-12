import express from 'express';
import User from '../models/User.js';
import Warning from '../models/Warning.js';
import Blacklist from '../models/Blacklist.js';
import AuditLog from '../models/AuditLog.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Get dashboard data
router.get('/', protect, async (req, res) => {
  try {
    // Update expired warnings and blacklist entries
    await Warning.updateExpiredWarnings();
    await Blacklist.updateExpiredEntries();

    // Count stats
    const totalAdmins = await User.countDocuments({ status: 'Active' });
    const activeWarnings = await Warning.countDocuments({ status: 'Active' });
    const expiredWarnings = await Warning.countDocuments({ status: 'Expired' });
    const activeBlacklists = await Blacklist.countDocuments({ status: 'Active' });
    const expiredBlacklists = await Blacklist.countDocuments({ status: 'Expired' });

    // Warnings issued today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const warningsToday = await Warning.countDocuments({
      issuedAt: { $gte: today }
    });

    // Recent activity
    const recentLogs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .select('-__v')
      .lean();

    // Format recent activity
    const recentActivity = recentLogs.map((log) => {
      const now = new Date();
      const logDate = new Date(log.createdAt);
      const diffMs = now - logDate;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      let timeAgo;
      if (diffMins < 1) timeAgo = 'just now';
      else if (diffMins < 60) timeAgo = `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
      else if (diffHours < 24) timeAgo = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      else if (diffDays < 30) timeAgo = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      else timeAgo = logDate.toLocaleDateString();

      return {
        id: log._id,
        action: log.action,
        by: log.performedByUsername,
        target: log.target,
        timeAgo
      };
    });

    res.status(200).json({
      success: true,
      stats: {
        totalAdmins,
        activeWarnings,
        expiredWarnings,
        activeBlacklists,
        expiredBlacklists,
        warningsToday
      },
      recentActivity: recentActivity.slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
