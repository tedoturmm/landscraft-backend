import AuditLog from '../models/AuditLog.js';

export const logAction = async (action, performedBy, target = null, details = null) => {
  try {
    const log = new AuditLog({
      action,
      performedBy: performedBy._id,
      performedByUsername: performedBy.username,
      target,
      details
    });

    await log.save();
  } catch (error) {
    console.error('Error creating audit log:', error.message);
  }
};
