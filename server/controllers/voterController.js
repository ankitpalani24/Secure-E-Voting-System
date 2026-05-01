const Vote = require("../models/Vote");
const Voter = require("../models/Voter");
const AuditLog = require("../models/AuditLog");
const mongoose = require("mongoose");
const { euclideanDistance } = require("../utils/faceUtils");

// ================= GET VOTER PROFILE =================
exports.getProfile = async (req, res) => {
  try {
    const voterId = req.user.id;

    const voter = await Voter.findById(voterId).select("-password").lean();
    if (!voter) {
      return res.status(404).json({ message: "Voter not found" });
    }

    // Derive hasVoted from the Vote collection — single source of truth
    const hasVoted = await Vote.exists({ voterId: new mongoose.Types.ObjectId(voterId) });
    voter.hasVoted = !!hasVoted;

    res.json(voter);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= FACE VERIFICATION =================
exports.faceVerify = async (req, res) => {
  try {
    const voterId = req.user.id;
    const { descriptor } = req.body;

    const voter = await Voter.findById(voterId);
    if (!voter || !voter.faceDescriptor || voter.faceDescriptor.length === 0) {
      return res.status(400).json({ message: "No face data registered" });
    }

    const distance = euclideanDistance(descriptor, voter.faceDescriptor);

    // Tightened threshold: 0.55 works well with SsdMobilenetv1 embeddings
    if (distance < 0.55) {
      // Check whether voter has already voted (derived, not from boolean field)
      const voteExists = await Vote.exists({ voterId: voter._id });
      if (voteExists) {
        return res.status(400).json({ message: "Already voted" });
      }
      res.json({ verified: true, distance });
    } else {
      res.status(400).json({ message: "Face mismatch", distance });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= CAST VOTE =================
exports.castVote = async (req, res) => {
  try {
    const voterId = req.user.id; // from JWT
    const { partyId } = req.body;

    const voter = await Voter.findById(voterId);
    if (!voter) {
      return res.status(404).json({ message: "Voter not found" });
    }

    // Derive whether voter has already voted from the Vote collection
    const voteExists = await Vote.exists({ voterId: new mongoose.Types.ObjectId(voterId) });
    if (voteExists) {
      return res.status(400).json({ message: "You have already voted" });
    }

    // Create the vote record (DB unique index on voterId prevents any race condition duplicate)
    await Vote.create({ voterId, partyId });

    await AuditLog.create({
      action: "Vote Casted",
      userId: voterId,
      userRole: "voter",
    });

    // Emit real-time event if Socket.io is configured
    const io = req.app.get("io");
    if (io) {
      io.emit("newVote", { partyId, voterId });
    }

    res.json({ message: "Vote casted successfully" });
  } catch (err) {
    // Catch any race-condition duplicate that slips past the exists() check
    if (err.code === 11000) {
      return res.status(400).json({ message: "Vote already recorded" });
    }
    res.status(500).json({ message: err.message });
  }
};
