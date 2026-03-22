const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config();

const Admin = require("./models/Admin");

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected for admin creation");

    const existingAdmin = await Admin.findOne({ username: "admin" });
    if (existingAdmin) {
      console.log("Admin already exists");
      process.exit();
    }

    const hashedPassword = await bcrypt.hash("admin123", 10);

    await Admin.create({
      username: "admin",
      password: hashedPassword,
    });

    console.log("Admin created successfully!");
    process.exit();
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
