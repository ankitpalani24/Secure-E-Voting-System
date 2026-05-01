const bcrypt = require("bcryptjs");
const Voter = require("../models/Voter");
const Party = require("../models/Party");
const Vote = require("../models/Vote");
const AuditLog = require("../models/AuditLog");
const { euclideanDistance } = require("../utils/faceUtils");

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

    // Check for duplicate faces (O(n) — acceptable for small voter sets)
    const allVoters = await Voter.find({}, "faceDescriptor email name");
    for (let i = 0; i < allVoters.length; i++) {
      const voterObj = allVoters[i].toObject();
      if (voterObj.faceDescriptor && voterObj.faceDescriptor.length === 128) {
        const distance = euclideanDistance(faceDescriptor, voterObj.faceDescriptor);
        if (distance < 0.55) {
          return res.status(400).json({ message: "Face is already registered" });
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
      userRole: "voter",
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

    // Explicit duplicate checks before attempting to insert
    const existingByName = await Party.findOne({ partyName });
    if (existingByName) {
      return res.status(400).json({ message: "A party with that name already exists" });
    }

    const existingByUsername = await Party.findOne({ username });
    if (existingByUsername) {
      return res.status(400).json({ message: "That party ID (username) is already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const party = await Party.create({
      partyName,
      symbol,
      description,
      manifesto,
      username,
      password: hashedPassword,
    });

    res.json({ message: "Party added successfully", party });
  } catch (err) {
    // Fallback: catch any MongoDB unique index violation that slips through
    if (err.code === 11000) {
      return res.status(400).json({ message: "Party name or username already exists" });
    }
    res.status(500).json({ message: err.message });
  }
};

// ================= VIEW ALL VOTERS =================
exports.getVoters = async (req, res) => {
  try {
    // Fetch voters without the password field
    const voters = await Voter.find({}, "-password").lean();

    // Derive vote status from the Vote collection (single source of truth)
    const castedVotes = await Vote.find({}, "voterId timestamp").lean();
    const voteMap = {};
    castedVotes.forEach((v) => {
      voteMap[v.voterId.toString()] = v.timestamp;
    });

    voters.forEach((voter) => {
      const voteTimestamp = voteMap[voter._id.toString()];
      voter.hasVoted = !!voteTimestamp;
      if (voteTimestamp) voter.voteTimestamp = voteTimestamp;
    });

    res.json(voters);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= VIEW ALL PARTIES =================
exports.getParties = async (req, res) => {
  try {
    const parties = await Party.find({}, "-password");
    res.json(parties);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ================= DASHBOARD STATS =================
exports.getDashboardStats = async (req, res) => {
  try {
    const [votersCount, partiesCount, votesCount] = await Promise.all([
      Voter.countDocuments({}),
      Party.countDocuments({}),
      Vote.countDocuments({}),
    ]);
    res.json({ votersCount, partiesCount, votesCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
