// ================== IMPORTS ==================
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

// Load env variables
dotenv.config();

// ================== APP INIT ==================
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });
app.set("io", io);

io.on("connection", (socket) => {
    console.log("Real-time client connected");
    socket.on("disconnect", () => console.log("Real-time client disconnected"));
});

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
      server.listen(PORT, () => {
        console.log(`Server running on port ${PORT} with WebSockets`);
      });
    }
  })
  .catch((err) => {
    console.error("MongoDB Connection Failed:", err);
  });

// Export Express app for Vercel Serverless execution
module.exports = app;
