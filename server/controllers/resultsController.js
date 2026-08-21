const mongoose = require("mongoose");
const AnonymousBallot = require("../models/AnonymousBallot");
const Party = require("../models/Party");
const Election = require("../models/Election");
const { canViewResults } = require("../utils/electionEngine");
const logger = require("../utils/logger");

// ================= GET RESULTS =================
exports.getResults = async (req, res) => {
  try {
    const { electionId } = req.query;
    const userRole = req.user ? req.user.role : "public";

    // 1. Resolve Target Election
    let election = null;
    if (electionId) {
      if (!mongoose.Types.ObjectId.isValid(electionId)) {
        return res.status(400).json({ message: "Invalid election identifier format" });
      }
      election = await Election.findById(electionId);
    } else {
      election = (await Election.findOne({ isDefault: true })) || (await Election.findOne({ phase: "VOTING" })) || (await Election.findOne().sort({ createdAt: -1 }));
    }

    if (!election) {
      return res.status(404).json({ message: "No active election found for result aggregation." });
    }

    // 2. Embargo Enforcement: Non-admins cannot view tally if embargoed
    if (!canViewResults(election, userRole)) {
      return res.status(403).json({
        message: "Official election tally results are embargoed until voting concludes and certified results are published.",
        electionId: election._id,
        phase: election.phase,
        resultsPublished: false,
        results: [],
      });
    }

    // 3. Isolated Aggregation Pipeline Scoped Exclusively to this Election
    const targetObjectId = new mongoose.Types.ObjectId(election._id);

    const pipeline = [
      {
        $match: { electionId: targetObjectId },
      },
      {
        $group: {
          _id: "$partyId",
          totalVotes: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "parties",
          localField: "_id",
          foreignField: "_id",
          as: "partyDetails",
        },
      },
      {
        $unwind: {
          path: "$partyDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          partyId: "$_id",
          partyName: { $ifNull: ["$partyDetails.partyName", "Unknown Slate"] },
          symbol: { $ifNull: ["$partyDetails.symbol", "🏛️"] },
          totalVotes: 1,
        },
      },
      {
        $sort: { totalVotes: -1 },
      },
    ];

    const results = await AnonymousBallot.aggregate(pipeline);

    res.json(results);
  } catch (err) {
    logger.error("Get results error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to retrieve election tally results" });
  }
};
