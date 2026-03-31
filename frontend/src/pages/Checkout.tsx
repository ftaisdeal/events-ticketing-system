import axios from 'axios';
import React, { useMemo, useState } from 'react';

import { createPaymentIntent, reserveOrder } from '../utils/checkoutApi';

const cartStorageKey = 'ticketing_cart';
const tokenStorageKey = 'token';

type CartSnapshot = {
	eventId: number;
	items: Array<{ ticketTypeId: number; quantity: number }>;
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
	const [token, setToken] = useState<string>(() => localStorage.getItem(tokenStorageKey) || '');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string>('');
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

	const persistToken = () => {
		localStorage.setItem(tokenStorageKey, token.trim());
	};

	const runCheckout = async () => {
		setError('');
		setReservationResult(null);
		setIntentResult(null);

		if (!hasValidCart) {
			setError('Cart is empty. Add items in Cart first.');
			return;
		}

		const safeToken = token.trim();
		if (!safeToken) {
			setError('JWT token is required. Paste token from auth/login response.');
			return;
		}

		setIsSubmitting(true);

		try {
			persistToken();

			const reserve = await reserveOrder(safeToken, {
				eventId: cart.eventId,
				items: cart.items
			});

			setReservationResult({
				orderId: reserve.order.id,
				reservationExpiresAt: reserve.reservationExpiresAt
			});

			const intent = await createPaymentIntent(safeToken, {
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
			<h1>Checkout</h1>
			<p>This page reserves tickets, then creates a Stripe PaymentIntent.</p>

			<div style={{ border: '1px solid #d8d8d8', borderRadius: 6, padding: 12, maxWidth: 760 }}>
				<h2 style={{ marginTop: 0 }}>Cart Snapshot</h2>
				<p>Event ID: {cart.eventId || 'none'}</p>
				<ul>
					{cart.items.map((item) => (
						<li key={item.ticketTypeId}>
							Ticket Type #{item.ticketTypeId} x {item.quantity}
						</li>
					))}
				</ul>
				{!hasValidCart ? <p>Cart is empty. Go to /cart and add items.</p> : null}
			</div>

			<div style={{ display: 'grid', gap: 8, marginTop: 16, maxWidth: 760 }}>
				<label htmlFor="tokenInput">
					JWT Token
					<textarea
						id="tokenInput"
						value={token}
						onChange={(e) => setToken(e.target.value)}
						rows={4}
						placeholder="Paste Bearer token value (without 'Bearer ')"
						style={{ width: '100%', marginTop: 4, padding: 8, fontFamily: 'monospace' }}
					/>
				</label>

				<button type="button" disabled={isSubmitting || !hasValidCart} onClick={runCheckout}>
					{isSubmitting ? 'Processing...' : 'Reserve and Create PaymentIntent'}
				</button>
			</div>

			{error ? <p style={{ color: '#c62828', marginTop: 16 }}>Error: {error}</p> : null}

			{reservationResult ? (
				<div style={{ marginTop: 16, border: '1px solid #d8d8d8', borderRadius: 6, padding: 12 }}>
					<h3 style={{ marginTop: 0 }}>Reservation Created</h3>
					<p>Order ID: {reservationResult.orderId}</p>
					<p>Expires At: {new Date(reservationResult.reservationExpiresAt).toLocaleString()}</p>
				</div>
			) : null}

			{intentResult ? (
				<div style={{ marginTop: 16, border: '1px solid #d8d8d8', borderRadius: 6, padding: 12 }}>
					<h3 style={{ marginTop: 0 }}>PaymentIntent Created</h3>
					<p>Payment Intent ID: {intentResult.paymentIntentId}</p>
					<p>Client Secret:</p>
					<textarea
						readOnly
						value={intentResult.clientSecret || ''}
						rows={3}
						style={{ width: '100%', padding: 8, fontFamily: 'monospace' }}
					/>
				</div>
			) : null}
		</section>
	);
};

export default Checkout;
