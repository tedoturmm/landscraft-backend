import express from 'express';
import Blacklist from '../models/Blacklist.js';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';
import { sendBlacklistNotification } from '../utils/discord.js';
import { logAction } from '../utils/auditLog.js';

const router = express.Router();

// Create blacklist entry
router.post('/', protect, authorize('Moderator', 'Admin', 'Super Admin'), async (req, res) => {
  try {
    const { username, reason, expiresAt } = req.body;

    // Validation
    if (!username || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username and reason'
      });
    }

    if (reason.length < 5 || reason.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Reason must be between 5 and 1000 characters'
      });
    }

    // Check if already blacklisted
    const existing = await Blacklist.findOne({
      username: username.toLowerCase(),
      status: 'Active'
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'User is already blacklisted'
      });
    }

    const blacklist = new Blacklist({
      username: username.toLowerCase(),
      reason,
      addedBy: req.user._id,
      addedByUsername: req.user.username,
      addedAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });

    await blacklist.save();

    // Update user's blacklist actions count
    await User.findByIdAndUpdate(req.user._id, { $inc: { blacklistActionsCount: 1 } });

    // Send Discord notification
    await sendBlacklistNotification(blacklist, 'added');

    // Log action
    await logAction('Blacklist Added', req.user, username, {
      blacklistId: blacklist._id,
      reason,
      expiresAt: expiresAt || null
    });

    res.status(201).json({
      success: true,
      message: 'Blacklist entry created successfully',
      blacklist: {
        id: blacklist._id,
        username: blacklist.username,
        reason: blacklist.reason,
        addedBy: blacklist.addedByUsername,
        addedAt: blacklist.addedAt,
        expiresAt: blacklist.expiresAt,
        status: blacklist.status
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get all blacklist entries
router.get('/', protect, async (req, res) => {
  try {
    const { search, status, sort } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } },
        { addedByUsername: { $regex: search, $options: 'i' } }
      ];
    }

    if (status && ['Active', 'Expired', 'Removed'].includes(status)) {
      query.status = status;
    }

    // Update expired entries
    await Blacklist.updateExpiredEntries();

    let sortOption = { addedAt: -1 };
    if (sort === 'oldest') {
      sortOption = { addedAt: 1 };
    }

    const blacklistEntries = await Blacklist.find(query)
      .sort(sortOption)
      .select('-__v')
      .lean();

    // Add computed properties
    const withComputed = blacklistEntries.map((e) => ({
      ...e,
      remainingDays: e.expiresAt && e.status === 'Active' 
        ? Math.max(0, Math.ceil((e.expiresAt - new Date()) / (1000 * 60 * 60 * 24))) 
        : null
    }));

    res.status(200).json({
      success: true,
      count: withComputed.length,
      blacklist: withComputed
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get blacklist entry by ID
router.get('/:id', protect, async (req, res) => {
  try {
    let entry = await Blacklist.findById(req.params.id).select('-__v').lean();

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Blacklist entry not found'
      });
    }

    // Check expiration
    if (entry.status === 'Active' && entry.expiresAt && new Date() > entry.expiresAt) {
      await Blacklist.findByIdAndUpdate(req.params.id, { status: 'Expired' });
      entry.status = 'Expired';
    }

    entry.remainingDays = entry.expiresAt && entry.status === 'Active' 
      ? Math.max(0, Math.ceil((entry.expiresAt - new Date()) / (1000 * 60 * 60 * 24))) 
      : null;

    res.status(200).json({
      success: true,
      entry
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Edit blacklist entry
router.put('/:id', protect, authorize('Admin', 'Super Admin'), async (req, res) => {
  try {
    const { reason, expiresAt } = req.body;
    let updateData = {};

    if (reason) {
      if (reason.length < 5 || reason.length > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Reason must be between 5 and 1000 characters'
        });
      }
      updateData.reason = reason;
    }

    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    const entry = await Blacklist.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    }).select('-__v');

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Blacklist entry not found'
      });
    }

    await sendBlacklistNotification(entry, 'edited');

    await logAction('Blacklist Edited', req.user, entry.username, {
      blacklistId: entry._id,
      changes: updateData
    });

    res.status(200).json({
      success: true,
      message: 'Blacklist entry updated successfully',
      entry
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Remove blacklist entry
router.delete('/:id', protect, authorize('Admin', 'Super Admin'), async (req, res) => {
  try {
    const entry = await Blacklist.findById(req.params.id);

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Blacklist entry not found'
      });
    }

    entry.status = 'Removed';
    await entry.save();

    await sendBlacklistNotification(entry, 'removed');

    await logAction('Blacklist Removed', req.user, entry.username, {
      blacklistId: entry._id
    });

    res.status(200).json({
      success: true,
      message: 'Blacklist entry removed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
