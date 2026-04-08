import db from '../models';
import QRCode from 'qrcode';
import { isEmailConfigured, sendEmail } from './mailer';

type LineItem = {
	ticketTypeId: number;
	quantity: number;
	unitPrice: number;
	eventId: number;
	ticketTypeName: string;
};

const parseLineItemsFromOrder = (order: any): LineItem[] => {
	const customerInfo = order.customerInfo as { lineItems?: LineItem[] } | null;
	if (!customerInfo || !Array.isArray(customerInfo.lineItems)) {
		return [];
	}

	return customerInfo.lineItems;
};

const formatMoney = (amount: number, currency: string) => {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: String(currency || 'USD').toUpperCase()
	}).format(amount);
};

const formatShortCode = (shortCode: string) => {
	const normalized = String(shortCode || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
	if (normalized.length !== 8) {
		return normalized;
	}

	return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
};

const escapeHtml = (value: string) => {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
};

const buildOrderConfirmationEmail = async (order: any) => {
	const publicFrontendUrl = process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL;
	const lineItems = parseLineItemsFromOrder(order);
	const eventTitle = order.event?.title || 'Your event';
	const eventDate = order.event?.startDateTime
		? new Date(order.event.startDateTime).toLocaleString()
		: 'TBD';
	const customerName = [order.user?.firstName, order.user?.lastName].filter(Boolean).join(' ') || 'Customer';
	const total = formatMoney(Number(order.totalAmount || 0), String(order.currency || 'USD'));
	const ticketNumbers = Array.isArray(order.tickets)
		? order.tickets.map((ticket: any) => ({
			ticketNumber: String(ticket.ticketNumber),
			shortCode: String(ticket.shortCode || ''),
			qrCode: String(ticket.qrCode || `ticket:${ticket.ticketNumber}`),
			ticketTypeName: String(ticket.ticketType?.name || 'Ticket')
		})).filter((ticket: { ticketNumber: string; shortCode: string }) => Boolean(ticket.ticketNumber))
		: [];
	const lineItemLines = lineItems.length > 0
		? lineItems.map((item) => `- ${item.ticketTypeName}: ${item.quantity} x ${formatMoney(Number(item.unitPrice || 0), String(order.currency || 'USD'))}`).join('\n')
		: '- Tickets will appear in your account shortly';
	const ticketNumberLines = ticketNumbers.length > 0 ? ticketNumbers.map((ticket: { ticketNumber: string; shortCode: string }) => `- ${ticket.ticketNumber}${ticket.shortCode ? ` (check-in code: ${formatShortCode(ticket.shortCode)})` : ''}`).join('\n') : '- Tickets available in your account';
	const ordersUrl = publicFrontendUrl ? `${publicFrontendUrl.replace(/\/$/, '')}/orders/${order.id}` : null;
	const ticketQrSections = await Promise.all(ticketNumbers.map(async (ticket: { ticketNumber: string; shortCode: string; qrCode: string; ticketTypeName: string }) => {
		const qrDataUrl = await QRCode.toDataURL(ticket.qrCode, {
			margin: 1,
			width: 220
		});

		return {
			...ticket,
			qrDataUrl
		};
	}));

	const text = [
		`Hello ${customerName},`,
		'',
		`Your order ${order.orderNumber} has been confirmed for ${eventTitle}.`,
		'',
		`Event date: ${eventDate}`,
		`Order total: ${total}`,
		'',
		'Tickets purchased:',
		lineItemLines,
		'',
		'Ticket numbers:',
		ticketNumberLines,
		ordersUrl ? '' : '',
		ordersUrl ? `View your order: ${ordersUrl}` : '',
		'',
		'Thank you for your purchase.'
	].filter(Boolean).join('\n');

	const html = `
		<p>Hello ${customerName},</p>
		<p>Your order <strong>${order.orderNumber}</strong> has been confirmed for <strong>${eventTitle}</strong>.</p>
		<p><strong>Event date:</strong> ${eventDate}<br /><strong>Order total:</strong> ${total}</p>
		<p><strong>Tickets purchased:</strong></p>
		<ul>${lineItems.length > 0 ? lineItems.map((item) => `<li>${item.ticketTypeName}: ${item.quantity} x ${formatMoney(Number(item.unitPrice || 0), String(order.currency || 'USD'))}</li>`).join('') : '<li>Tickets will appear in your account shortly</li>'}</ul>
		<p><strong>Ticket numbers:</strong></p>
		<ul>${ticketNumbers.length > 0 ? ticketNumbers.map((ticket: { ticketNumber: string; shortCode: string }) => `<li>${ticket.ticketNumber}${ticket.shortCode ? ` (check-in code: ${formatShortCode(ticket.shortCode)})` : ''}</li>`).join('') : '<li>Tickets available in your account</li>'}</ul>
		${ticketQrSections.length > 0 ? `<p><strong>QR codes:</strong></p>
		<div>${ticketQrSections.map((ticket) => `
			<div style="display:inline-block;margin:0 16px 16px 0;padding:12px;border:1px solid #e4ddd5;border-radius:12px;text-align:center;vertical-align:top;">
				<p style="margin:0 0 8px;font-weight:600;">${escapeHtml(ticket.ticketTypeName)}</p>
				<img src="${ticket.qrDataUrl}" alt="QR code for ticket ${escapeHtml(ticket.ticketNumber)}" width="180" height="180" style="display:block;margin:0 auto 8px;" />
				<p style="margin:0;font-size:14px;">${escapeHtml(ticket.ticketNumber)}</p>
				${ticket.shortCode ? `<p style="margin:4px 0 0;font-size:14px;">Check-in code: ${escapeHtml(formatShortCode(ticket.shortCode))}</p>` : ''}
			</div>`).join('')}</div>` : ''}
		${ordersUrl ? `<p><a href="${ordersUrl}">View your order</a></p>` : ''}
		<p>Thank you for your purchase.</p>
	`;

	return {
		subject: `Order confirmed: ${order.orderNumber}`,
		text,
		html
	};
};

export const sendOrderConfirmationEmailIfNeeded = async (orderId: number): Promise<void> => {
	if (!isEmailConfigured()) {
		console.warn('[Email] Skipping order confirmation email because email settings are not configured.');
		return;
	}

	const order = await db.Order.findByPk(orderId, {
		include: [
			{ model: db.User, as: 'user' },
			{ model: db.Event, as: 'event' },
			{ model: db.Ticket, as: 'tickets' }
		]
	});

	if (!order || order.status !== 'confirmed' || order.confirmationEmailSentAt) {
		return;
	}

	if (!order.user?.email) {
		console.warn(`[Email] Skipping order ${order.id} confirmation email because the user email is missing.`);
		return;
	}

	const { subject, text, html } = await buildOrderConfirmationEmail(order);
	await sendEmail({
		to: String(order.user.email),
		subject,
		text,
		html
	});

	await db.Order.update(
		{ confirmationEmailSentAt: new Date() },
		{
			where: {
				id: order.id,
				confirmationEmailSentAt: null
			}
		}
	);
	console.log(`[Email] Sent order confirmation email for order ${order.id}`);
};