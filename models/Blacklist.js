import mongoose from 'mongoose';

const blacklistSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      lowercase: true,
      index: true
    },
    reason: {
      type: String,
      required: [true, 'Reason is required'],
      minlength: [5, 'Reason must be at least 5 characters'],
      maxlength: [1000, 'Reason must not exceed 1000 characters']
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Added by is required']
    },
    addedByUsername: {
      type: String,
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true
    },
    status: {
      type: String,
      enum: ['Active', 'Expired', 'Removed'],
      default: 'Active'
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

// Method to check and update expiration status
blacklistSchema.methods.checkExpiration = function () {
  if (this.status === 'Active' && this.expiresAt && new Date() > this.expiresAt) {
    this.status = 'Expired';
  }
  return this.status;
};

// Static method to update all expired blacklist entries
blacklistSchema.statics.updateExpiredEntries = async function () {
  const now = new Date();
  await this.updateMany(
    { status: 'Active', expiresAt: { $lt: now, $ne: null } },
    { status: 'Expired' }
  );
};

// Virtual to get remaining days
blacklistSchema.virtual('remainingDays').get(function () {
  if (!this.expiresAt || this.status !== 'Active') return null;
  const now = new Date();
  const diffTime = this.expiresAt - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

export default mongoose.model('Blacklist', blacklistSchema);
