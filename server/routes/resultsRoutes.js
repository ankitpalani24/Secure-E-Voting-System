const express = require("express");
const router = express.Router();

const { getResults } = require("../controllers/resultsController");
const { verifyToken } = require("../middleware/authMiddleware");

router.get("/", verifyToken, getResults);

module.exports = router;
