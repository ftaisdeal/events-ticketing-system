import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { api, getAuthHeader } from '../../utils/api';

type VenueRow = {
	id: number;
	name: string;
	address: string;
	city: string;
	state?: string | null;
	country: string;
	postalCode?: string | null;
};

const AdminVenues = (): JSX.Element => {
	const { token } = useAuth();
	const [venues, setVenues] = useState<VenueRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		let active = true;

		const loadVenues = async () => {
			if (!token) {
				if (active) {
					setVenues([]);
					setIsLoading(false);
				}
				return;
			}

			setIsLoading(true);
			setError('');

			try {
				const response = await api.get('/venues', {
					headers: getAuthHeader(token)
				});

				if (!active) {
					return;
				}

				setVenues((response.data.venues || []) as VenueRow[]);
			} catch (loadError) {
				if (!active) {
					return;
				}

				if (axios.isAxiosError(loadError)) {
					const message =
						(loadError.response?.data as { message?: string } | undefined)?.message || 'Unable to load venues';
					setError(message);
				} else {
					setError('Unable to load venues');
				}
			} finally {
				if (active) {
					setIsLoading(false);
				}
			}
		};

		loadVenues();

		return () => {
			active = false;
		};
	}, [token]);

	const formatLocation = (venue: VenueRow): string => {
		const cityState = [venue.city, venue.state].filter(Boolean).join(', ');
		const parts = [cityState, venue.postalCode || '', venue.country].filter(Boolean);
		return parts.join(' ');
	};

	return (
		<section>
			<h1 className="page-title">Venues</h1>
			<div className="panel-card">
				<p>
					<Link to="/admin/venues/new" className="action-btn action-btn--primary">
						add venue
					</Link>
				</p>

				{isLoading ? <p>Loading venues...</p> : null}
				{error ? <p className="error-text">{error}</p> : null}
				{!isLoading && !error && venues.length === 0 ? <p>No venues yet.</p> : null}

				{venues.map((venue) => (
					<div className="line-item-row" key={venue.id}>
						<div>
							<strong>{venue.name}</strong>
							<p className="event-card__meta" style={{ margin: 0 }}>
								{venue.address}
							</p>
							<p className="event-card__meta" style={{ margin: 0 }}>
								{formatLocation(venue)}
							</p>
						</div>
					</div>
				))}
			</div>
		</section>
	);
};

export default AdminVenues;
