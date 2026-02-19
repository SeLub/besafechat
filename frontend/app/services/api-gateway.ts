/**
 * API Gateway - Centralized endpoint definitions
 * All API routes are defined here for easy maintenance and refactoring
 */

import { API_CONFIG } from './api-config';

export const API_ENDPOINTS = {
  // Auth endpoints
  AUTH: {
    LOGIN_CHALLENGE: `${API_CONFIG.BASE_URL}/auth/login/challenge`,
    LOGIN: `${API_CONFIG.BASE_URL}/auth/login`,
    REGISTER: `${API_CONFIG.BASE_URL}/auth/register`,
    LOGOUT: `${API_CONFIG.BASE_URL}/auth/logout`,
    PROFILE: `${API_CONFIG.BASE_URL}/auth/profile`,
    REFRESH: `${API_CONFIG.BASE_URL}/auth/refresh`,
    SESSIONS: `${API_CONFIG.BASE_URL}/auth/sessions`,
    SESSIONS_REVOKE: (sessionId: string) => `${API_CONFIG.BASE_URL}/auth/sessions/revoke/${sessionId}`,
    SESSIONS_REVOKE_ALL: `${API_CONFIG.BASE_URL}/auth/sessions/revoke-all`,
  },

  // Profile endpoints
  PROFILE: {
    DISPLAY_NAME: `${API_CONFIG.BASE_URL}/profile/display-name`,
    SETTINGS: `${API_CONFIG.BASE_URL}/profile/settings`,
  },

  // Contacts endpoints
  CONTACTS: {
    GET_ALL: `${API_CONFIG.BASE_URL}/contacts`,
    REQUESTS_INCOMING: `${API_CONFIG.BASE_URL}/contacts/requests/incoming`,
    REQUESTS_OUTGOING: `${API_CONFIG.BASE_URL}/contacts/requests/outgoing`,
    REQUESTS_ACCEPT: (requestId: string) => `${API_CONFIG.BASE_URL}/contacts/requests/${requestId}/accept`,
    REQUESTS_REJECT: (requestId: string) => `${API_CONFIG.BASE_URL}/contacts/requests/${requestId}/reject`,
  },

  // Chats endpoints
  CHATS: {
    GET_ALL: `${API_CONFIG.BASE_URL}/chats`,
    GET_ONE: (chatId: string) => `${API_CONFIG.BASE_URL}/chats/${chatId}`,
    FIND_OR_CREATE: `${API_CONFIG.BASE_URL}/chats/find-or-create`,
  },

  // Handles/Privacy endpoints
  HANDLES: {
    GET_ALL: '/handles',
    CREATE: '/handles',
    DELETE: (handleId: string) => `/handles/${handleId}`,
    CHECK_AVAILABILITY: (value: string) => `/handles/alias/check/${encodeURIComponent(value)}`,
    SET_SEARCHABLE: (handleId: string) => `/handles/${handleId}/searchable`,
    SET_ALIAS: (handleId: string) => `/handles/${handleId}/alias`,
    SET_PRIMARY: (handleId: string) => `/handles/primary/${handleId}`,
    CHECK_ALIAS: (alias: string) => `/handles/alias/check/${encodeURIComponent(alias)}`,
  },

  // Profiles endpoints
  PROFILES: {
    UPDATE_BY_HANDLE: (handleId: string) => `/profiles/${handleId}`,
    GET_BY_HANDLE: (handleId: string) => `/profiles/${handleId}`,
  },

  // WebSocket endpoints
  WEBSOCKET: {
    MESSAGES: `${API_CONFIG.BASE_URL}/messages`,
  },
};

/**
 * Helper function to build URL with query parameters
 */
export function buildUrl(endpoint: string, params?: Record<string, any>): string {
  if (!params || Object.keys(params).length === 0) {
    return endpoint;
  }

  const queryString = new URLSearchParams(
    Object.entries(params).reduce(
      (acc, [key, value]) => {
        if (value !== null && value !== undefined) {
          acc[key] = String(value);
        }
        return acc;
      },
      {} as Record<string, string>
    )
  ).toString();

  return `${endpoint}${queryString ? `?${queryString}` : ''}`;
}
