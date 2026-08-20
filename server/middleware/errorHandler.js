const logger = require("../utils/logger");

/**
 * Centralized Express Error Handling Middleware.
 * Prevents stack traces, database internals, and sensitive filesystem paths from leaking to clients.
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || (res.statusCode && res.statusCode >= 400 ? res.statusCode : 500);
  const requestId = req.id || "N/A";

  // Structured server-side error logging (with stack trace)
  logger.error(err.message || "Unhandled server error", {
    requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    statusCode,
    details: {
      name: err.name,
      code: err.code,
      stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
    },
  });

  // Safe client-facing error message mapping
  let clientMessage = "An unexpected server error occurred. Please try again later.";

  if (statusCode === 400) {
    clientMessage = err.message || "Invalid request payload or parameters.";
  } else if (statusCode === 401) {
    clientMessage = err.message || "Authentication required.";
  } else if (statusCode === 403) {
    clientMessage = err.message || "Access denied.";
  } else if (statusCode === 404) {
    clientMessage = err.message || "Requested resource not found.";
  } else if (statusCode === 409) {
    clientMessage = err.message || "Conflict with current state.";
  } else if (statusCode === 429) {
    clientMessage = err.message || "Too many requests. Please try again later.";
  } else if (process.env.NODE_ENV !== "production" && err.message) {
    clientMessage = err.message;
  }

  // Handle malformed JSON body parser error from Express
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      message: "Malformed JSON payload in request body",
      requestId,
    });
  }

  res.status(statusCode).json({
    message: clientMessage,
    requestId,
  });
}

module.exports = errorHandler;
