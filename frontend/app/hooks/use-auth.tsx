import { AccountService } from '@/services/account.service';
import { AuthService } from '@/services/auth.service';
import { StorageService } from '@/services/storage.service';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { FullProfile } from '~/types/profile';
import type { ApiResponse } from '../types/api';

interface AuthContextType {
  user: FullProfile | null;
  loading: boolean;
  register: (deviceId: string) => Promise<void>;
  login: (publicKey: string, deviceId: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Проверка аутентификации при старте
  const checkAuth = async () => {
    try {
      const res = await fetch('http://localhost:4000/auth/profile', {
        credentials: 'include',
      });

      if (res.ok) {
        const response: ApiResponse<FullProfile> = await res.json();
        if (response.success && response.data) {
          setUser(response.data);
        } else {
          setUser(null);
        }
      } else if (res.status === 401) {
        // Try to refresh the tokens first
        try {
          const refreshResponse = await fetch('http://localhost:4000/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });

          if (refreshResponse.ok) {
            // Retry fetching profile after refresh
            const retryRes = await fetch('http://localhost:4000/auth/profile', {
              credentials: 'include',
            });

            if (retryRes.ok) {
              const retryResponse: ApiResponse<FullProfile> = await retryRes.json();
              if (retryResponse.success && retryResponse.data) {
                setUser(retryResponse.data);
                return;
              }
            }
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
        }

        // If refresh failed, clear auth
        clearAuthCookies();
        setUser(null);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const clearAuthCookies = () => {
    document.cookie = 'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  };

  // Регистрация — генерация ключей и сохранение публичного ключа в IndexedDB
  const register = async (deviceId: string) => {
    // Генерация Ed25519-пары
    const keyPair = await window.crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
      'sign',
      'verify',
    ]);
    const publicKey = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);

    const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(publicKey)));

    // Сохраняем публичный ключ в IndexedDB
    await StorageService.storePublicKey(publicKeyBase64);

    // Отправка публичного ключа на сервер
    await AuthService.login({ publicKey: publicKeyBase64, deviceId });

    await checkAuth(); // Получаем профиль после входа
  };

  // Вход — используем сохранённый публичный ключ
  const login = async (publicKeyBase64: string, deviceId: string) => {
    await AuthService.login({ publicKey: publicKeyBase64, deviceId });

    await checkAuth();
  };

  // Выход
  const logout = async () => {
    try {
      // Отключаем WebSocket (если используется)
      if (window.socketInstance) {
        window.socketInstance.disconnect();
        window.socketInstance = null;
      }

      await AuthService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear all authentication data
      clearAuthCookies();
      await StorageService.clearStoredKey(); // Clear stored public key
      AccountService.clearTemporarySeed(); // Clear any temporary seed storage
      setUser(null);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Обновление данных пользователя без перезагрузки страницы
  const refreshUser = async () => {
    try {
      const res = await fetch('http://localhost:4000/auth/profile', {
        credentials: 'include',
      });

      if (res.ok) {
        const response: ApiResponse<FullProfile> = await res.json();
        if (response.success && response.data) {
          setUser(response.data);
          console.log('User profile refreshed successfully', response.data);
        } else {
          console.error('Failed to refresh user profile: invalid response data');
        }
      } else if (res.status === 401) {
        // Try to refresh the tokens first
        try {
          const refreshResponse = await fetch('http://localhost:4000/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });

          if (refreshResponse.ok) {
            // Retry fetching profile after refresh
            const retryRes = await fetch('http://localhost:4000/auth/profile', {
              credentials: 'include',
            });

            if (retryRes.ok) {
              const retryResponse: ApiResponse<FullProfile> = await retryRes.json();
              if (retryResponse.success && retryResponse.data) {
                setUser(retryResponse.data);
                console.log('User profile refreshed after token refresh', retryResponse.data);
                return;
              }
            }
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
        }

        // If refresh failed, clear auth
        clearAuthCookies();
        setUser(null);
        console.log('User session expired, cleared auth');
      } else {
        console.error('Failed to refresh user profile:', res.status);
      }
    } catch (error) {
      console.error('User refresh error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, register, login, logout, checkAuth, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
