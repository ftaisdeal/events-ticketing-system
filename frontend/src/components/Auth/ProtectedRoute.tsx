import React, { ReactNode } from 'react';

type ProtectedRouteProps = {
	children: ReactNode;
	requiredRole?: string;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps): JSX.Element => <>{children}</>;

export default ProtectedRoute;
