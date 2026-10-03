import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService } from '../services/authService';
import { SESSION_EXPIRED_EVENT, toAppError } from '../services/apiClient';
import type { AdminUser, AppError } from '../types';

type AuthStatus = 'checking' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  admin: AdminUser | null;
  status: AuthStatus;
  sessionNotice: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearSessionNotice: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  // The JWT lives in an httpOnly cookie, so the only way to know the session state
  // on a hard refresh is to ask the API.
  useEffect(() => {
    let cancelled = false;
    authService
      .me()
      .then((response) => {
        if (cancelled) return;
        setAdmin(response.admin);
        setStatus('authenticated');
      })
      .catch(() => {
        if (cancelled) return;
        setAdmin(null);
        setStatus('anonymous');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Any 401 from the API drops us back to the login screen with an explanation.
  useEffect(() => {
    const onExpired = (event: Event) => {
      setAdmin(null);
      setStatus('anonymous');
      setSessionNotice((event as CustomEvent<string>).detail ?? 'Your admin session has expired. Please log in again.');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password);
      setAdmin(response.admin);
      setStatus('authenticated');
      setSessionNotice(null);
    } catch (error) {
      throw toAppError(error) as AppError;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setAdmin(null);
      setStatus('anonymous');
    }
  }, []);

  const clearSessionNotice = useCallback(() => setSessionNotice(null), []);

  const value = useMemo(
    () => ({ admin, status, sessionNotice, login, logout, clearSessionNotice }),
    [admin, status, sessionNotice, login, logout, clearSessionNotice]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
};