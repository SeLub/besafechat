import { authenticateUser, clearAuthCookies, handleAuthError } from '@/lib/auth-utils';
import { AccountService } from '@/services/account.service';
import { AuthService } from '@/services/auth.service';
import { StorageService } from '@/services/storage.service';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { FullProfile } from '~/types/profile';

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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
