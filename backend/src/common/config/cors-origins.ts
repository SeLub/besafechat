/**
 * CORS Origins Configuration - Single Source of Truth
 * All CORS-related configuration should be defined here
 */

export function getCorsOrigins(): string[] {
  const corsOriginsEnv = process.env.CORS_ORIGINS;

  if (corsOriginsEnv) {
    // If CORS_ORIGINS is set, use it (comma-separated)
    return corsOriginsEnv
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  // Default origins for development
  return ['https://localhost:5173', 'https://192.168.100.35:5173'];
}

export function getCorsConfig() {
  return {
    origin: getCorsOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    optionsSuccessStatus: 200,
  };
}
