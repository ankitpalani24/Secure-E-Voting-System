const Vote = require("../models/Vote");
const Party = require("../models/Party");

// ================= GET RESULTS =================
exports.getResults = async (req, res) => {
  try {
    const results = await Vote.aggregate([
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
          partyName: "$partyDetails.partyName",
          symbol: "$partyDetails.symbol",
          totalVotes: 1,
        },
      },
    ]);

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
