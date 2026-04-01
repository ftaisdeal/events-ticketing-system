import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../utils/api';

type HomeEventRow = {
	id: number;
	title: string;
	slug: string;
	shortDescription?: string;
	description?: string;
	startDateTime: string;
	status: string;
	venue?: {
		city?: string;
	};
};

const Home = (): JSX.Element => {
	const [events, setEvents] = useState<HomeEventRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		let active = true;

		const fetchUpcomingEvents = async () => {
			try {
				const nowIso = new Date().toISOString();
				const response = await api.get(`/events?limit=100&startDate=${encodeURIComponent(nowIso)}`);
				if (!active) {
					return;
				}

				setEvents((response.data.events || []) as HomeEventRow[]);
			} catch (_error) {
				if (active) {
					setError('Unable to load upcoming events.');
				}
			} finally {
				if (active) {
					setIsLoading(false);
				}
			}
		};

		fetchUpcomingEvents();

		return () => {
			active = false;
		};
	}, []);

	return (
		<section>
			<h1>Events</h1>
			{isLoading ? <p>Loading events...</p> : null}
			{error ? <p className="error-text">{error}</p> : null}
			{!isLoading && !error && events.length === 0 ? <p>No upcoming events are currently published.</p> : null}

			<div className="event-grid events-list">
				{events.map((event) => (
					<article className="event-card" key={event.id}>
						<p className="event-card__meta">
							{new Date(event.startDateTime).toLocaleString()} • {event.venue?.city || 'TBA'}
						</p>
						<h2>{event.title}</h2>
						<p>{event.shortDescription || event.description || 'No short description provided yet.'}</p>
						<div className="event-card__actions">
							<Link to={`/events/${event.slug}`} className="action-btn action-btn--primary">
								View Details
							</Link>
						</div>
					</article>
				))}
			</div>
			<img src="/img/stripe.png" alt="Stripe secure payment logo"/>
			<div className="event-card__meta" style={{ display: 'flex', alignItems: 'center' }}>
				Secure checkout powered by Stripe.
			</div>
		</section>
	);
};

export default Home;
