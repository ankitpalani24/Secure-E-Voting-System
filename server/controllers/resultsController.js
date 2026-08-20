const crypto = require("crypto");
const AnonymousBallot = require("../models/AnonymousBallot");
const Vote = require("../models/Vote");
const Party = require("../models/Party");
const Election = require("../models/Election");
const { canViewResults, ELECTION_PHASES } = require("../utils/electionEngine");
const logger = require("../utils/logger");

// ================= GET RESULTS =================
exports.getResults = async (req, res) => {
  try {
    const { electionId } = req.query;
    const userRole = req.user ? req.user.role : "public";

    // 1. Look up Election
    let election = null;
    if (electionId) {
      election = await Election.findById(electionId);
    } else {
      election = await Election.findOne({ isDefault: true }) || await Election.findOne().sort({ createdAt: -1 });
    }

    // 2. Embargo Enforcement: Non-admins cannot view tally if embargoed
    if (election && !canViewResults(election, userRole)) {
      return res.status(403).json({
        message: "Official election tally results are embargoed until voting concludes and certified results are published.",
        phase: election.phase,
        resultsPublished: false,
        results: [],
      });
    }

    // Build match stage
    const matchStage = {};
    if (electionId) {
      matchStage.electionId = new (require("mongoose").Types.ObjectId)(electionId);
    }

    // Check if AnonymousBallot has records
    const anonymousBallotCount = await AnonymousBallot.countDocuments(matchStage);

    let aggregationModel = AnonymousBallot;
    if (anonymousBallotCount === 0) {
      // Fallback to legacy Vote collection if old data exists
      aggregationModel = Vote;
    }

    const pipeline = [];
    if (Object.keys(matchStage).length > 0 && aggregationModel === AnonymousBallot) {
      pipeline.push({ $match: matchStage });
    }

    pipeline.push(
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
        $unwind: "$partyDetails",
      },
      {
        $project: {
          _id: 0,
          partyId: "$_id",
          partyName: "$partyDetails.partyName",
          symbol: "$partyDetails.symbol",
          totalVotes: 1,
        },
      },
      {
        $sort: { totalVotes: -1 },
      }
    );

    const results = await aggregationModel.aggregate(pipeline);

    // Compute cryptographic manifest hash of the current result set
    const resultsString = JSON.stringify(results);
    const manifestHash = crypto.createHash("sha256").update(resultsString).digest("hex");

    res.json(results);
  } catch (err) {
    logger.error("Get results error: " + err.message, { requestId: req.id });
    res.status(500).json({ message: "Failed to retrieve election tally results" });
  }
};
