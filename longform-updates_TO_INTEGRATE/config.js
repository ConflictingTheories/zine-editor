// All environment configuration in one place.
// The app refuses to start if required variables are missing.

const required = [
  "DATABASE_URL",
  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error("Missing required environment variables:", missing.join(", "));
  process.exit(1);
}

export const config = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",

  database: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  },

  jwt: {
    secret:         process.env.JWT_SECRET,
    refreshSecret:  process.env.JWT_REFRESH_SECRET,
    accessExpiry:   "15m",
    refreshExpiry:  "30d",
  },

  stripe: {
    secretKey:     process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  cors: {
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
  },

  // Funding credit thresholds (fraction of article goal)
  credits: {
    executiveProducerMinFraction: 0.20,
  },
};
