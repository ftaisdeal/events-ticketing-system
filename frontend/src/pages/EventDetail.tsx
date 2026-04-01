import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { api } from '../utils/api';

const cartStorageKey = 'ticketing_cart';

type TicketType = {
	id: number;
	name: string;
	price: number;
	quantity: number;
	quantitySold: number;
};

type EventDetailResponse = {
	id: number;
	title: string;
	description: string;
	shortDescription?: string;
	startDateTime: string;
	endDateTime: string;
	ticketTypes?: TicketType[];
};

type CartItem = {
	ticketTypeId: number;
	quantity: number;
};

const formatEventRange = (startDateTime: string, endDateTime: string): string => {
	const start = new Date(startDateTime);
	const end = new Date(endDateTime);

	const date = start.toLocaleDateString(undefined, {
		month: 'numeric',
		day: 'numeric',
		year: 'numeric'
	});

	const startTimeWithMeridiem = start.toLocaleTimeString(undefined, {
		hour: 'numeric',
		minute: '2-digit'
	});

	const endTimeWithMeridiem = end.toLocaleTimeString(undefined, {
		hour: 'numeric',
		minute: '2-digit'
	});

	const startTime = startTimeWithMeridiem.replace(/\s?[AP]M$/i, '');
	const endTime = endTimeWithMeridiem.replace(/\s?([AP]M)$/i, '$1').toUpperCase();

	return `${date}, ${startTime}-${endTime}`;
};

const EventDetail = (): JSX.Element => {
	const { slug } = useParams<{ slug: string }>();
	const [eventData, setEventData] = useState<EventDetailResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		let active = true;

		const fetchEvent = async () => {
			if (!slug) {
				setError('Missing event slug.');
				setIsLoading(false);
				return;
			}

			try {
				const response = await api.get(`/events/${slug}`);
				if (active) {
					setEventData(response.data as EventDetailResponse);
				}
			} catch (_error) {
				if (active) {
					setError('Unable to load event details.');
				}
			} finally {
				if (active) {
					setIsLoading(false);
				}
			}
		};

		fetchEvent();

		return () => {
			active = false;
		};
	}, [slug]);

	const addToCart = (ticketTypeId: number) => {
		if (!eventData) {
			return;
		}

		const raw = localStorage.getItem(cartStorageKey);
		const current = raw ? (JSON.parse(raw) as { eventId: number; items: CartItem[] }) : { eventId: eventData.id, items: [] };
		const matchingEvent = current.eventId === eventData.id;
		const items = matchingEvent ? current.items : [];

		const existingIndex = items.findIndex((item) => item.ticketTypeId === ticketTypeId);
		let nextItems: CartItem[];

		if (existingIndex >= 0) {
			nextItems = items.map((item, index) =>
				index === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
			);
		} else {
			nextItems = [...items, { ticketTypeId, quantity: 1 }];
		}

		localStorage.setItem(cartStorageKey, JSON.stringify({ eventId: eventData.id, items: nextItems }));
		toast.success('Added to cart');
	};

	if (isLoading) {
		return <p>Loading event...</p>;
	}

	if (error || !eventData) {
		return <p className="error-text">{error || 'Event not found.'}</p>;
	}

	return (
		<section>
			<h1 className="page-title">{eventData.title}</h1>
			<p className="event-card__meta">{formatEventRange(eventData.startDateTime, eventData.endDateTime)}</p>
			<p>{eventData.description}</p>

			<div className="event-grid">
				{(eventData.ticketTypes || []).map((ticketType) => {
					const available = Number(ticketType.quantity) - Number(ticketType.quantitySold || 0);

					return (
						<article className="event-card" key={ticketType.id}>
							<h3>{ticketType.name}</h3>
							<p>${Number(ticketType.price).toFixed(2)}</p>
							<p className="event-card__meta">Available: {available}</p>
							<button
								type="button"
								className="action-btn action-btn--primary"
								onClick={() => addToCart(ticketType.id)}
								disabled={available < 1}
							>
								{available < 1 ? 'Sold Out' : 'Add to Cart'}
							</button>
						</article>
					);
				})}
			</div>
		</section>
	);
};

export default EventDetail;
