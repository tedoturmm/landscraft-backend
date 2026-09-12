import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Please provide a username'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [32, 'Username must not exceed 32 characters'],
      lowercase: true,
      match: [/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores']
    },
    passwordHash: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false
    },
    role: {
      type: String,
      enum: ['Moderator', 'Admin', 'Super Admin'],
      default: 'Moderator'
    },
    status: {
      type: String,
      enum: ['Active', 'Disabled'],
      default: 'Active'
    },
    warningsIssued: {
      type: Number,
      default: 0
    },
    blacklistActionsCount: {
      type: Number,
      default: 0
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Hash password before saving (only if not already hashed)
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) {
    next();
    return;
  }

  // Check if already hashed (bcrypt hashes start with $2a$, $2b$, or $2y$)
  if (this.passwordHash.startsWith('$2')) {
    next();
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

// Update the updatedAt timestamp
userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model('User', userSchema);
