import express from 'express';
import AuditLog from '../models/AuditLog.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get audit logs (Super Admin only)
router.get('/', protect, authorize('Super Admin'), async (req, res) => {
  try {
    const { action, username, search, days, sort } = req.query;
    let query = {};

    if (action) {
      query.action = action;
    }

    if (username) {
      query.performedByUsername = { $regex: username, $options: 'i' };
    }

    if (search) {
      query.$or = [
        { performedByUsername: { $regex: search, $options: 'i' } },
        { target: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by days
    if (days) {
      const daysNum = parseInt(days);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);
      query.createdAt = { $gte: startDate };
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'oldest') {
      sortOption = { createdAt: 1 };
    }

    const logs = await AuditLog.find(query)
      .sort(sortOption)
      .select('-__v')
      .limit(1000)
      .lean();

    res.status(200).json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
