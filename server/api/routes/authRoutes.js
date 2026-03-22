const express = require("express");
const router = express.Router();

const {
  adminLogin,
  voterLogin,
  partyLogin
} = require("../controllers/authController");

router.post("/admin-login", adminLogin);
router.post("/voter-login", voterLogin);
router.post("/party-login", partyLogin);


module.exports = router;
