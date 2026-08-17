const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const dns = require("dns");

dns.setServers(["8.8.8.8", "1.1.1.1"]);

dotenv.config({ path: path.join(__dirname, "../.env") });

const Voter = require("../models/Voter");
const VoterParticipation = require("../models/VoterParticipation");
const Vote = require("../models/Vote");
const BiometricToken = require("../models/BiometricToken");

async function resetVote() {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/voting";
    console.log("Connecting to database...");
    await mongoose.connect(mongoUri);

    // Search for voter by name or email matching "ankit"
    const voters = await Voter.find({
      $or: [
        { name: { $regex: /ankit/i } },
        { email: { $regex: /ankit/i } }
      ]
    });

    if (!voters || voters.length === 0) {
      console.log("No voter found with name/email matching 'ankit'. Listing all voters:");
      const allVoters = await Voter.find({}, "name email voterId");
      console.log(JSON.stringify(allVoters, null, 2));
      process.exit(0);
    }

    console.log(`Found ${voters.length} voter(s) matching 'ankit':`);
    for (const v of voters) {
      console.log(`- Voter: ${v.name} | Email: ${v.email} | ID: ${v._id}`);

      // Delete VoterParticipation records
      const vpRes = await VoterParticipation.deleteMany({ voterId: v._id });
      console.log(`  Deleted ${vpRes.deletedCount} VoterParticipation record(s).`);

      // Delete legacy Vote records
      const vRes = await Vote.deleteMany({ voterId: v._id });
      console.log(`  Deleted ${vRes.deletedCount} legacy Vote record(s).`);

      // Delete any active or used BiometricToken records
      const btRes = await BiometricToken.deleteMany({ voterId: v._id });
      console.log(`  Deleted ${btRes.deletedCount} BiometricToken record(s).`);
    }

    console.log("\nVote participation has been successfully reset! You can now test the entire voting flow again.");
    process.exit(0);
  } catch (err) {
    console.error("Error resetting vote:", err);
    process.exit(1);
  }
}

resetVote();
