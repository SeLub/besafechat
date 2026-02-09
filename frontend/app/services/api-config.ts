/**
 * API Configuration with automatic hostname detection
 * If accessing from same machine (localhost), use localhost
 * If accessing from network (e.g., 192.168.x.x), use that IP
 */

function getApiBaseUrl(): string {
  // Get from environment variables first (for explicit overrides)
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const envPort = import.meta.env.VITE_API_PORT || '4000';

  if (envBaseUrl) {
    return `${envBaseUrl}:${envPort}`;
  }

  // Auto-detect: use current window location hostname
  // If you're at 192.168.100.35:5173, connect to 192.168.100.35:4000
  // If you're at localhost:5173, connect to localhost:4000
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    return `http://${hostname}:${envPort}`;
  }

  // Fallback for SSR or build time
  return `http://localhost:${envPort}`;
}

export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
};

export function getApiUrl(path: string): string {
  return `${API_CONFIG.BASE_URL}${path}`;
}
