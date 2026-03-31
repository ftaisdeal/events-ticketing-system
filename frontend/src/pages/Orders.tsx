import React, { useEffect, useState } from 'react';

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
};

const Orders = (): JSX.Element => {
	const { token } = useAuth();
	const [orders, setOrders] = useState<OrderRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		let active = true;

		const fetchOrders = async () => {
			if (!token) {
				if (active) {
					setError('You are not authenticated.');
					setIsLoading(false);
				}
				return;
			}

			try {
				const response = await api.get('/orders/my', {
					headers: getAuthHeader(token)
				});

				if (active) {
					setOrders((response.data.orders || []) as OrderRow[]);
				}
			} catch (_error) {
				if (active) {
					setError('Unable to fetch orders.');
				}
			} finally {
				if (active) {
					setIsLoading(false);
				}
			}
		};

		fetchOrders();

		return () => {
			active = false;
		};
	}, [token]);

	return (
		<section>
			<h1 className="page-title">My Orders</h1>
			{isLoading ? <p>Loading orders...</p> : null}
			{error ? <p className="error-text">{error}</p> : null}

			<div className="event-grid">
				{orders.map((order) => (
					<article className="event-card" key={order.id}>
						<h2>{order.orderNumber || `Order #${order.id}`}</h2>
						<p>
							Total: {Number(order.totalAmount).toFixed(2)} {order.currency}
						</p>
						<p className="event-card__meta">Status: {order.status}</p>
						<p className="event-card__meta">Placed: {new Date(order.createdAt).toLocaleString()}</p>
						{order.expiresAt ? <p className="event-card__meta">Expires: {new Date(order.expiresAt).toLocaleString()}</p> : null}
						{order.confirmedAt ? <p className="event-card__meta">Confirmed: {new Date(order.confirmedAt).toLocaleString()}</p> : null}
					</article>
				))}
			</div>
		</section>
	);
};

export default Orders;
