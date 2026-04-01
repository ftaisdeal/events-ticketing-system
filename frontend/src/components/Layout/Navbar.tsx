import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { CART_UPDATED_EVENT, hasStoredCartItems } from '../../utils/cartStorage';

const Navbar = (): JSX.Element => {
	const navigate = useNavigate();
	const { isAuthenticated, user, logout } = useAuth();
	const [cartHasItems, setCartHasItems] = useState<boolean>(() => hasStoredCartItems());

	useEffect(() => {
		const refreshCartState = () => {
			setCartHasItems(hasStoredCartItems());
		};

		window.addEventListener('storage', refreshCartState);
		window.addEventListener(CART_UPDATED_EVENT, refreshCartState as EventListener);

		return () => {
			window.removeEventListener('storage', refreshCartState);
			window.removeEventListener(CART_UPDATED_EVENT, refreshCartState as EventListener);
		};
	}, []);

	const handleLogout = () => {
		logout();
		navigate('/');
	};

	return (
		<header className="site-header">
			<div className="site-header__inner">
				<NavLink to="/" className="brand-mark">
					<h1 className="page-title"><span style={{color: 'red' }}>RDX</span> <span style={{color: 'gray' }}>THEATER</span></h1>
				</NavLink>

				<nav className="site-nav" aria-label="Main navigation">
					{isAuthenticated && user?.role === 'admin' ? (
						<>
							<NavLink to="/dashboard" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
								Dashboard
							</NavLink>
							<NavLink to="/admin/orders" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
								Orders
							</NavLink>
							<NavLink to="/admin/finances" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
								Finances
							</NavLink>
							<NavLink to="/admin/venues" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
								Venues
							</NavLink>
						</>
					) : (
						<>
							{isAuthenticated ? (
								<>
									<NavLink
										to="/cart"
										className={({ isActive }) =>
											`nav-link${isActive ? ' nav-link--active' : ''}${!isActive && cartHasItems ? ' nav-link--cart-filled' : ''}`
										}
									>
										Cart
									</NavLink>
									<NavLink to="/orders" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
										Orders
									</NavLink>
									<NavLink to="/profile" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
										Profile
									</NavLink>
									{user?.role === 'organizer' ? (
										<NavLink to="/dashboard" className={({ isActive }) => `nav-link${isActive ? ' nav-link--active' : ''}`}>
											Dashboard
										</NavLink>
									) : null}
								</>
							) : null}
						</>
					)}
				</nav>

				<div className="site-actions">
					{isAuthenticated ? (
						<>
							<span className="welcome-chip">{user?.role === 'admin' ? 'admin' : user?.firstName}</span>
							<button type="button" className="action-btn action-btn--ghost" onClick={handleLogout}>
								Log Out
							</button>
						</>
					) : (
						<>
							<NavLink to="/cart" className={`action-btn ${cartHasItems ? 'action-btn--primary' : 'action-btn--ghost'}`}>
								Cart
							</NavLink>
							<NavLink to="/login" className="action-btn action-btn--ghost">
								Log In
							</NavLink>
						</>
					)}
				</div>
			</div>
		</header>
	);
};

export default Navbar;
