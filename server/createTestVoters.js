const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config();

const Voter = require("./models/Voter");

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected for test voter creation");

    // Create ankit@voter
    const hashed1 = await bcrypt.hash("voter123", 10);
    await Voter.findOneAndUpdate(
      { email: "ankit@voter" },
      { name: "Ankit", email: "ankit@voter", password: hashed1 },
      { upsert: true }
    );

    // Create het@voter
    const hashed2 = await bcrypt.hash("voter123", 10);
    await Voter.findOneAndUpdate(
      { email: "het@voter" },
      { name: "Het", email: "het@voter", password: hashed2 },
      { upsert: true }
    );

    console.log("Test voters created:");
    console.log("ankit@voter / voter123");
    console.log("het@voter / voter123");
    
    process.exit();
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });

