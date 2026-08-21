const express = require("express");
const router = express.Router();

const {
  addVoter,
  addParty,
  getVoters,
  getParties,
  getDashboardStats,
  getElections,
  getElectionById,
  createElection,
  enrollVotersToElection,
  updateElectionPhase,
  getJurisdictions,
  createJurisdiction,
  getAuditLogs,
  verifyAuditChainEndpoint,
} = require("../controllers/adminController");

const {
  createProposal,
  getProposals,
  approveProposal,
  rejectProposal,
  getGovernanceSummary,
} = require("../controllers/governanceController");

const { verifyToken, isAdmin, canMutateElection } = require("../middleware/authMiddleware");

// 🔒 PROTECTED READ-ONLY ADMIN / AUDITOR ROUTES
router.get("/stats", verifyToken, isAdmin, getDashboardStats);
router.get("/voters", verifyToken, isAdmin, getVoters);
router.get("/parties", verifyToken, isAdmin, getParties);
router.get("/elections", verifyToken, isAdmin, getElections);
router.get("/elections/:id", verifyToken, isAdmin, getElectionById);
router.get("/jurisdictions", verifyToken, isAdmin, getJurisdictions);
router.get("/audit-logs", verifyToken, isAdmin, getAuditLogs);
router.get("/audit-verify", verifyToken, isAdmin, verifyAuditChainEndpoint);
router.get("/proposals", verifyToken, isAdmin, getProposals);
router.get("/governance/summary", verifyToken, isAdmin, getGovernanceSummary);

// 🔒 PROTECTED OPERATIONAL MUTATION ROUTES (ELECTION_ADMIN / SUPER_ADMIN)
router.post("/add-voter", verifyToken, canMutateElection, addVoter);
router.post("/add-party", verifyToken, canMutateElection, addParty);
router.post("/jurisdictions", verifyToken, canMutateElection, createJurisdiction);
router.post("/elections", verifyToken, canMutateElection, createElection);
router.post("/create-election", verifyToken, canMutateElection, createElection);
router.post("/elections/:id/eligibility", verifyToken, canMutateElection, enrollVotersToElection);
router.post("/update-phase", verifyToken, canMutateElection, updateElectionPhase);

// 🔒 TWO-PERSON GOVERNANCE PROPOSAL & APPROVAL ENDPOINTS
router.post("/proposals", verifyToken, canMutateElection, createProposal);
router.post("/proposals/:id/approve", verifyToken, canMutateElection, approveProposal);
router.post("/proposals/:id/reject", verifyToken, canMutateElection, rejectProposal);

module.exports = router;
