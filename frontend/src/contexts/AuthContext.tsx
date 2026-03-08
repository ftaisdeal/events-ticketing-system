import React, { ReactNode, createContext } from 'react';

type AuthContextValue = Record<string, never>;

export const AuthContext = createContext<AuthContextValue>({});

type AuthProviderProps = {
	children: ReactNode;
};

export const AuthProvider = ({ children }: AuthProviderProps): JSX.Element => (
	<AuthContext.Provider value={{}}>{children}</AuthContext.Provider>
);
