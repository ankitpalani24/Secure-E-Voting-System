const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  action: String,
  userId: mongoose.Schema.Types.ObjectId,
  userRole: String,
  time: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("AuditLog", auditLogSchema);
