const express = require("express");
const router = express.Router();

const {
  addVoter,
  addParty,
  getVoters,
  getParties,
  getDashboardStats,
  getElections,
  createElection,
  updateElectionPhase,
  getAuditLogs,
  verifyAuditChainEndpoint,
} = require("../controllers/adminController");

const { verifyToken, isAdmin } = require("../middleware/authMiddleware");

// 🔒 PROTECTED ADMIN ROUTES
router.post("/add-voter", verifyToken, isAdmin, addVoter);
router.post("/add-party", verifyToken, isAdmin, addParty);
router.get("/voters", verifyToken, isAdmin, getVoters);
router.get("/parties", verifyToken, isAdmin, getParties);
router.get("/stats", verifyToken, isAdmin, getDashboardStats);
router.get("/elections", verifyToken, isAdmin, getElections);
router.post("/create-election", verifyToken, isAdmin, createElection);
router.post("/update-phase", verifyToken, isAdmin, updateElectionPhase);
router.get("/audit-logs", verifyToken, isAdmin, getAuditLogs);
router.get("/audit-verify", verifyToken, isAdmin, verifyAuditChainEndpoint);

module.exports = router;
