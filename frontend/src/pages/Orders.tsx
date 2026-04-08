import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { api, getAuthHeader } from '../utils/api';

type OrderRow = {
	id: number;
	orderNumber: string;
	status: string;
	totalAmount: number;
	currency: string;
	createdAt: string;
	expiresAt?: string | null;
	confirmedAt?: string | null;
	payments?: Array<{
		id: number;
		status: string;
		failureReason?: string | null;
		processedAt?: string | null;
		createdAt?: string;
	}>;
};

const PAYMENT_FAILURE_STATUSES = new Set(['failed', 'cancelled']);
const HIDDEN_HISTORY_STATUSES = new Set(['expired', 'failed', 'cancelled']);

const getLatestPayment = (order: OrderRow) => {
	if (!Array.isArray(order.payments) || order.payments.length === 0) {
		return null;
	}

	return [...order.payments].sort((left, right) => {
		const leftTime = new Date(left.processedAt || left.createdAt || 0).getTime();
		const rightTime = new Date(right.processedAt || right.createdAt || 0).getTime();
		return rightTime - leftTime;
	})[0];
};

const getPaymentFailureMessage = (order: OrderRow) => {
	const latestPayment = getLatestPayment(order);
	if (!latestPayment || !PAYMENT_FAILURE_STATUSES.has(latestPayment.status)) {
		return null;
	}

	return latestPayment.failureReason || 'Payment could not be completed.';
};

const Orders = (): JSX.Element => {
	const { token } = useAuth();
	const [searchParams] = useSearchParams();
	const [orders, setOrders] = useState<OrderRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');
	const paymentState = searchParams.get('payment');
	const highlightedOrderId = Number(searchParams.get('orderId') || 0);
	const isProcessingPayment = paymentState === 'processing' && highlightedOrderId > 0;

	const fetchOrders = useCallback(async (activeRef: { current: boolean }) => {
			if (!token) {
				if (activeRef.current) {
					setError('You are not authenticated.');
					setIsLoading(false);
				}
				return;
			}

			try {
				const response = await api.get('/orders/my', {
					headers: getAuthHeader(token)
				});

				if (activeRef.current) {
					setOrders((response.data.orders || []) as OrderRow[]);
					setError('');
				}
			} catch (_error) {
				if (activeRef.current) {
					setError('Unable to fetch orders.');
				}
			} finally {
				if (activeRef.current) {
					setIsLoading(false);
				}
			}
	}, [token]);

	useEffect(() => {
		const active = { current: true };

		void fetchOrders(active);

		return () => {
			active.current = false;
		};
	}, [fetchOrders]);

	useEffect(() => {
		if (!isProcessingPayment || !token) {
			return;
		}

		const active = { current: true };
		const interval = window.setInterval(() => {
			void fetchOrders(active);
		}, 3000);

		return () => {
			active.current = false;
			window.clearInterval(interval);
		};
	}, [fetchOrders, isProcessingPayment, token]);

	const highlightedOrder = highlightedOrderId > 0
		? orders.find((order) => order.id === highlightedOrderId)
		: undefined;
	const visibleOrders = orders.filter((order) => !HIDDEN_HISTORY_STATUSES.has(order.status));
	const activeOrders = visibleOrders.filter((order) => order.status === 'pending');
	const historicalOrders = visibleOrders.filter((order) => order.status !== 'pending');
	const highlightedOrderLatestPayment = highlightedOrder ? getLatestPayment(highlightedOrder) : null;
	const highlightedOrderFailureMessage = highlightedOrder ? getPaymentFailureMessage(highlightedOrder) : null;
	const showProcessingBanner = isProcessingPayment && (!highlightedOrder || highlightedOrder.status === 'pending');
	const showSuccessBanner = highlightedOrder?.status === 'confirmed';
	const showRetryBanner = highlightedOrder?.status === 'pending'
		&& Boolean(highlightedOrderLatestPayment && PAYMENT_FAILURE_STATUSES.has(highlightedOrderLatestPayment.status));

	return (
		<section>
			<h1 className="page-title">My Orders</h1>
			{showProcessingBanner ? (
				<div className="panel-card payment-banner payment-banner--processing">
					<strong>Payment received.</strong>
					<p className="payment-status-text">We are waiting for Stripe webhook confirmation before marking your order as confirmed.</p>
				</div>
			) : null}
			{showSuccessBanner ? (
				<div className="panel-card payment-banner payment-banner--success">
					<strong>Order confirmed.</strong>
					<p className="payment-status-text">Your tickets have been issued and this order is now confirmed.</p>
				</div>
			) : null}
			{showRetryBanner ? (
				<div className="panel-card payment-banner">
					<strong>Payment attempt failed.</strong>
					<p className="payment-status-text">{highlightedOrderFailureMessage || 'This payment attempt did not complete successfully.'}</p>
					<p className="payment-status-text">Your order is still pending until the reservation expires. Retry checkout with another card to complete it.</p>
				</div>
			) : null}
			{isLoading ? <p>Loading orders...</p> : null}
			{error ? <p className="error-text">{error}</p> : null}
			{!isLoading && !error && visibleOrders.length === 0 ? <p>No active or completed orders yet.</p> : null}

			{activeOrders.length > 0 ? <h2>Active Reservations</h2> : null}
			{activeOrders.length > 0 ? (
				<div className="event-grid">
					{activeOrders.map((order) => (
						<article className="event-card" key={order.id}>
							<h2>{order.orderNumber || `Order #${order.id}`}</h2>
							<p>
								Total: {Number(order.totalAmount).toFixed(2)} {order.currency}
							</p>
							<p className="event-card__meta">Status: {order.status}</p>
							<p className="event-card__meta">Placed: {new Date(order.createdAt).toLocaleString()}</p>
							{order.expiresAt ? <p className="event-card__meta">Reservation expires: {new Date(order.expiresAt).toLocaleString()}</p> : null}
							{getPaymentFailureMessage(order) ? <p className="event-card__meta">Latest payment attempt: {getPaymentFailureMessage(order)}</p> : null}
						</article>
					))}
				</div>
			) : null}

			{historicalOrders.length > 0 ? <h2>Order History</h2> : null}
			{historicalOrders.length > 0 ? (
				<div className="event-grid">
					{historicalOrders.map((order) => (
					<article className="event-card" key={order.id}>
						<h2>{order.orderNumber || `Order #${order.id}`}</h2>
						<p>
							Total: {Number(order.totalAmount).toFixed(2)} {order.currency}
						</p>
						<p className="event-card__meta">Status: {order.status}</p>
						<p className="event-card__meta">Placed: {new Date(order.createdAt).toLocaleString()}</p>
						{order.expiresAt ? <p className="event-card__meta">Expires: {new Date(order.expiresAt).toLocaleString()}</p> : null}
						{order.confirmedAt ? <p className="event-card__meta">Confirmed: {new Date(order.confirmedAt).toLocaleString()}</p> : null}
						{getPaymentFailureMessage(order) ? <p className="event-card__meta">Latest payment attempt: {getPaymentFailureMessage(order)}</p> : null}
					</article>
					))}
				</div>
			) : null}
		</section>
	);
};

export default Orders;
