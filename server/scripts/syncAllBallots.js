const crypto = require("crypto");
const mongoose = require("mongoose");
const config = require("../config/config");
const Voter = require("../models/Voter");
const Vote = require("../models/Vote");
const VoterParticipation = require("../models/VoterParticipation");
const AnonymousBallot = require("../models/AnonymousBallot");
const Election = require("../models/Election");

async function syncBallots() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log("Connected to MongoDB for ballot synchronization...");

    const defaultElection = (await Election.findOne({ isDefault: true })) || (await Election.findOne().sort({ createdAt: -1 }));
    if (!defaultElection) {
      console.error("No default election found.");
      process.exit(1);
    }
    console.log("Target Election:", defaultElection.title, "(ID:", defaultElection._id.toString(), ")");

    // 1. Find all legacy votes
    const legacyVotes = await Vote.find({});
    console.log(`Found ${legacyVotes.length} legacy votes in 'Vote' collection.`);

    let migratedCount = 0;

    for (const lv of legacyVotes) {
      // Check if VoterParticipation already exists
      const existingParticipation = await VoterParticipation.findOne({
        voterId: lv.voterId,
        electionId: defaultElection._id,
      });

      if (!existingParticipation) {
        // Create VoterParticipation
        await VoterParticipation.create({
          voterId: lv.voterId,
          electionId: defaultElection._id,
          participatedAt: lv.timestamp || new Date(),
          verificationMethod: "FACE_BIOMETRIC",
        });

        // Generate non-correlatable commitment hash
        const nonce = crypto.randomBytes(16).toString("hex");
        const commitmentHash = crypto
          .createHash("sha256")
          .update(defaultElection._id.toString() + lv.partyId.toString() + nonce)
          .digest("hex");

        // Create AnonymousBallot using crypto.randomUUID()
        await AnonymousBallot.create({
          _id: crypto.randomUUID(),
          electionId: defaultElection._id,
          partyId: lv.partyId,
          ballotCommitmentHash: commitmentHash,
        });

        // Ensure Voter record has hasVoted: true
        await Voter.findByIdAndUpdate(lv.voterId, { hasVoted: true });

        migratedCount++;
        console.log(`Migrated legacy vote for voter ${lv.voterId} to party ${lv.partyId}.`);
      } else {
        console.log(`Voter ${lv.voterId} already has VoterParticipation record.`);
      }
    }

    // Also remove any duplicate Vote records to keep data clean
    await Vote.deleteMany({});
    console.log("Cleared legacy 'Vote' collection to prevent double counting.");

    const totalParticipations = await VoterParticipation.countDocuments({ electionId: defaultElection._id });
    const totalBallots = await AnonymousBallot.countDocuments({ electionId: defaultElection._id });

    console.log("\n==========================================");
    console.log(`BALLOT SYNC COMPLETED SUCCESSFULLY`);
    console.log(`Total Participations: ${totalParticipations}`);
    console.log(`Total Anonymous Ballots: ${totalBallots}`);
    console.log(`Decoupled Invariant: ${totalParticipations === totalBallots ? "MATCHED (100% INTACT)" : "MISMATCH"}`);
    console.log("==========================================\n");

    process.exit(0);
  } catch (err) {
    console.error("Ballot sync error:", err);
    process.exit(1);
  }
}

syncBallots();
