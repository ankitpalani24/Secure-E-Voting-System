const bcrypt = require("bcryptjs");
const Voter = require("../models/Voter");
const Party = require("../models/Party");
const Vote = require("../models/Vote");
const AuditLog = require("../models/AuditLog");

// Euclidean distance for face descriptors
function euclideanDistance(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== 128 || vecB.length !== 128) return Infinity;
  return Math.sqrt(vecA.reduce((sum, a, i) => sum + Math.pow(a - vecB[i], 2), 0));
}

// ================= ADD VOTER =================
exports.addVoter = async (req, res) => {
  try {
    const { name, email, password, faceDescriptor } = req.body;

    const existingVoter = await Voter.findOne({ email });
    if (existingVoter) {
      return res.status(400).json({ message: "Email already registered" });
    }

    if (!faceDescriptor || faceDescriptor.length !== 128) {
        return res.status(400).json({ message: "Invalid or missing face biometric data" });
    }

    // Check for duplicate faces
    const allVoters = await Voter.find({}, 'faceDescriptor email name');
    for (let i = 0; i < allVoters.length; i++) {
        const voterObj = allVoters[i].toObject();
        if (voterObj.faceDescriptor && voterObj.faceDescriptor.length === 128) {
            const distance = euclideanDistance(faceDescriptor, voterObj.faceDescriptor);
            console.log(`Checking against ${voterObj.name}: Distance = ${distance}`);
            if (distance < 0.55) {
                return res.status(400).json({ message: `Face already registered to voter: ${voterObj.name} (${voterObj.email})` });
            }
        }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const voter = await Voter.create({
      name,
      email,
      password: hashedPassword,
      faceDescriptor,
    });

    await AuditLog.create({
      action: "Voter Registered",
      userId: voter._id,
    });

    res.json({ message: "Voter added successfully", voter });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= ADD PARTY =================
exports.addParty = async (req, res) => {
  try {
    const { partyName, symbol, description, manifesto, email, username, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const party = await Party.create({
      partyName,
      symbol,
      description,
      username,
      password: hashedPassword,
    });

    res.json({ message: "Party added successfully", party });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= VIEW ALL VOTERS =================
exports.getVoters = async (req, res) => {
  try {
    const voters = await Voter.find().lean();
    
    // Fetch vote timestamps to display on the dashboard
    const castedVotes = await Vote.find({}, 'voterId timestamp').lean();
    const voteMap = {};
    castedVotes.forEach(v => {
        voteMap[v.voterId.toString()] = v.timestamp;
    });
    
    voters.forEach(voter => {
        const hasActualVote = !!voteMap[voter._id.toString()];
        voter.hasVoted = hasActualVote;
        
        if (hasActualVote) {
            voter.voteTimestamp = voteMap[voter._id.toString()];
        }
        
        // Background heal the underlying database if out of sync
        if (hasActualVote && !voter.hasVoted) {
            Voter.findByIdAndUpdate(voter._id, { hasVoted: true }).exec();
        } else if (!hasActualVote && voter.hasVoted) {
            Voter.findByIdAndUpdate(voter._id, { hasVoted: false }).exec();
        }
    });
    
    res.json(voters);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= VIEW ALL PARTIES =================
exports.getParties = async (req, res) => {
  const parties = await Party.find();
  res.json(parties);
};

// ================= DASHBOARD STATS =================
exports.getDashboardStats = async (req, res) => {
  try {
    const [votersCount, partiesCount, votesCount] = await Promise.all([
      Voter.countDocuments({}),
      Party.countDocuments({}),
      Vote.countDocuments({})
    ]);
    res.json({ votersCount, partiesCount, votesCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

