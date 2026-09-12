import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: [
        'User Created',
        'User Deleted',
        'User Edited',
        'Password Changed',
        'Warning Issued',
        'Warning Edited',
        'Warning Revoked',
        'Blacklist Added',
        'Blacklist Edited',
        'Blacklist Removed',
        'Login',
        'Logout',
        'Role Changed',
        'Account Disabled',
        'Account Enabled'
      ],
      required: true,
      index: true
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    performedByUsername: {
      type: String,
      required: true
    },
    target: {
      type: String,
      default: null,
      index: true
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: false }
);

// Index for efficient querying
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ performedBy: 1, createdAt: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
