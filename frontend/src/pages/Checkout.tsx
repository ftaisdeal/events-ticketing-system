import axios from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { createPaymentIntent, reserveOrder } from '../utils/checkoutApi';
import { api } from '../utils/api';

const cartStorageKey = 'ticketing_cart';

type CartSnapshot = {
	eventId: number;
	items: Array<{ ticketTypeId: number; quantity: number }>;
};

type CheckoutEventSummary = {
	id: number;
	title: string;
	startDateTime: string;
	endDateTime: string;
};

const readCart = (): CartSnapshot => {
	const raw = localStorage.getItem(cartStorageKey);
	if (!raw) {
		return { eventId: 0, items: [] };
	}

	try {
		const parsed = JSON.parse(raw) as CartSnapshot;
		return {
			eventId: Number(parsed.eventId) || 0,
			items: Array.isArray(parsed.items) ? parsed.items : []
		};
	} catch (_error) {
		return { eventId: 0, items: [] };
	}
};

const Checkout = (): JSX.Element => {
	const { token, isAuthenticated } = useAuth();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string>('');
	const [eventSummary, setEventSummary] = useState<CheckoutEventSummary | null>(null);
	const [isLoadingEvent, setIsLoadingEvent] = useState(false);
	const [reservationResult, setReservationResult] = useState<{
		orderId: number;
		reservationExpiresAt: string;
	} | null>(null);
	const [intentResult, setIntentResult] = useState<{
		paymentIntentId: string;
		clientSecret: string | null;
	} | null>(null);

	const cart = useMemo(() => readCart(), []);
	const hasValidCart = cart.eventId > 0 && cart.items.length > 0;

	useEffect(() => {
		let active = true;

		const loadEventSummary = async () => {
			if (!cart.eventId) {
				setEventSummary(null);
				return;
			}

			setIsLoadingEvent(true);
			try {
				const response = await api.get('/events?limit=500');
				if (!active) {
					return;
				}

				const events = (response.data.events || []) as CheckoutEventSummary[];
				setEventSummary(events.find((event) => event.id === cart.eventId) || null);
			} catch (_requestError) {
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

	const runCheckout = async () => {
		setError('');
		setReservationResult(null);
		setIntentResult(null);

		if (!hasValidCart) {
			setError('Cart is empty. Add items in Cart first.');
			return;
		}

		if (!token) {
			setError('You must be logged in to complete checkout.');
			return;
		}

		setIsSubmitting(true);

		try {
			const reserve = await reserveOrder(token, {
				eventId: cart.eventId,
				items: cart.items
			});

			setReservationResult({
				orderId: reserve.order.id,
				reservationExpiresAt: reserve.reservationExpiresAt
			});

			const intent = await createPaymentIntent(token, {
				orderId: reserve.order.id
			});

			setIntentResult({
				paymentIntentId: intent.paymentIntentId,
				clientSecret: intent.clientSecret
			});
		} catch (requestError) {
			if (axios.isAxiosError(requestError)) {
				const message =
					(requestError.response?.data as { message?: string } | undefined)?.message ||
					requestError.message;
				setError(message);
			} else {
				setError('Unexpected checkout error.');
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<section>
			<h1 className="page-title">Checkout</h1>
			{!isAuthenticated ? (
				<p className="error-text">
					You are not signed in. <Link to="/login">Sign in</Link> first.
				</p>
			) : null}

			<div className="panel-card">
				<p><strong>{eventSummary?.title || (isLoadingEvent ? 'Loading...' : 'Unknown event')}</strong></p>
				<p>{eventSummary ? formatEventRange(eventSummary.startDateTime, eventSummary.endDateTime) : 'TBA'}</p>
				<div>
					{cart.items.map((item) => (
						<p key={item.ticketTypeId}>{item.quantity} {item.quantity === 1 ? 'ticket' : 'tickets'}</p>
					))}
				</div>
				{!hasValidCart ? <p>Cart is empty. Go to /cart and add items.</p> : null}
			</div>

			<div className="inline-actions" style={{ marginTop: 16 }}>
				<button className="action-btn action-btn--primary" type="button" disabled={isSubmitting || !hasValidCart || !isAuthenticated} onClick={runCheckout}>
					{isSubmitting ? 'Processing...' : 'Continue to Secure Payment'}
				</button>
				<Link to="/cart" className="action-btn action-btn--ghost">
					Edit Cart
				</Link>
			</div>

			{error ? <p className="error-text" style={{ marginTop: 16 }}>Error: {error}</p> : null}

			{reservationResult ? (
				<div className="panel-card" style={{ marginTop: 16 }}>
					<h3>Reservation Created</h3>
					<p>Order ID: {reservationResult.orderId}</p>
					<p>Expires At: {new Date(reservationResult.reservationExpiresAt).toLocaleString()}</p>
				</div>
			) : null}

			{intentResult ? (
				<div className="panel-card" style={{ marginTop: 16 }}>
					<h3>PaymentIntent Created</h3>
					<p>Payment Intent ID: {intentResult.paymentIntentId}</p>
					<p>Client Secret:</p>
					<textarea
						readOnly
						value={intentResult.clientSecret || ''}
						rows={3}
						className="mono-output"
					/>
				</div>
			) : null}
		</section>
	);
};

export default Checkout;
