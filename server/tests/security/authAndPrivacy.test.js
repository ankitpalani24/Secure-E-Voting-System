const jwt = require("jsonwebtoken");
const { verifyToken, isAdmin, isVoter } = require("../../middleware/authMiddleware");

describe("Security Middleware - Authentication & RBAC", () => {
  const JWT_SECRET = "test_secret_key_12345678901234567890";
  process.env.JWT_SECRET = JWT_SECRET;

  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe("verifyToken Middleware", () => {
    test("rejects request with 403 when Authorization header is missing", () => {
      verifyToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "No token provided" });
      expect(next).not.toHaveBeenCalled();
    });

    test("rejects request with 401 when token is invalid or tampered", () => {
      req.headers["authorization"] = "Bearer invalid.fake.token";
      verifyToken(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: "Invalid token" });
      expect(next).not.toHaveBeenCalled();
    });

    test("passes and populates req.user when token is cryptographically valid", () => {
      const payload = { id: "user123", role: "voter" };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
      req.headers["authorization"] = `Bearer ${token}`;

      verifyToken(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe("user123");
      expect(req.user.role).toBe("voter");
    });
  });

  describe("isAdmin Role Guard", () => {
    test("allows access when req.user.role is 'admin'", () => {
      req.user = { id: "admin1", role: "admin" };
      isAdmin(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test("blocks access with 403 when req.user.role is 'voter'", () => {
      req.user = { id: "voter1", role: "voter" };
      isAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized access" });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("isVoter Role Guard", () => {
    test("allows access when req.user.role is 'voter'", () => {
      req.user = { id: "voter1", role: "voter" };
      isVoter(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test("blocks access with 403 when req.user.role is 'admin'", () => {
      req.user = { id: "admin1", role: "admin" };
      isVoter(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: "Unauthorized access" });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
