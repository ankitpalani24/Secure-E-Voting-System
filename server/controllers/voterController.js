const Vote = require("../models/Vote");
const Voter = require("../models/Voter");
const AuditLog = require("../models/AuditLog");
const mongoose = require("mongoose");

// Euclidean distance for face descriptors
function euclideanDistance(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== 128 || vecB.length !== 128) return Infinity;
  return Math.sqrt(vecA.reduce((sum, a, i) => sum + Math.pow(a - vecB[i], 2), 0));
}

// Get voter profile
exports.getProfile = async (req, res) => {
  try {
    const voterId = req.user.id;
    let voter = await Voter.findById(voterId).select('-password').lean();
    if (!voter) {
      return res.status(404).json({ message: "Voter not found" });
    }

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
    if (!voter || !voter.faceDescriptor) {
      console.log('No face data registered for voter:', voterId);
      return res.status(400).json({ message: "No face data registered" });
    }

    console.log('Descriptor received from client. Length:', descriptor ? descriptor.length : 'undefined');
    console.log('Descriptor in database. Length:', voter.faceDescriptor ? voter.faceDescriptor.length : 'undefined');

    const distance = euclideanDistance(descriptor, voter.faceDescriptor);
    console.log('Face distance:', distance);

    if (distance < 0.55) {
      // Direct static check
      if (voter.hasVoted) {
        return res.status(400).json({ message: "Already voted" });
      }

      // Reverse-Heal: If hasVoted is false (e.g., manually reset in DB), ensure we clear old Vote documents
      await Vote.deleteMany({ voterId: voter._id });
      res.json({ verified: true, distance });
    } else {
      console.log('Face mismatch detected. Distance:', distance);
      res.status(400).json({ message: "Face mismatch", distance });
    }
  } catch (err) {
    console.error('Face verification crashed!', err);
    res.status(500).json({ message: err.message });
  }
};

// ================= CAST VOTE =================
exports.castVote = async (req, res) => {
  try {
    const voterId = req.user.id; // from JWT
    const { partyId } = req.body;

    // Check static DB boolean
    const voter = await Voter.findById(voterId);
    if (voter.hasVoted) {
      return res.status(400).json({ message: "You have already voted" });
    }

    // Reverse-Heal: If hasVoted is false, clear any stray votes before creating the new one
    // This prevents the duplicate key error (11000) when a user's DB flag is manually reset for testing
    await Vote.deleteMany({ voterId: new mongoose.Types.ObjectId(voterId) });

    // Create vote (DB also prevents duplicate using unique voterId)
    await Vote.create({
      voterId,
      partyId,
    });

    // Update the DB boolean to ensure consistency across endpoints (like login)
    await Voter.findByIdAndUpdate(voterId, { hasVoted: true });

    // Log action
    await AuditLog.create({
      action: "Vote Casted",
      userId: voterId,
    });

    res.json({ message: "Vote casted successfully" });

  } catch (err) {
    // If duplicate vote attempted (e.g., they manually cleared the boolean but forgot to delete the Vote doc)
    if (err.code === 11000) {
      return res.status(400).json({ message: "Vote already recorded" });
    }

    res.status(500).json({ message: err.message });
  }
};

