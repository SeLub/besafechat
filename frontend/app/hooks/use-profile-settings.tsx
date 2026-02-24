import { useAuth } from './use-auth-context';
import { useCallback } from 'react';
import { API_ENDPOINTS } from '@/services/api-gateway';
import { handleApiResponse } from '@/services/api-utils';

export type Theme = 'besafe' | 'leteem' | 'minimal';
export type Language = 'en' | 'ru' | 'de' | 'fr';
export type RetentionPeriod = '7' | '30' | '90' | 'forever';
export type Mode = 'light' | 'dark';

export interface ProfileSettings {
  ui: {
    theme: Theme;
    language: Language;
    mode: Mode;
  };
  storage: {
    messageRetentionDays: RetentionPeriod;
  };
  notifications: boolean;
  sound: boolean;
}

const DEFAULT_SETTINGS: ProfileSettings = {
  ui: {
    theme: 'besafe',
    language: 'en',
    mode: 'dark',
  },
  storage: {
    messageRetentionDays: 'forever',
  },
  notifications: true,
  sound: true,
};

/**
 * Hook for reading and updating user profile settings
 * Settings are persisted to the server via PUT /profiles/settings
 * and synced across all devices via the AuthProvider
 */
export function useProfileSettings() {
  const { user, refreshUser } = useAuth();

  // Get current settings from user state, with fallback to defaults
  const settings: ProfileSettings = (() => {
    if (!user?.profile?.settings) {
      return DEFAULT_SETTINGS;
    }

    const userSettings = user.profile.settings as Record<string, any>;

    return {
      ui: {
        theme: (userSettings.ui?.theme as Theme) || DEFAULT_SETTINGS.ui.theme,
        language: (userSettings.ui?.language as Language) || DEFAULT_SETTINGS.ui.language,
        mode: (userSettings.ui?.mode as Mode) || DEFAULT_SETTINGS.ui.mode,
      },
      storage: {
        messageRetentionDays:
          (userSettings.storage?.messageRetentionDays as RetentionPeriod) ||
          DEFAULT_SETTINGS.storage.messageRetentionDays,
      },
      notifications:
        userSettings.notifications !== undefined ? userSettings.notifications : DEFAULT_SETTINGS.notifications,
      sound: userSettings.sound !== undefined ? userSettings.sound : DEFAULT_SETTINGS.sound,
    };
  })();

  /**
   * Update settings on server and refresh user state
   * Performs partial update - only changed fields need to be sent
   *
   * @param updates Partial settings to update
   * @throws Error if API request fails
   */
  const updateSettings = useCallback(
    async (updates: Partial<ProfileSettings>) => {
      try {
        const response = await fetch(API_ENDPOINTS.PROFILE.SETTINGS, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(updates),
        });

        // Use unified handleApiResponse to parse response
        const data = await handleApiResponse<{ settings: Record<string, any> }>(response);

        // Refresh user state to reflect changes from server
        await refreshUser();

        return true;
      } catch (error) {
        console.error('Error updating settings:', error);
        throw error;
      }
    },
    [refreshUser]
  );

  return { settings, updateSettings };
}
