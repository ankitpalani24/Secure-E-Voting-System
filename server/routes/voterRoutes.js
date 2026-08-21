const express = require("express");
const router = express.Router();

const { getProfile, getElections, castVote, faceVerify } = require("../controllers/voterController");
const { verifyToken, isVoter } = require("../middleware/authMiddleware");

router.get("/profile", verifyToken, isVoter, getProfile);
router.get("/elections", verifyToken, isVoter, getElections);
router.post("/vote", verifyToken, isVoter, castVote);
router.post("/face-verify", verifyToken, isVoter, faceVerify);

module.exports = router;
