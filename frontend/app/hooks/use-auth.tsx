import { authenticateUser, clearAuthCookies, handleAuthError } from '@/lib/auth-utils';
import { AccountService } from '@/services/account.service';
import { AuthService } from '@/services/auth.service';
import { StorageService } from '@/services/storage.service';
import { useEffect, useState, type ReactNode } from 'react';
import { AuthContext } from './auth-context';
import type { FullProfile } from '~/types/profile';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FullProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Проверка аутентификации при старте
  const checkAuth = async () => {
    try {
      const user = await authenticateUser();
      setUser(user);
    } catch (error) {
      handleAuthError(error, false);
      setUser(null);
    } finally {
      setLoading(false);
    }
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

      // Close the current database connection (per-user database remains in IndexedDB)
      await StorageService.cleanup(); // Close and cleanup database (Phase 4)

      // Clear sensitive data from memory
      AccountService.clearTemporarySeed(); // Clears seed and private key hash from memory

      setUser(null);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  // Initialize and cleanup StorageService based on user identity
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component
    const initStorage = async () => {
      if (user?.identity?.id && isMounted) {
        try {
          await StorageService.initialize(user.identity.id);
        } catch (error) {
          console.error('Failed to initialize StorageService on user change:', error);
          // Handle error, e.g., show a toast, redirect to login
        }
      }
    };

    initStorage();

    return () => {
      isMounted = false; // Set flag to false when component unmounts or user changes
      // StorageService.cleanup() is already called in logout, no need to duplicate here
      // Unless we want to explicitly close on component unmount even if not logged out
      // For now, avoid duplicate cleanup if logout already handles it
      // If `user` becomes null (logout), then cleanup is handled by logout itself
    };
  }, [user?.identity?.id]); // Re-run effect when user's identity ID changes

  // Обновление данных пользователя без перезагрузки страницы
  const refreshUser = async () => {
    try {
      const user = await authenticateUser();
      setUser(user);

      if (user) {
        console.log('User profile refreshed successfully', user);
      } else {
        console.log('User session expired, cleared auth');
      }
    } catch (error) {
      handleAuthError(error, false);
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
