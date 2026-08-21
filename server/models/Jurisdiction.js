const mongoose = require("mongoose");

/**
 * ==============================================================================
 * JURISDICTION DATA MODEL
 * ==============================================================================
 * Represents hierarchical geopolitical and institutional jurisdictions
 * (Country -> State -> District -> Municipality -> Constituency / Institution).
 * ==============================================================================
 */

const JURISDICTION_TYPES = Object.freeze([
  "COUNTRY",
  "STATE",
  "DISTRICT",
  "MUNICIPALITY",
  "CONSTITUENCY",
  "INSTITUTION",
]);

const jurisdictionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: JURISDICTION_TYPES,
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Jurisdiction",
      default: null,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

jurisdictionSchema.index({ code: 1 }, { unique: true });
jurisdictionSchema.index({ parentId: 1 });
jurisdictionSchema.index({ type: 1 });
jurisdictionSchema.index({ status: 1 });

module.exports = mongoose.model("Jurisdiction", jurisdictionSchema);
module.exports.JURISDICTION_TYPES = JURISDICTION_TYPES;
