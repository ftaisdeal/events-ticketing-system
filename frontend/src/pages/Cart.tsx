import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CartItem } from '../utils/checkoutApi';
import { api } from '../utils/api';
import { clearStoredCart, readStoredCart, StoredCart, writeStoredCart } from '../utils/cartStorage';

type CartEventSummary = {
	id: number;
	title: string;
	startDateTime: string;
	endDateTime: string;
	venue?: {
		name?: string;
		address?: string;
		city?: string;
		state?: string;
		postalCode?: string;
	};
};

const Cart = (): JSX.Element => {
	const navigate = useNavigate();
	const [cart, setCart] = useState<StoredCart>(() => readStoredCart());
	const [eventSummary, setEventSummary] = useState<CartEventSummary | null>(null);
	const [isLoadingEvent, setIsLoadingEvent] = useState(false);

	const totalUnits = useMemo(
		() => cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
		[cart.items]
	);

	useEffect(() => {
		let active = true;

		const loadEventSummary = async () => {
			if (!cart.eventId) {
				if (active) {
					setEventSummary(null);
				}
				return;
			}

			setIsLoadingEvent(true);
			try {
				const response = await api.get('/events?limit=500');
				if (!active) {
					return;
				}

				const events = (response.data.events || []) as CartEventSummary[];
				setEventSummary(events.find((event) => event.id === cart.eventId) || null);
			} catch (_error) {
				if (active) {
					setEventSummary(null);
				}
			} finally {
				if (active) {
					setIsLoadingEvent(false);
				}
			}
		};

		loadEventSummary();

		return () => {
			active = false;
		};
	}, [cart.eventId]);

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

	const persistCart = (nextEventId: number, nextItems: CartItem[]) => {
		writeStoredCart(nextEventId, nextItems);
	};

	const onClearCart = () => {
		setCart({ eventId: 0, items: [] });
		setEventSummary(null);
		clearStoredCart();
	};

	const onProceedToCheckout = () => {
		persistCart(cart.eventId, cart.items);
		navigate('/checkout');
	};

	const venueName = eventSummary?.venue?.name || 'TBA';
	const venueStreet = eventSummary?.venue?.address || '';
	const venueCityStateZip = [
		eventSummary?.venue?.city || '',
		eventSummary?.venue?.state || ''
	].filter(Boolean).join(', ') + `${eventSummary?.venue?.postalCode ? ` ${eventSummary.venue.postalCode}` : ''}`;

	return (
		<section>
			<h1 className="page-title">Your Cart</h1>
			{cart.items.length === 0 ? <p>No items in cart.</p> : null}

			{cart.items.length > 0 ? (
				<div className="panel-card form-stack" style={{ marginBottom: 12 }}>
					<h3 style={{ marginBottom: 4 }}>{eventSummary?.title || (isLoadingEvent ? 'Loading...' : 'Unknown event')}</h3>
					<p>{eventSummary ? formatEventRange(eventSummary.startDateTime, eventSummary.endDateTime) : 'TBA'}</p>
					<div className="event-card__meta">
						<p style={{ margin: 0 }}>{venueName}</p>
						{venueStreet ? <p style={{ margin: 0 }}>{venueStreet}</p> : null}
						{venueCityStateZip ? <p style={{ margin: 0 }}>{venueCityStateZip}</p> : null}
					</div>
					<p>{totalUnits} ticket{totalUnits === 1 ? '' : 's'}</p>
				</div>
			) : null}

			{cart.items.length > 0 ? (
				<div className="inline-actions">
					<button className="action-btn action-btn--primary" type="button" onClick={onProceedToCheckout} disabled={!cart.eventId}>
						Proceed to Checkout
					</button>
					<button className="action-btn action-btn--ghost" type="button" onClick={onClearCart}>
						Clear Cart
					</button>
				</div>
			) : null}
		</section>
	);
};

export default Cart;
