import axios from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { api, getAuthHeader } from '../utils/api';

type OrderTicket = {
	id: number;
	ticketNumber: string;
	shortCode?: string;
	status: string;
	price: number;
	ticketType?: {
		id: number;
		name: string;
	};
};

type OrderPayment = {
	id: number;
	status: string;
	failureReason?: string | null;
	processedAt?: string | null;
	createdAt?: string;
};

type OrderEvent = {
	id: number;
	title: string;
	startDateTime?: string;
	endDateTime?: string;
};

type OrderLineItem = {
	ticketTypeId: number;
	quantity: number;
	unitPrice: number;
	eventId: number;
	ticketTypeName: string;
};

type OrderDetailRecord = {
	id: number;
	orderNumber: string;
	status: string;
	totalAmount: number;
	currency: string;
	createdAt: string;
	expiresAt?: string | null;
	confirmedAt?: string | null;
	customerInfo?: {
		lineItems?: OrderLineItem[];
	} | null;
	event?: OrderEvent;
	payments?: OrderPayment[];
	tickets?: OrderTicket[];
};

const PAYMENT_FAILURE_STATUSES = new Set(['failed', 'cancelled']);

const getLatestPayment = (payments?: OrderPayment[]) => {
	if (!Array.isArray(payments) || payments.length === 0) {
		return null;
	}

	return [...payments].sort((left, right) => {
		const leftTime = new Date(left.processedAt || left.createdAt || 0).getTime();
		const rightTime = new Date(right.processedAt || right.createdAt || 0).getTime();
		return rightTime - leftTime;
	})[0];
};

const formatShortCode = (shortCode?: string) => {
	const normalized = String(shortCode || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
	if (normalized.length !== 8) {
		return normalized;
	}

	return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
};

const OrderDetail = (): JSX.Element => {
	const { token } = useAuth();
	const { orderId } = useParams();
	const [searchParams] = useSearchParams();
	const [order, setOrder] = useState<OrderDetailRecord | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState('');
	const paymentState = searchParams.get('payment');
	const isProcessingPayment = paymentState === 'processing';

	const loadOrder = useCallback(async (active: { current: boolean }) => {
		if (!token) {
			if (active.current) {
				setError('You are not authenticated.');
				setIsLoading(false);
			}
			return;
		}

		if (!orderId) {
			if (active.current) {
				setError('Order not found.');
				setIsLoading(false);
			}
			return;
		}

		try {
			const response = await api.get(`/orders/${orderId}`, {
				headers: getAuthHeader(token)
			});

			if (active.current) {
				setOrder((response.data.order || null) as OrderDetailRecord | null);
				setError('');
			}
		} catch (requestError) {
			if (active.current) {
				if (axios.isAxiosError(requestError)) {
					const message =
						(requestError.response?.data as { message?: string } | undefined)?.message ||
						requestError.message ||
						'Unable to fetch order.';
					setError(message);
				} else {
					setError('Unable to fetch order.');
				}
			}
		} finally {
			if (active.current) {
				setIsLoading(false);
			}
		}
	}, [orderId, token]);

	useEffect(() => {
		let active = true;

		void loadOrder({ current: active });

		return () => {
			active = false;
		};
	}, [loadOrder]);

	useEffect(() => {
		if (!isProcessingPayment || !token || (order && order.status !== 'pending')) {
			return;
		}

		const active = { current: true };
		const interval = window.setInterval(() => {
			void loadOrder(active);
		}, 3000);

		return () => {
			active.current = false;
			window.clearInterval(interval);
		};
	}, [isProcessingPayment, loadOrder, order, token]);

	const latestPayment = useMemo(() => getLatestPayment(order?.payments), [order?.payments]);
	const showProcessingBanner = isProcessingPayment && (!order || order.status === 'pending');
	const showSuccessBanner = order?.status === 'confirmed';
	const showRetryBanner = order?.status === 'pending' && Boolean(latestPayment && PAYMENT_FAILURE_STATUSES.has(latestPayment.status));
	const lineItems = Array.isArray(order?.customerInfo?.lineItems) ? order.customerInfo?.lineItems || [] : [];

	return (
		<section>
			<div className="inline-actions">
				<Link className="action-btn action-btn--ghost" to="/orders">Back to Orders</Link>
			</div>
			<h1 className="page-title">Order Details</h1>
			{showProcessingBanner ? (
				<div className="panel-card payment-banner payment-banner--processing">
					<strong>Payment received.</strong>
					<p className="payment-status-text">We are waiting for Stripe webhook confirmation before marking your order as confirmed.</p>
				</div>
			) : null}
			{showSuccessBanner ? (
				<div className="panel-card payment-banner payment-banner--success">
					<strong>Order confirmed.</strong>
					<p className="payment-status-text">Your tickets have been issued and are listed below.</p>
				</div>
			) : null}
			{showRetryBanner ? (
				<div className="panel-card payment-banner">
					<strong>Payment attempt failed.</strong>
					<p className="payment-status-text">{latestPayment?.failureReason || 'This payment attempt did not complete successfully.'}</p>
				</div>
			) : null}
			{isLoading ? <p>Loading order...</p> : null}
			{error ? <p className="error-text">{error}</p> : null}
			{!isLoading && !error && order ? (
				<div className="detail-grid">
					<div className="panel-card">
						<h2>{order.orderNumber || `Order #${order.id}`}</h2>
						<p><strong>Status:</strong> {order.status}</p>
						<p><strong>Total:</strong> {Number(order.totalAmount).toFixed(2)} {order.currency}</p>
						<p><strong>Placed:</strong> {new Date(order.createdAt).toLocaleString()}</p>
						{order.confirmedAt ? <p><strong>Confirmed:</strong> {new Date(order.confirmedAt).toLocaleString()}</p> : null}
						{order.expiresAt ? <p><strong>Reservation expires:</strong> {new Date(order.expiresAt).toLocaleString()}</p> : null}
						{order.event ? <p><strong>Event:</strong> {order.event.title}</p> : null}
						{order.event?.startDateTime ? <p><strong>Event starts:</strong> {new Date(order.event.startDateTime).toLocaleString()}</p> : null}
					</div>

					<div className="panel-card">
						<h2>Line Items</h2>
						<div className="detail-list">
							{lineItems.length > 0 ? lineItems.map((item) => (
								<div className="detail-list__row" key={`${item.ticketTypeId}-${item.ticketTypeName}`}>
									<span>{item.ticketTypeName}</span>
									<span>{item.quantity} x {Number(item.unitPrice).toFixed(2)} {order.currency}</span>
								</div>
							)) : <p>No line items found.</p>}
						</div>
					</div>

					<div className="panel-card">
						<h2>Tickets</h2>
						<div className="detail-list">
							{Array.isArray(order.tickets) && order.tickets.length > 0 ? order.tickets.map((ticket) => (
								<div className="detail-list__row" key={ticket.id}>
									<span>{ticket.ticketType?.name || 'Ticket'} • {ticket.ticketNumber}{ticket.shortCode ? ` • Check-in: ${formatShortCode(ticket.shortCode)}` : ''}</span>
									<span>{ticket.status}</span>
								</div>
							)) : <p>Tickets will appear here once the order is confirmed.</p>}
						</div>
					</div>

					<div className="panel-card">
						<h2>Payments</h2>
						<div className="detail-list">
							{Array.isArray(order.payments) && order.payments.length > 0 ? order.payments.map((payment) => (
								<div className="detail-list__row" key={payment.id}>
									<span>{payment.status}</span>
									<span>{payment.failureReason || payment.processedAt || ''}</span>
								</div>
							)) : <p>No payment records found.</p>}
						</div>
					</div>
				</div>
			) : null}
		</section>
	);
};

export default OrderDetail;