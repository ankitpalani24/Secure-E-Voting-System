const crypto = require("crypto");

/**
 * Attaches a unique request correlation ID to every incoming request.
 * Sets the 'X-Request-ID' header on the response.
 */
function requestIdMiddleware(req, res, next) {
  const incomingId = req.headers["x-request-id"];
  const requestId = typeof incomingId === "string" && incomingId.trim()
    ? incomingId.trim().slice(0, 64)
    : crypto.randomUUID();

  req.id = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
}

module.exports = requestIdMiddleware;
