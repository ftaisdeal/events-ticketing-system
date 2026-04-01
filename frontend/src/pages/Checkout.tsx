import axios from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { createPaymentIntent, expireOrderReservation, reserveOrder } from '../utils/checkoutApi';
import { api } from '../utils/api';
import { CART_UPDATED_EVENT, readStoredCart, StoredCart } from '../utils/cartStorage';

type CheckoutEventSummary = {
	id: number;
	title: string;
	startDateTime: string;
	endDateTime: string;
};

type CheckoutReservation = {
	orderId: number;
	reservationExpiresAt: string;
};

type CheckoutIntent = {
	paymentIntentId: string;
	clientSecret: string | null;
};

type CheckoutSessionState = {
	cartSignature: string;
	reservationResult: CheckoutReservation | null;
	intentResult: CheckoutIntent | null;
};

const CHECKOUT_SESSION_KEY = 'ticketing_checkout_session';

const Checkout = (): JSX.Element => {
	const navigate = useNavigate();
	const { token, isAuthenticated } = useAuth();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string>('');
	const [eventSummary, setEventSummary] = useState<CheckoutEventSummary | null>(null);
	const [isLoadingEvent, setIsLoadingEvent] = useState(false);
	const [cart, setCart] = useState<StoredCart>(() => readStoredCart());
	const [reservationResult, setReservationResult] = useState<CheckoutReservation | null>(null);
	const [intentResult, setIntentResult] = useState<CheckoutIntent | null>(null);
	const [hasStartedCheckout, setHasStartedCheckout] = useState(false);
	const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
	const [isSessionHydrated, setIsSessionHydrated] = useState(false);

	const totalUnits = useMemo(
		() => cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
		[cart.items]
	);
	const hasValidCart = cart.eventId > 0 && totalUnits > 0;
	const cartSignature = useMemo(() => {
		const normalizedItems = cart.items
			.map((item) => ({
				ticketTypeId: Number(item.ticketTypeId) || 0,
				quantity: Number(item.quantity) || 0
			}))
			.filter((item) => item.ticketTypeId > 0 && item.quantity > 0)
			.sort((a, b) => a.ticketTypeId - b.ticketTypeId);

		return JSON.stringify({
			eventId: Number(cart.eventId) || 0,
			items: normalizedItems
		});
	}, [cart.eventId, cart.items]);

	// Countdown timer
	useEffect(() => {
		if (!reservationResult?.reservationExpiresAt) {
			return;
		}

		let expirationHandled = false;

		const interval = setInterval(() => {
			const expiresAt = new Date(reservationResult.reservationExpiresAt).getTime();
			const now = Date.now();
			const remaining = Math.max(0, expiresAt - now);

			setTimeRemaining(remaining);

			if (remaining <= 0) {
				clearInterval(interval);

				if (expirationHandled) {
					return;
				}

				expirationHandled = true;
				void (async () => {
					try {
						if (token && reservationResult.orderId) {
							await expireOrderReservation(token, { orderId: reservationResult.orderId });
						}
					} catch (_error) {
						// Best effort status sync; redirect should still happen even if this request fails.
					} finally {
						sessionStorage.removeItem(CHECKOUT_SESSION_KEY);
						navigate('/cart', { replace: true });
					}
				})();
			}
		}, 1000);

		return () => clearInterval(interval);
	}, [navigate, reservationResult, token]);

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
		if (!hasValidCart) {
			sessionStorage.removeItem(CHECKOUT_SESSION_KEY);
			setIsSessionHydrated(true);
			return;
		}

		try {
			const raw = sessionStorage.getItem(CHECKOUT_SESSION_KEY);
			if (!raw) {
				setIsSessionHydrated(true);
				return;
			}

			const parsed = JSON.parse(raw) as CheckoutSessionState;
			const signatureMatches = parsed.cartSignature === cartSignature;
			const expirationMs = parsed.reservationResult?.reservationExpiresAt
				? new Date(parsed.reservationResult.reservationExpiresAt).getTime()
				: 0;
			const isExpired = expirationMs > 0 && expirationMs <= Date.now();

			if (!signatureMatches || isExpired) {
				sessionStorage.removeItem(CHECKOUT_SESSION_KEY);
				setIsSessionHydrated(true);
				return;
			}

			setReservationResult(parsed.reservationResult || null);
			setIntentResult(parsed.intentResult || null);
			setHasStartedCheckout(Boolean(parsed.reservationResult || parsed.intentResult));
		} catch (_error) {
			sessionStorage.removeItem(CHECKOUT_SESSION_KEY);
		} finally {
			setIsSessionHydrated(true);
		}
	}, [cartSignature, hasValidCart]);

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
			let nextReservation = reservationResult;
			let orderId = reservationResult?.orderId;

			if (!orderId) {
				const reserve = await reserveOrder(token, {
					eventId: cart.eventId,
					items: cart.items
				});

				orderId = reserve.order.id;
				nextReservation = {
					orderId: reserve.order.id,
					reservationExpiresAt: reserve.reservationExpiresAt
				};
				setReservationResult(nextReservation);
			}

			const intent = await createPaymentIntent(token, {
				orderId
			});

			const nextIntent = {
				paymentIntentId: intent.paymentIntentId,
				clientSecret: intent.clientSecret
			};
			setIntentResult(nextIntent);

			sessionStorage.setItem(
				CHECKOUT_SESSION_KEY,
				JSON.stringify({
					cartSignature,
					reservationResult: nextReservation,
					intentResult: nextIntent
				} satisfies CheckoutSessionState)
			);
		} catch (requestError) {
			if (axios.isAxiosError(requestError)) {
				const message =
					(requestError.response?.data as { message?: string } | undefined)?.message ||
					requestError.message;
				const status = requestError.response?.status;

				if (status === 404 || status === 410 || message.toLowerCase().includes('pending')) {
					setReservationResult(null);
					setIntentResult(null);
					setHasStartedCheckout(false);
					sessionStorage.removeItem(CHECKOUT_SESSION_KEY);
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
		if (!isSessionHydrated || !hasValidCart || !isAuthenticated || !token || hasStartedCheckout || intentResult) {
			return;
		}

		setHasStartedCheckout(true);
		void runCheckout();
	}, [hasValidCart, hasStartedCheckout, intentResult, isAuthenticated, isSessionHydrated, token]);

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
				{reservationResult && timeRemaining !== null ? (
					<p style={{ marginTop: 12, marginBottom: 0, color: timeRemaining < 60000 ? '#bf2f2f' : 'inherit' }}>
						To claim your ticket{totalUnits === 1 ? '' : 's'}, you must complete your order within{' '}
						<strong>{Math.floor(timeRemaining / 60000)}:{String(Math.floor((timeRemaining % 60000) / 1000)).padStart(2, '0')}</strong>
					</p>
				) : null}
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
