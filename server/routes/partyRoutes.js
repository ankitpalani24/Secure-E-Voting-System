const express = require("express");
const router = express.Router();

const { getParties } = require("../controllers/adminController");
const { verifyToken } = require("../middleware/authMiddleware");

router.get("/", verifyToken, getParties);

module.exports = router;
