import jwt from "jsonwebtoken";
import { config } from "../config.js";

// Middleware: requires a valid JWT access token
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Middleware: attaches user if token is present, but does not require it
// Used for article routes where free articles are visible to everyone
export function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(token, config.jwt.secret);
      req.user = { id: payload.sub, email: payload.email, name: payload.name };
    } catch {
      // Token invalid — proceed as unauthenticated, do not throw
    }
  }
  next();
}
