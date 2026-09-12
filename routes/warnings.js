import express from 'express';
import Warning from '../models/Warning.js';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';
import { sendWarningNotification } from '../utils/discord.js';
import { logAction } from '../utils/auditLog.js';

const router = express.Router();

// Create warning
router.post('/', protect, authorize('Moderator', 'Admin', 'Super Admin'), async (req, res) => {
  try {
    const { targetUsername, reason, type } = req.body;

    // Validation
    if (!targetUsername || !reason || !type) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    if (!['Heavy Warn', 'Light Warn'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid warning type'
      });
    }

    if (reason.length < 5 || reason.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Reason must be between 5 and 1000 characters'
      });
    }

    const warning = new Warning({
      targetUsername: targetUsername.toLowerCase(),
      reason,
      type,
      issuedBy: req.user._id,
      issuedByUsername: req.user.username,
      issuedAt: new Date()
    });

    await warning.save();

    // Update user's warnings count
    await User.findByIdAndUpdate(req.user._id, { $inc: { warningsIssued: 1 } });

    // Send Discord notification
    await sendWarningNotification(warning);

    // Log action
    await logAction('Warning Issued', req.user, targetUsername, {
      warningId: warning._id,
      type,
      reason
    });

    res.status(201).json({
      success: true,
      message: 'Warning created successfully',
      warning: {
        id: warning._id,
        targetUsername: warning.targetUsername,
        reason: warning.reason,
        type: warning.type,
        issuedBy: warning.issuedByUsername,
        issuedAt: warning.issuedAt,
        expiresAt: warning.expiresAt,
        status: warning.status,
        remainingDays: warning.remainingDays
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get all warnings
router.get('/', protect, async (req, res) => {
  try {
    const { search, type, status, sort } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { targetUsername: { $regex: search, $options: 'i' } },
        { reason: { $regex: search, $options: 'i' } },
        { issuedByUsername: { $regex: search, $options: 'i' } }
      ];
    }

    if (type && ['Heavy Warn', 'Light Warn'].includes(type)) {
      query.type = type;
    }

    if (status && ['Active', 'Expired', 'Revoked'].includes(status)) {
      query.status = status;
    }

    // Update expired warnings
    await Warning.updateExpiredWarnings();

    let sortOption = { issuedAt: -1 };
    if (sort === 'oldest') {
      sortOption = { issuedAt: 1 };
    }

    const warnings = await Warning.find(query)
      .sort(sortOption)
      .select('-__v')
      .lean();

    // Add computed properties
    const warningsWithComputed = warnings.map((w) => ({
      ...w,
      remainingDays: w.status === 'Active' ? Math.max(0, Math.ceil((w.expiresAt - new Date()) / (1000 * 60 * 60 * 24))) : 0
    }));

    res.status(200).json({
      success: true,
      count: warningsWithComputed.length,
      warnings: warningsWithComputed
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get warning by ID
router.get('/:id', protect, async (req, res) => {
  try {
    let warning = await Warning.findById(req.params.id).select('-__v').lean();

    if (!warning) {
      return res.status(404).json({
        success: false,
        message: 'Warning not found'
      });
    }

    // Check expiration
    if (warning.status === 'Active' && new Date() > warning.expiresAt) {
      await Warning.findByIdAndUpdate(req.params.id, { status: 'Expired' });
      warning.status = 'Expired';
    }

    warning.remainingDays = warning.status === 'Active' ? Math.max(0, Math.ceil((warning.expiresAt - new Date()) / (1000 * 60 * 60 * 24))) : 0;

    res.status(200).json({
      success: true,
      warning
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Edit warning (only reason and type can be edited by Admin/Super Admin)
router.put('/:id', protect, authorize('Admin', 'Super Admin'), async (req, res) => {
  try {
    const { reason, type } = req.body;
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

    if (type) {
      if (!['Heavy Warn', 'Light Warn'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid warning type'
        });
      }
      updateData.type = type;
    }

    const warning = await Warning.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    }).select('-__v');

    if (!warning) {
      return res.status(404).json({
        success: false,
        message: 'Warning not found'
      });
    }

    await logAction('Warning Edited', req.user, warning.targetUsername, {
      warningId: warning._id,
      changes: updateData
    });

    res.status(200).json({
      success: true,
      message: 'Warning updated successfully',
      warning
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Revoke warning
router.delete('/:id', protect, authorize('Admin', 'Super Admin'), async (req, res) => {
  try {
    const warning = await Warning.findById(req.params.id);

    if (!warning) {
      return res.status(404).json({
        success: false,
        message: 'Warning not found'
      });
    }

    warning.status = 'Revoked';
    await warning.save();

    await logAction('Warning Revoked', req.user, warning.targetUsername, {
      warningId: warning._id
    });

    res.status(200).json({
      success: true,
      message: 'Warning revoked successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
