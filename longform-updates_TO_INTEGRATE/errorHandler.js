export function errorHandler(err, req, res, next) {
  // Operational errors we throw intentionally
  if (err.isOperational) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Database constraint violations
  if (err.code === "23505") {
    return res.status(409).json({ error: "A record with that value already exists" });
  }

  // Unknown errors — don't leak details in production
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: process.env.NODE_ENV === "production"
      ? "An unexpected error occurred"
      : err.message,
  });
}

// Factory for consistent operational errors
export function createError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.isOperational = true;
  return err;
}
