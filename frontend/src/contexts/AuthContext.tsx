import React, { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, getAuthHeader } from '../utils/api';

export type AuthUser = {
	id: number;
	firstName: string;
	lastName: string;
	email: string;
	phone?: string | null;
	role: 'customer' | 'organizer' | 'admin';
};

type AuthContextValue = {
	user: AuthUser | null;
	token: string | null;
	isAuthenticated: boolean;
	isLoading: boolean;
	login: (email: string, password: string) => Promise<void>;
	register: (payload: {
		firstName: string;
		lastName: string;
		email: string;
		password: string;
		phone?: string;
	}) => Promise<void>;
	logout: () => void;
	refreshUser: () => Promise<void>;
};

const tokenStorageKey = 'ticketing_token';
const userStorageKey = 'ticketing_user';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

type AuthProviderProps = {
	children: ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps): JSX.Element => {
	const [token, setToken] = useState<string | null>(() => localStorage.getItem(tokenStorageKey));
	const [user, setUser] = useState<AuthUser | null>(() => {
		const rawUser = localStorage.getItem(userStorageKey);
		if (!rawUser) {
			return null;
		}

		try {
			return JSON.parse(rawUser) as AuthUser;
		} catch (_error) {
			return null;
		}
	});
	const [isLoading, setIsLoading] = useState(true);

	const persistSession = useCallback((nextToken: string, nextUser: AuthUser) => {
		setToken(nextToken);
		setUser(nextUser);
		localStorage.setItem(tokenStorageKey, nextToken);
		localStorage.setItem(userStorageKey, JSON.stringify(nextUser));
		// Backward compatibility for older checkout storage key.
		localStorage.setItem('token', nextToken);
	}, []);

	const clearSession = useCallback(() => {
		setToken(null);
		setUser(null);
		localStorage.removeItem(tokenStorageKey);
		localStorage.removeItem(userStorageKey);
		localStorage.removeItem('token');
	}, []);

	const refreshUser = useCallback(async () => {
		const currentToken = localStorage.getItem(tokenStorageKey);
		if (!currentToken) {
			clearSession();
			return;
		}

		const response = await api.get('/auth/verify', {
			headers: getAuthHeader(currentToken)
		});

		persistSession(currentToken, response.data.user as AuthUser);
	}, [clearSession, persistSession]);

	useEffect(() => {
		let isMounted = true;

		const bootstrap = async () => {
			if (!token) {
				if (isMounted) {
					setIsLoading(false);
				}
				return;
			}

			try {
				await refreshUser();
			} catch (_error) {
				clearSession();
			} finally {
				if (isMounted) {
					setIsLoading(false);
				}
			}
		};

		bootstrap();

		return () => {
			isMounted = false;
		};
	}, [token, refreshUser, clearSession]);

	const login = useCallback(async (email: string, password: string) => {
		const response = await api.post('/auth/login', { email, password });
		persistSession(response.data.token as string, response.data.user as AuthUser);
	}, [persistSession]);

	const register = useCallback(async (payload: {
		firstName: string;
		lastName: string;
		email: string;
		password: string;
		phone?: string;
	}) => {
		const response = await api.post('/auth/register', payload);
		persistSession(response.data.token as string, response.data.user as AuthUser);
	}, [persistSession]);

	const value = useMemo<AuthContextValue>(
		() => ({
			user,
			token,
			isAuthenticated: Boolean(token && user),
			isLoading,
			login,
			register,
			logout: clearSession,
			refreshUser
		}),
		[clearSession, isLoading, login, refreshUser, register, token, user]
	);

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used within AuthProvider');
	}

	return context;
};
