import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';

type ProtectedRouteProps = {
	children: ReactNode;
	requiredRole?: string;
	requiredEmail?: string;
};

const ProtectedRoute = ({ children, requiredRole, requiredEmail }: ProtectedRouteProps): JSX.Element => {
	const location = useLocation();
	const { isAuthenticated, isLoading, user } = useAuth();

	if (isLoading) {
		return <div>Checking your session...</div>;
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" state={{ from: location.pathname }} replace />;
	}

	if (requiredRole && user?.role !== requiredRole && user?.role !== 'admin') {
		return <Navigate to="/" replace />;
	}

	if (requiredEmail && user?.email.toLowerCase() !== requiredEmail.toLowerCase()) {
		return <Navigate to="/" replace />;
	}

	return <>{children}</>;
};

export default ProtectedRoute;
