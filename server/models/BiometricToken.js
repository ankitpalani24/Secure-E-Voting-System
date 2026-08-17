const mongoose = require("mongoose");

/**
 * Short-lived single-use authorization token issued upon successful server-side face verification.
 * Must be presented and consumed during ballot casting to prevent biometric bypass.
 */
const biometricTokenSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
    },
    voterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Voter",
      required: true,
    },
    electionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Election",
    },
    used: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 5 * 60 * 1000), // 5 minutes TTL
    },
  },
  {
    timestamps: true,
  }
);

// TTL index automatically deletes expired tokens from MongoDB
biometricTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
biometricTokenSchema.index({ token: 1, voterId: 1 });

module.exports = mongoose.model("BiometricToken", biometricTokenSchema);
