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
  return ['http://localhost:3000', 'http://localhost:5173'];
}

export function getCorsConfig() {
  return {
    origin: getCorsOrigins(),
    credentials: true,
  };
}
