const express = require("express");
const router = express.Router();

const {
  addVoter,
  addParty,
  getVoters,
  getParties,
  getDashboardStats,
} = require("../controllers/adminController");

const { verifyToken, isAdmin } = require("../middleware/authMiddleware");

// 🔒 PROTECTED ROUTES
router.post("/add-voter", verifyToken, isAdmin, addVoter);
router.post("/add-party", verifyToken, isAdmin, addParty);
router.get("/voters", verifyToken, isAdmin, getVoters);
router.get("/parties", verifyToken, isAdmin, getParties);
router.get("/stats", verifyToken, isAdmin, getDashboardStats);

module.exports = router;

