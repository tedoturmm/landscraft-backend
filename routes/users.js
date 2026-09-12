import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';
import { logAction } from '../utils/auditLog.js';

const router = express.Router();

// Create user (Super Admin only)
router.post('/', protect, authorize('Super Admin'), async (req, res) => {
  try {
    const { username, password, role, status } = req.body;

    // Validation
    if (!username || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username, password, and role'
      });
    }

    if (!['Moderator', 'Admin', 'Super Admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    const user = new User({
      username: username.toLowerCase(),
      passwordHash: password,
      role,
      status: status || 'Active'
    });

    await user.save();

    await logAction('User Created', req.user, username, {
      role,
      status
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get all users
router.get('/', protect, authorize('Admin', 'Super Admin'), async (req, res) => {
  try {
    const { search, role, status } = req.query;
    let query = {};

    if (search) {
      query.username = { $regex: search, $options: 'i' };
    }

    if (role && ['Moderator', 'Admin', 'Super Admin'].includes(role)) {
      query.role = role;
    }

    if (status && ['Active', 'Disabled'].includes(status)) {
      query.status = status;
    }

    const users = await User.find(query)
      .select('-passwordHash -__v')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get user by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-passwordHash -__v')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Update user (Super Admin only)
router.put('/:id', protect, authorize('Super Admin'), async (req, res) => {
  try {
    const { role, status } = req.body;
    let updateData = {};

    if (role) {
      if (!['Moderator', 'Admin', 'Super Admin'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role'
        });
      }
      updateData.role = role;
    }

    if (status !== undefined) {
      if (!['Active', 'Disabled'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
      }
      updateData.status = status;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true
    }).select('-passwordHash -__v');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let action = 'User Edited';
    if (role && role !== user.role) {
      action = 'Role Changed';
    }
    if (status && status !== user.status) {
      action = status === 'Disabled' ? 'Account Disabled' : 'Account Enabled';
    }

    await logAction(action, req.user, user.username, {
      changes: updateData
    });

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Change password
router.put('/:id/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if user is changing their own password or is Super Admin
    if (req.user._id.toString() !== req.params.id && req.user.role !== 'Super Admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to change this password'
      });
    }

    const user = await User.findById(req.params.id).select('+passwordHash');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password (not needed for Super Admin changing someone else's password)
    if (req.user._id.toString() === req.params.id) {
      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }
    }

    user.passwordHash = newPassword;
    await user.save();

    await logAction('Password Changed', req.user, user.username);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Delete user (Super Admin only)
router.delete('/:id', protect, authorize('Super Admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await logAction('User Deleted', req.user, user.username);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;
