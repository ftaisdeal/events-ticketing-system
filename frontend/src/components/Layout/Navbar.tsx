import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';

const Navbar = (): JSX.Element => {
	const navigate = useNavigate();
	const { isAuthenticated, user, logout } = useAuth();

	const handleLogout = () => {
		logout();
		navigate('/');
	};

	return (
		<header className="site-header">
			<div className="site-header__inner">
				<NavLink to="/" className="brand-mark">
					RDX Tickets
				</NavLink>

				<nav className="site-nav" aria-label="Main navigation">
					<NavLink to="/events" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
						Events
					</NavLink>
					{isAuthenticated ? (
						<>
							<NavLink to="/cart" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
								Cart
							</NavLink>
							<NavLink to="/orders" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
								Orders
							</NavLink>
							<NavLink to="/profile" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
								Profile
							</NavLink>
							{user?.role === 'organizer' || user?.role === 'admin' ? (
								<NavLink to="/dashboard" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
									Dashboard
								</NavLink>
							) : null}
						</>
					) : null}
				</nav>

				<div className="site-actions">
					{isAuthenticated ? (
						<>
							<span className="welcome-chip">{user?.firstName}</span>
							<button type="button" className="action-btn action-btn--ghost" onClick={handleLogout}>
								Log Out
							</button>
						</>
					) : (
						<>
							<NavLink to="/login" className="action-btn action-btn--ghost">
								Log In
							</NavLink>
							<NavLink to="/register" className="action-btn action-btn--primary">
								Join
							</NavLink>
						</>
					)}
				</div>
			</div>
		</header>
	);
};

export default Navbar;
