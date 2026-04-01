import axios from 'axios';
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';

const Register = (): JSX.Element => {
	const navigate = useNavigate();
	const { register } = useAuth();

	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [email, setEmail] = useState('');
	const [phone, setPhone] = useState('');
	const [password, setPassword] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState('');

	const onSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setError('');
		setIsSubmitting(true);

		try {
			await register({ firstName, lastName, email, password, phone: phone || undefined });
			navigate('/events', { replace: true });
		} catch (submitError) {
			if (axios.isAxiosError(submitError)) {
				const responseData = submitError.response?.data as
					| {
							message?: string;
							errors?: Array<{ msg?: string; message?: string }>;
					  }
					| undefined;

				const validationMessage = responseData?.errors?.[0]?.msg || responseData?.errors?.[0]?.message;
				const message = responseData?.message || validationMessage || 'Registration failed';
				setError(message);
			} else {
				setError('Registration failed');
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<section className="auth-shell">
			<form className="auth-card" onSubmit={onSubmit}>
				<h1>Create Account</h1>
				<p>Join and start booking events in minutes.</p>

				<div className="grid-two">
					<label htmlFor="register-first-name">
						First Name
						<input
							id="register-first-name"
							type="text"
							value={firstName}
							onChange={(event) => setFirstName(event.target.value)}
							required
						/>
					</label>

					<label htmlFor="register-last-name">
						Last Name
						<input
							id="register-last-name"
							type="text"
							value={lastName}
							onChange={(event) => setLastName(event.target.value)}
							required
						/>
					</label>
				</div>

				<label htmlFor="register-email">
					Email
					<input
						id="register-email"
						type="email"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						required
					/>
				</label>

				<label htmlFor="register-phone">
					Phone (optional)
					<input
						id="register-phone"
						type="text"
						value={phone}
						onChange={(event) => setPhone(event.target.value)}
					/>
				</label>

				<label htmlFor="register-password">
					Password
					<input
						id="register-password"
						type="password"
						value={password}
						onChange={(event) => setPassword(event.target.value)}
						minLength={6}
						required
					/>
				</label>

				{error ? <p className="error-text">{error}</p> : null}

				<button className="action-btn action-btn--primary" type="submit" disabled={isSubmitting}>
					{isSubmitting ? 'Creating Account...' : 'Create Account'}
				</button>

				<p>
					Already have an account? <Link to="/login">Sign in</Link>
				</p>
			</form>
		</section>
	);
};

export default Register;
