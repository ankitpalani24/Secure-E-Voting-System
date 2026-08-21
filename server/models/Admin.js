const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      trim: true,
      default: "Electoral Officer",
    },
    role: {
      type: String,
      enum: ["SUPER_ADMIN", "ELECTION_ADMIN", "AUDITOR", "admin"],
      default: "ELECTION_ADMIN",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

adminSchema.index({ role: 1 });

module.exports = mongoose.model("Admin", adminSchema);
