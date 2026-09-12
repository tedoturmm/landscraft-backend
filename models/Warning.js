import mongoose from 'mongoose';

const warningSchema = new mongoose.Schema(
  {
    targetUsername: {
      type: String,
      required: [true, 'Target username is required'],
      trim: true,
      lowercase: true
    },
    reason: {
      type: String,
      required: [true, 'Warning reason is required'],
      minlength: [5, 'Reason must be at least 5 characters'],
      maxlength: [1000, 'Reason must not exceed 1000 characters']
    },
    type: {
      type: String,
      enum: ['Heavy Warn', 'Light Warn'],
      required: [true, 'Warning type is required']
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Issuer is required']
    },
    issuedByUsername: {
      type: String,
      required: true
    },
    issuedAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['Active', 'Expired', 'Revoked'],
      default: 'Active'
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

// Middleware to calculate expiration date before saving
warningSchema.pre('save', function (next) {
  if (!this.expiresAt) {
    const expirationDays = this.type === 'Heavy Warn' ? 7 : 14;
    const expirationDate = new Date(this.issuedAt);
    expirationDate.setDate(expirationDate.getDate() + expirationDays);
    this.expiresAt = expirationDate;
  }
  next();
});

// Virtual to get remaining days
warningSchema.virtual('remainingDays').get(function () {
  if (this.status !== 'Active') return 0;
  const now = new Date();
  const diffTime = this.expiresAt - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
});

// Method to check and update expiration status
warningSchema.methods.checkExpiration = function () {
  if (this.status === 'Active' && new Date() > this.expiresAt) {
    this.status = 'Expired';
  }
  return this.status;
};

// Static method to update all expired warnings
warningSchema.statics.updateExpiredWarnings = async function () {
  const now = new Date();
  await this.updateMany(
    { status: 'Active', expiresAt: { $lt: now } },
    { status: 'Expired' }
  );
};

export default mongoose.model('Warning', warningSchema);
