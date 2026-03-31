import axios from 'axios';
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';

const Login = (): JSX.Element => {
	const navigate = useNavigate();
	const location = useLocation();
	const { login } = useAuth();

	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState('');

	const onSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError('');
		setIsSubmitting(true);

		try {
			await login(email, password);
			const destination = (location.state as { from?: string } | null)?.from || '/events';
			navigate(destination, { replace: true });
		} catch (submitError) {
			if (axios.isAxiosError(submitError)) {
				const message =
					(submitError.response?.data as { message?: string } | undefined)?.message || 'Login failed';
				setError(message);
			} else {
				setError('Login failed');
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<section className="auth-shell">
			<form className="auth-card" onSubmit={onSubmit}>
				<h1>Sign In</h1>
				<p>Access your tickets, orders, and profile.</p>

				<label htmlFor="login-email">
					Email
					<input
						id="login-email"
						type="email"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						required
					/>
				</label>

				<label htmlFor="login-password">
					Password
					<input
						id="login-password"
						type="password"
						value={password}
						onChange={(event) => setPassword(event.target.value)}
						required
					/>
				</label>

				{error ? <p className="error-text">{error}</p> : null}

				<button className="action-btn action-btn--primary" type="submit" disabled={isSubmitting}>
					{isSubmitting ? 'Signing In...' : 'Sign In'}
				</button>

				<p>
					New here? <Link to="/register">Create an account</Link>
				</p>
			</form>
		</section>
	);
};

export default Login;
