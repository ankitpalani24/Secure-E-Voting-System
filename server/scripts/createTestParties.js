const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config();

const Party = require("./models/Party");

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected for test party creation");

    // Create ankit@party
    const hashed1 = await bcrypt.hash("party123", 10);
    await Party.findOneAndUpdate(
      { username: "ankit@party" },
      { partyName: "Ankit Party", username: "ankit@party", password: hashed1 },
      { upsert: true }
    );

    // Create het@party
    const hashed2 = await bcrypt.hash("party123", 10);
    await Party.findOneAndUpdate(
      { username: "het@party" },
      { partyName: "Het Party", username: "het@party", password: hashed2 },
      { upsert: true }
    );

    console.log("Test parties created:");
    console.log("ankit@party / party123");
    console.log("het@party / party123");
    
    process.exit();
  })
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  });

