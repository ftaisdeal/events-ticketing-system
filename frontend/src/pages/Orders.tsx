import axios from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { api, getAuthHeader } from '../utils/api';
import { formatCurrency } from '../utils/formatCurrency';

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
	const [orders, setOrders] = useState<OrderRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');

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
			} catch (requestError) {
				if (activeRef.current) {
					if (axios.isAxiosError(requestError)) {
						const message =
							(requestError.response?.data as { message?: string } | undefined)?.message ||
							requestError.message ||
							'Unable to fetch orders.';
						setError(message);
					} else {
						setError('Unable to fetch orders.');
					}
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

	const activeOrders = orders.filter((order) => order.status === 'pending');
	const historicalOrders = orders.filter((order) => order.status !== 'pending');

	return (
		<section>
			<h1 className="page-title">My Orders</h1>
			{isLoading ? <p>Loading orders...</p> : null}
			{error ? <p className="error-text">{error}</p> : null}
			{!isLoading && !error && orders.length === 0 ? <p>No active or completed orders yet.</p> : null}

			{activeOrders.length > 0 ? <h2>Active Reservations</h2> : null}
			{activeOrders.length > 0 ? (
				<div className="event-grid">
					{activeOrders.map((order) => (
						<article className="event-card" key={order.id}>
							<h2>{order.orderNumber || `Order #${order.id}`}</h2>
							<p>
								Total: {formatCurrency(Number(order.totalAmount), order.currency)}
							</p>
							<p className="event-card__meta">Status: {order.status}</p>
							<p className="event-card__meta">Placed: {new Date(order.createdAt).toLocaleString()}</p>
							{order.expiresAt ? <p className="event-card__meta">Reservation expires: {new Date(order.expiresAt).toLocaleString()}</p> : null}
							{getPaymentFailureMessage(order) ? <p className="event-card__meta">Latest payment attempt: {getPaymentFailureMessage(order)}</p> : null}
							<div className="event-card__actions">
								<Link className="action-btn action-btn--ghost" to={`/orders/${order.id}`}>View Details</Link>
							</div>
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
							Total: {formatCurrency(Number(order.totalAmount), order.currency)}
						</p>
						<p className="event-card__meta">Status: {order.status}</p>
						<p className="event-card__meta">Placed: {new Date(order.createdAt).toLocaleString()}</p>
						{order.expiresAt ? <p className="event-card__meta">Expires: {new Date(order.expiresAt).toLocaleString()}</p> : null}
						{order.confirmedAt ? <p className="event-card__meta">Confirmed: {new Date(order.confirmedAt).toLocaleString()}</p> : null}
						{getPaymentFailureMessage(order) ? <p className="event-card__meta">Latest payment attempt: {getPaymentFailureMessage(order)}</p> : null}
						<div className="event-card__actions">
							<Link className="action-btn action-btn--ghost" to={`/orders/${order.id}`}>View Details</Link>
						</div>
					</article>
					))}
				</div>
			) : null}
		</section>
	);
};

export default Orders;
