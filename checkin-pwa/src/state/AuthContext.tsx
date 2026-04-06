import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';

import { api, getAuthHeader } from '../lib/api';
import { AuthUser } from '../types';

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const tokenStorageKey = 'ticketing_checkin_token';
const userStorageKey = 'ticketing_checkin_user';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: PropsWithChildren): JSX.Element => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(tokenStorageKey));
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem(userStorageKey);
    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored) as AuthUser;
    } catch (_error) {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.get('/auth/verify', {
          headers: getAuthHeader(token)
        });

        const nextUser = response.data.user as AuthUser;
        if (nextUser.role !== 'admin' && nextUser.role !== 'organizer') {
          throw new Error('Staff role required');
        }

        setUser(nextUser);
        localStorage.setItem(userStorageKey, JSON.stringify(nextUser));
      } catch (_error) {
        localStorage.removeItem(tokenStorageKey);
        localStorage.removeItem(userStorageKey);
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void bootstrap();
  }, [token]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    token,
    isLoading,
    isAuthenticated: Boolean(token && user),
    login: async (email: string, password: string) => {
      const response = await api.post('/auth/login', { email, password });
      const nextUser = response.data.user as AuthUser;

      if (nextUser.role !== 'admin' && nextUser.role !== 'organizer') {
        throw new Error('This account does not have check-in access.');
      }

      const nextToken = response.data.token as string;
      setToken(nextToken);
      setUser(nextUser);
      localStorage.setItem(tokenStorageKey, nextToken);
      localStorage.setItem(userStorageKey, JSON.stringify(nextUser));
    },
    logout: () => {
      setToken(null);
      setUser(null);
      localStorage.removeItem(tokenStorageKey);
      localStorage.removeItem(userStorageKey);
    }
  }), [isLoading, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};