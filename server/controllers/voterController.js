const Vote = require("../models/Vote");
const Voter = require("../models/Voter");
const AuditLog = require("../models/AuditLog");

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

    // Dynamically sync hasVoted status based on the strict presence of an actual ballot
    const voteExists = await Vote.findOne({ voterId });
    voter.hasVoted = !!voteExists;

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
      if (voter.hasVoted) {
        return res.status(400).json({ message: "Already voted" });
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

    // Check if voter already voted using hasVoted flag
    const voter = await Voter.findById(voterId);
    if (voter.hasVoted) {
      return res.status(400).json({ message: "You have already voted" });
    }

    // Create vote (DB also prevents duplicate using unique voterId)
    await Vote.create({
      voterId,
      partyId,
    });

    // Update voter status
    voter.hasVoted = true;
    await voter.save();

    // Log action
    await AuditLog.create({
      action: "Vote Casted",
      userId: voterId,
    });

    res.json({ message: "Vote casted successfully" });

  } catch (err) {
    // If duplicate vote attempted
    if (err.code === 11000) {
      return res.status(400).json({ message: "Vote already recorded" });
    }

    res.status(500).json({ message: err.message });
  }
};

