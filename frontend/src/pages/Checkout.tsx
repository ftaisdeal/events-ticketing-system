import axios from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { createPaymentIntent, reserveOrder } from '../utils/checkoutApi';
import { api } from '../utils/api';
import { CART_UPDATED_EVENT, readStoredCart, StoredCart } from '../utils/cartStorage';

type CheckoutEventSummary = {
	id: number;
	title: string;
	startDateTime: string;
	endDateTime: string;
};

const Checkout = (): JSX.Element => {
	const navigate = useNavigate();
	const { token, isAuthenticated } = useAuth();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string>('');
	const [eventSummary, setEventSummary] = useState<CheckoutEventSummary | null>(null);
	const [isLoadingEvent, setIsLoadingEvent] = useState(false);
	const [cart, setCart] = useState<StoredCart>(() => readStoredCart());
	const [reservationResult, setReservationResult] = useState<{
		orderId: number;
		reservationExpiresAt: string;
	} | null>(null);
	const [intentResult, setIntentResult] = useState<{
		paymentIntentId: string;
		clientSecret: string | null;
	} | null>(null);
	const [hasStartedCheckout, setHasStartedCheckout] = useState(false);

	const totalUnits = useMemo(
		() => cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
		[cart.items]
	);
	const hasValidCart = cart.eventId > 0 && totalUnits > 0;

	useEffect(() => {
		const refreshCart = () => {
			setCart(readStoredCart());
		};

		window.addEventListener('storage', refreshCart);
		window.addEventListener(CART_UPDATED_EVENT, refreshCart as EventListener);

		return () => {
			window.removeEventListener('storage', refreshCart);
			window.removeEventListener(CART_UPDATED_EVENT, refreshCart as EventListener);
		};
	}, []);

	useEffect(() => {
		if (!hasValidCart) {
			navigate('/cart', { replace: true });
		}
	}, [hasValidCart, navigate]);

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
			let orderId = reservationResult?.orderId;

			if (!orderId) {
				const reserve = await reserveOrder(token, {
					eventId: cart.eventId,
					items: cart.items
				});

				orderId = reserve.order.id;
				setReservationResult({
					orderId: reserve.order.id,
					reservationExpiresAt: reserve.reservationExpiresAt
				});
			}

			const intent = await createPaymentIntent(token, {
				orderId
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
				const status = requestError.response?.status;

				if (status === 404 || status === 410 || message.toLowerCase().includes('pending')) {
					setReservationResult(null);
				}

				setError(message);
			} else {
				setError('Unexpected checkout error.');
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	useEffect(() => {
		if (!hasValidCart || !isAuthenticated || !token || hasStartedCheckout) {
			return;
		}

		setHasStartedCheckout(true);
		void runCheckout();
	}, [hasValidCart, isAuthenticated, token, hasStartedCheckout]);

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
				{isSubmitting ? <p>Preparing secure payment...</p> : null}
			</div>

			<div className="inline-actions" style={{ marginTop: 16 }}>
				{error ? (
					<button className="action-btn action-btn--primary" type="button" disabled={isSubmitting || !hasValidCart || !isAuthenticated} onClick={runCheckout}>
						{isSubmitting ? 'Processing...' : 'Retry Payment Setup'}
					</button>
				) : null}
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
