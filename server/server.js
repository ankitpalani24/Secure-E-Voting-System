// ================== IMPORTS ==================
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

// Load env variables
dotenv.config();

// ================== APP INIT ==================
const app = express();

// ================== MIDDLEWARE ==================
app.use(cors());
app.use(express.json()); // to read JSON data from frontend

// ================== ROUTES IMPORT ==================
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const voterRoutes = require("./routes/voterRoutes");
const partyRoutes = require("./routes/partyRoutes");
const resultsRoutes = require("./routes/resultsRoutes");


// ================== ROUTES ==================
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/voter", voterRoutes);
app.use("/api/party", partyRoutes);
app.use("/api/results", resultsRoutes);


// ================== DEFAULT ROUTE ==================
app.get("/", (req, res) => {
  res.send("Secure Online Voting System API is running...");
});

// ================== ERROR HANDLER ==================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// ================== DATABASE CONNECTION ==================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected Successfully");

    // Start server locally ONLY if not in Vercel production
    if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    }
  })
  .catch((err) => {
    console.error("MongoDB Connection Failed:", err);
  });

// Export Express app for Vercel Serverless execution
module.exports = app;
