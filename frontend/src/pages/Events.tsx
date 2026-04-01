import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api } from '../utils/api';

type EventRow = {
	id: number;
	title: string;
	slug: string;
	shortDescription?: string;
	startDateTime: string;
	status: string;
	venue?: {
		name?: string;
		city?: string;
		country?: string;
	};
	ticketTypes?: Array<{ id: number; name: string; price: number }>;
};

const Events = (): JSX.Element => {
	const [events, setEvents] = useState<EventRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		let active = true;

		const fetchEvents = async () => {
			try {
				const response = await api.get('/events?limit=24');
				if (!active) {
					return;
				}
				setEvents((response.data.events || []) as EventRow[]);
			} catch (_error) {
				if (active) {
					setError('Unable to load events.');
				}
			} finally {
				if (active) {
					setIsLoading(false);
				}
			}
		};

		fetchEvents();

		return () => {
			active = false;
		};
	}, []);

	return (
		<section>
			<h1 className="page-title">Events</h1>
			{isLoading ? <p>Loading events...</p> : null}
			{error ? <p className="error-text">{error}</p> : null}

			<div className="event-grid events-list">
				{events.map((event) => (
					<article className="event-card" key={event.id}>
						<p className="event-card__meta">
							{new Date(event.startDateTime).toLocaleString()} • {event.venue?.city || 'TBA'}
						</p>
						<h2>{event.title}</h2>
						<p>{event.shortDescription || 'No short description provided yet.'}</p>
						<p className="event-card__meta">Status: {event.status}</p>
						<div className="event-card__actions">
							<Link to={`/events/${event.slug}`} className="action-btn action-btn--primary">
								View Details
							</Link>
						</div>
					</article>
				))}
			</div>
		</section>
	);
};

export default Events;
