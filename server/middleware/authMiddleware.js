const jwt = require("jsonwebtoken");

// ===== Verify Token =====
exports.verifyToken = (req, res, next) => {
  const token = req.headers["authorization"];

  if (!token) {
    return res.status(403).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
    req.user = decoded; // contains id and role
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// ===== Check Admin Role =====
exports.isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Unauthorized access" });
  }
  next();
};

// ===== Check Voter Role =====
exports.isVoter = (req, res, next) => {
  if (req.user.role !== "voter") {
    return res.status(403).json({ message: "Unauthorized access" });
  }
  next();
};
