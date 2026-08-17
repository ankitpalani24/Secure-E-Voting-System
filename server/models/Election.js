const mongoose = require("mongoose");

const electionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      default: "General Election",
    },
    description: {
      type: String,
      default: "Standard electronic democratic election.",
    },
    electionType: {
      type: String,
      enum: ["NATIONAL", "STATE", "MUNICIPAL", "ORGANIZATIONAL", "GENERAL"],
      default: "GENERAL",
    },
    phase: {
      type: String,
      enum: [
        "DRAFT",
        "REGISTRATION",
        "SCHEDULED",
        "VOTING",
        "CLOSED",
        "TALLIED",
        "PUBLISHED",
        "ARCHIVED",
      ],
      default: "VOTING", // Default to VOTING for non-breaking backward compatibility
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
    },
    constituencies: {
      type: [String],
      default: ["Default Constituency"],
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    isDefault: {
      type: Boolean,
      default: true,
    },
    manifestHash: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

electionSchema.index({ phase: 1 });
electionSchema.index({ isDefault: 1 });

module.exports = mongoose.model("Election", electionSchema);
