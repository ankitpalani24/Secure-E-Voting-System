const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config();

const Admin = require("./models/Admin");

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log("MongoDB connected for test admin creation");

        // Create Ankit
        const hashed1 = await bcrypt.hash("ankit123", 10);
        await Admin.findOneAndUpdate(
            { username: "Ankit" },
            { username: "Ankit", password: hashed1 },
            { upsert: true }
        );

        // Create Het
        const hashed2 = await bcrypt.hash("het123", 10);
        await Admin.findOneAndUpdate(
            { username: "Het" },
            { username: "Het", password: hashed2 },
            { upsert: true }
        );

        console.log("Test admins created:");
        console.log("Ankit / ankit123");
        console.log("Het / het123");
        console.log("Original admin/admin123 also works");

        process.exit();
    })
    .catch((err) => {
        console.error("Error:", err);
        process.exit(1);
    });

