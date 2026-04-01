import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { api } from '../utils/api';
import { readStoredCart, StoredCartItem, writeStoredCart } from '../utils/cartStorage';

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
	venue?: {
		name?: string;
		address?: string;
		city?: string;
		state?: string;
		postalCode?: string;
		country?: string;
	} | null;
	ticketTypes?: TicketType[];
};

const formatEventRange = (startDateTime: string, endDateTime: string): string => {
	const start = new Date(startDateTime);
	const end = new Date(endDateTime);

	const date = start.toLocaleDateString(undefined, {
		weekday: 'long',
		month: 'long',
		day: 'numeric'
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
	const navigate = useNavigate();
	const [eventData, setEventData] = useState<EventDetailResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');
	const [quantitiesByTicketType, setQuantitiesByTicketType] = useState<Record<number, number>>({});

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

	const addToCart = (ticketTypeId: number, quantityToAdd: number) => {
		if (!eventData) {
			return;
		}

		if (quantityToAdd < 1) {
			return;
		}

		const current = readStoredCart();
		const matchingEvent = current.eventId === eventData.id;
		const items = matchingEvent ? current.items : [];

		const existingIndex = items.findIndex((item) => item.ticketTypeId === ticketTypeId);
		let nextItems: StoredCartItem[];

		if (existingIndex >= 0) {
			nextItems = items.map((item, index) =>
				index === existingIndex ? { ...item, quantity: item.quantity + quantityToAdd } : item
			);
		} else {
			nextItems = [...items, { ticketTypeId, quantity: quantityToAdd }];
		}

		writeStoredCart(eventData.id, nextItems);
		setQuantitiesByTicketType((current) => ({ ...current, [ticketTypeId]: 1 }));
		navigate('/cart');
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

			<div className="event-grid" style={{ marginTop: 16 }}>
				{(eventData.ticketTypes || []).map((ticketType) => {
					const available = Number(ticketType.quantity) - Number(ticketType.quantitySold || 0);
					const maxSelectable = Math.min(5, Math.max(available, 1));
					const selectedQuantity = Math.min(quantitiesByTicketType[ticketType.id] || 1, maxSelectable);
					const previewQuantity = available < 1 ? 0 : selectedQuantity;
					const previewTotal = Number(ticketType.price) * previewQuantity;

					return (
						<article className="event-card" key={ticketType.id}>
							<h2>Tickets</h2>
							<p>{ticketType.name}</p>
							<p>${Number(ticketType.price).toFixed(2)}</p>
							<p className="event-card__meta">Available: {available}</p>
							<div className="inline-actions" style={{ alignItems: 'center' }}>
								<button
									type="button"
									className="action-btn action-btn--primary"
									onClick={() => addToCart(ticketType.id, selectedQuantity)}
									disabled={available < 1}
								>
									{available < 1 ? 'Sold Out' : 'Add to Cart'}
								</button>
								<input
									id={`quantity-${ticketType.id}`}
									type="number"
									min={1}
									max={maxSelectable}
									value={selectedQuantity}
									onChange={(eventInput) => {
										const nextValue = Number(eventInput.target.value);
										const normalized = Number.isFinite(nextValue)
											? Math.min(Math.max(1, nextValue), maxSelectable)
											: 1;
										setQuantitiesByTicketType((current) => ({
											...current,
											[ticketType.id]: normalized
										}));
									}}
									disabled={available < 1}
									style={{ width: '6ch', textAlign: 'center', paddingRight: 6 }}
									aria-label="Quantity"
								/>
								<p className="event-card__meta" style={{ margin: 0, fontWeight: 700 }}>
									Total: ${previewTotal.toFixed(2)}
								</p>
							</div>
						</article>
					);
				})}
			</div>

			{eventData.venue ? (
				<div className="panel-card" style={{ marginTop: 16 }}>
					<h2 style={{ marginTop: 0, marginBottom: 8 }}>Venue</h2>
					{eventData.venue.name ? <p style={{ margin: '0 0 4px' }}><strong>{eventData.venue.name}</strong></p> : null}
					{eventData.venue.address ? <p style={{ margin: '0 0 4px' }}>{eventData.venue.address}</p> : null}
					<p className="event-card__meta" style={{ margin: 0 }}>
						{[eventData.venue.city, eventData.venue.state].filter(Boolean).join(', ')}
						{eventData.venue.postalCode ? ` ${eventData.venue.postalCode}` : ''}
					</p>
				</div>
			) : null}
		</section>
	);
};

export default EventDetail;
