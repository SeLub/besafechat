import { AuthService } from '@/services/auth.service';
import { StorageService } from '@/services/storage.service';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface User {
  id: string;
  publicKey: string;
  displayName?: string;
  username?: string;
  // Приватный ключ НЕ хранится в этом объекте — он остаётся в зашифрованной Dexie-БД
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  register: (deviceId: string) => Promise<void>;
  login: (publicKey: string, deviceId: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Проверка аутентификации при старте
  const checkAuth = async () => {
    try {
      const res = await fetch('http://localhost:4000/auth/profile', {
        credentials: 'include',
      });

      if (res.ok) {
        const profile = await res.json();
        setUser(profile.data);
      } else if (res.status === 401) {
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
      clearAuthCookies();
      setUser(null);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout, checkAuth }}>
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
