const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "jwt",
  "secret",
  "facedescriptor",
  "descriptor",
  "biometrictoken",
  "ballotcommitmenthash",
  "mongouri",
  "mongo_uri",
  "jwt_secret",
]);

function redact(obj, depth = 0) {
  if (depth > 5 || obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    // Redact JWT-like strings
    if (/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(obj)) {
      return "[REDACTED_JWT]";
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    // Truncate large float vectors (like face descriptors)
    if (obj.length > 32 && typeof obj[0] === "number") {
      return `[FLOAT_VECTOR_LENGTH_${obj.length}]`;
    }
    return obj.map((item) => redact(item, depth + 1));
  }
  if (typeof obj === "object") {
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        clean[key] = "[REDACTED]";
      } else {
        clean[key] = redact(value, depth + 1);
      }
    }
    return clean;
  }
  return obj;
}

function formatLog(level, message, meta = {}) {
  const logObject = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta.requestId ? { requestId: meta.requestId } : {}),
    ...(meta.method ? { method: meta.method } : {}),
    ...(meta.path ? { path: meta.path } : {}),
    ...(meta.statusCode ? { statusCode: meta.statusCode } : {}),
    ...(meta.durationMs !== undefined ? { durationMs: meta.durationMs } : {}),
    ...(meta.details ? { details: redact(meta.details) } : {}),
  };

  if (process.env.NODE_ENV === "production") {
    return JSON.stringify(logObject);
  } else {
    const reqStr = meta.requestId ? ` [${meta.requestId.slice(0, 8)}]` : "";
    const metaStr = meta.details ? ` | ${JSON.stringify(redact(meta.details))}` : "";
    return `[${logObject.timestamp}] [${level}]${reqStr} ${message}${metaStr}`;
  }
}

const logger = {
  info: (message, meta) => {
    console.log(formatLog("INFO", message, meta));
  },
  warn: (message, meta) => {
    console.warn(formatLog("WARN", message, meta));
  },
  error: (message, meta) => {
    console.error(formatLog("ERROR", message, meta));
  },
  debug: (message, meta) => {
    if (process.env.NODE_ENV !== "production") {
      console.debug(formatLog("DEBUG", message, meta));
    }
  },
  redact,
};

module.exports = logger;
