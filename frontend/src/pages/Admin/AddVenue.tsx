import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { api, getAuthHeader } from '../../utils/api';

const AdminAddVenue = (): JSX.Element => {
	const navigate = useNavigate();
	const { token } = useAuth();
	const [name, setName] = useState('');
	const [address, setAddress] = useState('');
	const [city, setCity] = useState('');
	const [state, setState] = useState('');
	const [country, setCountry] = useState('');
	const [postalCode, setPostalCode] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState('');

	const onSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!token) {
			setError('You are not authenticated');
			return;
		}

		setIsSubmitting(true);
		setError('');

		try {
			await api.post('/venues', {
				name,
				address,
				city,
				state: state || null,
				country,
				postalCode: postalCode || null
			}, {
				headers: getAuthHeader(token)
			});
			navigate('/admin/venues', { replace: true });
		} catch (submitError) {
			if (axios.isAxiosError(submitError)) {
				const payload = submitError.response?.data as { message?: string; errors?: Array<{ msg?: string }> } | undefined;
				setError(payload?.errors?.[0]?.msg || payload?.message || 'Failed to create venue');
			} else {
				setError('Failed to create venue');
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<section>
			<h1 className="page-title">Add Venue</h1>
			<div className="panel-card">
				<form className="auth-card" onSubmit={onSubmit}>
					<label htmlFor="venue-name">
						Venue Name
						<input
							id="venue-name"
							type="text"
							value={name}
							onChange={(eventInput) => setName(eventInput.target.value)}
							required
						/>
					</label>

					<label htmlFor="venue-address">
						Street Address
						<input
							id="venue-address"
							type="text"
							value={address}
							onChange={(eventInput) => setAddress(eventInput.target.value)}
							required
						/>
					</label>

					<div className="grid-two">
						<label htmlFor="venue-city">
							City
							<input
								id="venue-city"
								type="text"
								value={city}
								onChange={(eventInput) => setCity(eventInput.target.value)}
								required
							/>
						</label>

						<label htmlFor="venue-state">
							State (optional)
							<input
								id="venue-state"
								type="text"
								value={state}
								onChange={(eventInput) => setState(eventInput.target.value)}
							/>
						</label>
					</div>

					<div className="grid-two">
						<label htmlFor="venue-country">
							Country
							<input
								id="venue-country"
								type="text"
								value={country}
								onChange={(eventInput) => setCountry(eventInput.target.value)}
								required
							/>
						</label>

						<label htmlFor="venue-postal-code">
							ZIP / Postal Code (optional)
							<input
								id="venue-postal-code"
								type="text"
								value={postalCode}
								onChange={(eventInput) => setPostalCode(eventInput.target.value)}
							/>
						</label>
					</div>

					{error ? <p className="error-text">{error}</p> : null}

					<button className="action-btn action-btn--primary" type="submit" disabled={isSubmitting}>
						{isSubmitting ? 'Saving...' : 'Save Venue'}
					</button>
				</form>
			</div>
		</section>
	);
};

export default AdminAddVenue;
