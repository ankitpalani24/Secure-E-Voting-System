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

    const voteExists = await Vote.findOne({ voterId: new mongoose.Types.ObjectId(voterId) });
    
    // Strict Bi-Directional DB Sync
    if (voteExists && !voter.hasVoted) {
      await Voter.findByIdAndUpdate(voterId, { hasVoted: true });
      voter.hasVoted = true;
    } else if (!voteExists && voter.hasVoted) {
      await Voter.findByIdAndUpdate(voterId, { hasVoted: false });
      voter.hasVoted = false;
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

    // Tightened threshold from 0.60 to 0.55 due to the more accurate SsdMobilenetv1 embeddings
    if (distance < 0.55) {
      // Strict Bi-Directional DB Sync
      const voteExists = await Vote.findOne({ voterId: voter._id });
      if (voteExists) {
        if (!voter.hasVoted) await Voter.findByIdAndUpdate(voter._id, { hasVoted: true });
        return res.status(400).json({ message: "Already voted" });
      } else {
        if (voter.hasVoted) await Voter.findByIdAndUpdate(voter._id, { hasVoted: false });
      }
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

    const voter = await Voter.findById(voterId);
    if (!voter) {
      return res.status(404).json({ message: "Voter not found" });
    }

    // Strict Bi-Directional DB Sync
    const voteExists = await Vote.findOne({ voterId: new mongoose.Types.ObjectId(voterId) });
    if (voteExists) {
      if (!voter.hasVoted) await Voter.findByIdAndUpdate(voterId, { hasVoted: true });
      return res.status(400).json({ message: "You have already voted" });
    } else {
      if (voter.hasVoted) await Voter.findByIdAndUpdate(voterId, { hasVoted: false });
    }

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

    // Emit real-time event via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('newVote', { partyId, voterId });
    }

    res.json({ message: "Vote casted successfully" });

  } catch (err) {
    // If duplicate vote attempted (e.g., they manually cleared the boolean but forgot to delete the Vote doc)
    if (err.code === 11000) {
      return res.status(400).json({ message: "Vote already recorded" });
    }

    res.status(500).json({ message: err.message });
  }
};

