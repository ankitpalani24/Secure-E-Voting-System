const jwt = require("jsonwebtoken");

// ===== Verify Token =====
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || typeof authHeader !== "string") {
    return res.status(403).json({ message: "No token provided" });
  }

  const parts = authHeader.trim().split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer" || !parts[1]) {
    return res.status(401).json({ message: "Invalid authorization format" });
  }

  try {
    const decoded = jwt.verify(parts[1], process.env.JWT_SECRET, {
      algorithms: ["HS256"],
    });
    if (!decoded || !decoded.id || !decoded.role) {
      return res.status(401).json({ message: "Malformed token claims" });
    }
    req.user = decoded; // contains id, role, username
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

// ===== Check Any Admin Role (including Auditor) =====
exports.isAdmin = (req, res, next) => {
  const allowed = ["admin", "SUPER_ADMIN", "ELECTION_ADMIN", "AUDITOR"];
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({ message: "Unauthorized access" });
  }
  next();
};

// ===== Check Election Mutation Permission (Blocks Read-Only Auditor) =====
exports.canMutateElection = (req, res, next) => {
  const allowed = ["admin", "SUPER_ADMIN", "ELECTION_ADMIN"];
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({ message: "Unauthorized access" });
  }
  next();
};

// ===== Check Super Admin Permission =====
exports.isSuperAdmin = (req, res, next) => {
  const allowed = ["admin", "SUPER_ADMIN"];
  if (!req.user || !allowed.includes(req.user.role)) {
    return res.status(403).json({ message: "Unauthorized access" });
  }
  next();
};

// ===== Check Voter Role =====
exports.isVoter = (req, res, next) => {
  if (!req.user || req.user.role !== "voter") {
    return res.status(403).json({ message: "Unauthorized access" });
  }
  next();
};

// ===== Check Party Role =====
exports.isParty = (req, res, next) => {
  if (!req.user || req.user.role !== "party") {
    return res.status(403).json({ message: "Unauthorized access" });
  }
  next();
};
