import fs from 'fs/promises';
import path from 'path';

import db from '../models';
import QRCode from 'qrcode';
import { isEmailConfigured, sendEmail } from './mailer';
import { generateOrderTicketsPdf } from './orderTicketsPdf';
import { PricingBreakdown } from './pricing';

type LineItem = {
	ticketTypeId: number;
	quantity: number;
	unitPrice: number;
	eventId: number;
	ticketTypeName: string;
};

type OrderCustomerInfo = {
	lineItems?: LineItem[];
	pricing?: PricingBreakdown;
};

const parseLineItemsFromOrder = (order: any): LineItem[] => {
	const customerInfo = order.customerInfo as OrderCustomerInfo | null;
	if (!customerInfo || !Array.isArray(customerInfo.lineItems)) {
		return [];
	}

	return customerInfo.lineItems;
};

const parsePricingFromOrder = (order: any): PricingBreakdown | null => {
	const customerInfo = order.customerInfo as OrderCustomerInfo | null;
	const pricing = customerInfo?.pricing;
	if (!pricing) {
		return null;
	}

	return {
		subtotal: Number(pricing.subtotal) || 0,
		processingFee: Number(pricing.processingFee) || 0,
		totalAmount: Number(pricing.totalAmount) || 0,
		feePercent: Number(pricing.feePercent) || 0,
		feeFixed: Number(pricing.feeFixed) || 0,
		includesProcessingFee: Boolean(pricing.includesProcessingFee)
	};
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

const getVenueAddressLine = (venue: any) => {
	if (!venue) {
		return '';
	}

	const statePostalParts = [venue.state, venue.postalCode].filter(Boolean).join(' ');
	return [venue.address, statePostalParts].filter(Boolean).join(', ');
};

const brandingLogoCid = 'rdx-branding-logo';

const readBrandingLogo = async () => {
	const candidatePaths = [
		path.resolve(process.cwd(), '../frontend/public/img/RDX.png'),
		path.resolve(process.cwd(), 'frontend/public/img/RDX.png'),
		path.resolve(__dirname, '../../frontend/public/img/RDX.png'),
		path.resolve(__dirname, '../../../frontend/public/img/RDX.png')
	];

	for (const candidatePath of candidatePaths) {
		try {
			return await fs.readFile(candidatePath);
		} catch (_error) {
			// Try the next location.
		}
	}

	return null;
};

const resolveTimeZone = (value: unknown): string => {
	const candidate = typeof value === 'string' && value.trim() ? value.trim() : 'UTC';

	try {
		Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
		return candidate;
	} catch (_error) {
		return 'UTC';
	}
};

const formatEventDateTime = (value: unknown, timeZone: string) => {
	if (!value) {
		return 'TBD';
	}

	return new Intl.DateTimeFormat('en-US', {
		timeZone,
		weekday: 'long',
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		hour: 'numeric',
		minute: '2-digit',
		timeZoneName: 'short'
	}).format(new Date(String(value)));
};

const buildOrderConfirmationEmail = async (order: any) => {
	const publicFrontendUrl = process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL;
	const lineItems = parseLineItemsFromOrder(order);
	const eventTitle = order.event?.title || 'Your event';
	const eventTimeZone = resolveTimeZone(order.event?.timezone);
	const eventDate = formatEventDateTime(order.event?.startDateTime, eventTimeZone);
	const venueName = String(order.event?.venue?.name || '');
	const venueAddressLine = getVenueAddressLine(order.event?.venue);
	const customerName = [order.user?.firstName, order.user?.lastName].filter(Boolean).join(' ') || 'Customer';
	const pricing = parsePricingFromOrder(order);
	const subtotal = pricing ? formatMoney(Number(pricing.subtotal || 0), String(order.currency || 'USD')) : null;
	const stripeProcessingFee = pricing ? formatMoney(Number(pricing.processingFee || 0), String(order.currency || 'USD')) : null;
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
	const brandingLogo = await readBrandingLogo();
	const brandingImageHtml = brandingLogo
		? `<p style="margin:24px 0 72px;text-align:left;">${ordersUrl ? `<a href="${ordersUrl}" style="display:inline-block;">` : ''}<img src="cid:${brandingLogoCid}" alt="RDX Theater" style="display:block;max-width:220px;width:100%;height:auto;" />${ordersUrl ? '</a>' : ''}</p>`
		: '';
	const pdfAttachmentHtml = '<p><strong>Order PDF:</strong> Attached to this email for offline access.</p>';
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
		venueName ? `Venue: ${venueName}` : '',
		venueAddressLine ? `Address: ${venueAddressLine}` : '',
		subtotal ? `Subtotal: ${subtotal}` : '',
		stripeProcessingFee ? `Stripe processing fee: ${stripeProcessingFee}` : '',
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
		<p><strong>Event date:</strong> ${eventDate}${venueName ? `<br /><strong>Venue:</strong> ${escapeHtml(venueName)}` : ''}${venueAddressLine ? `<br /><strong>Address:</strong> ${escapeHtml(venueAddressLine)}` : ''}${subtotal ? `<br /><strong>Subtotal:</strong> ${subtotal}` : ''}${stripeProcessingFee ? `<br /><strong>Stripe processing fee:</strong> ${stripeProcessingFee}` : ''}<br /><strong>Order total:</strong> ${total}</p>
		<p><strong>Tickets purchased:</strong></p>
		<ul>${lineItems.length > 0 ? lineItems.map((item) => `<li>${item.ticketTypeName}: ${item.quantity} x ${formatMoney(Number(item.unitPrice || 0), String(order.currency || 'USD'))}</li>`).join('') : '<li>Tickets will appear in your account shortly</li>'}</ul>
		<p><strong>Ticket numbers:</strong></p>
		<ul>${ticketNumbers.length > 0 ? ticketNumbers.map((ticket: { ticketNumber: string; shortCode: string }) => `<li>${ticket.ticketNumber}${ticket.shortCode ? ` (check-in code: ${formatShortCode(ticket.shortCode)})` : ''}</li>`).join('') : '<li>Tickets available in your account</li>'}</ul>
		${ticketQrSections.length > 0 ? `<div>${ticketQrSections.map((ticket) => `
			<div style="display:inline-block;margin:0 16px 16px 0;padding:12px;border:1px solid #e4ddd5;border-radius:12px;text-align:center;vertical-align:top;">
				<p style="margin:0 0 8px;font-weight:600;">${escapeHtml(ticket.ticketTypeName)}</p>
				<img src="${ticket.qrDataUrl}" alt="QR code for ticket ${escapeHtml(ticket.ticketNumber)}" width="180" height="180" style="display:block;margin:0 auto 8px;" />
				<p style="margin:0;font-size:14px;">${escapeHtml(ticket.ticketNumber)}</p>
				${ticket.shortCode ? `<p style="margin:4px 0 0;font-size:14px;">Check-in code: ${escapeHtml(formatShortCode(ticket.shortCode))}</p>` : ''}
			</div>`).join('')}</div>` : ''}
		${pdfAttachmentHtml}
		${ordersUrl ? `<p><a href="${ordersUrl}">View your order</a></p>` : ''}
		<p>Thank you for your purchase.</p>
	` + brandingImageHtml;

	return {
		subject: `RDX Theater ticket order confirmed: ${order.orderNumber}`,
		text,
		html,
		attachments: brandingLogo ? [{
			filename: 'RDX.png',
			content: brandingLogo,
			contentType: 'image/png',
			cid: brandingLogoCid,
			contentDisposition: 'inline'
		}] : []
	};
};

export const sendOrderConfirmationEmailIfNeeded = async (orderId: number): Promise<void> => {
	if (!isEmailConfigured()) {
		console.warn('[Email] Skipping order confirmation email because email settings are not configured.');
		return;
	}

	const [claimedRows] = await db.Order.update(
		{ confirmationEmailSentAt: new Date() },
		{
			where: {
				id: orderId,
				status: 'confirmed',
				confirmationEmailSentAt: null
			}
		}
	);

	if (claimedRows === 0) {
		return;
	}

	const order = await db.Order.findByPk(orderId, {
		include: [
			{ model: db.User, as: 'user' },
			{
				model: db.Event,
				as: 'event',
				include: [
					{ model: db.Venue, as: 'venue' }
				]
			},
			{
				model: db.Ticket,
				as: 'tickets',
				include: [
					{ model: db.TicketType, as: 'ticketType' }
				]
			}
		]
	});

	if (!order || order.status !== 'confirmed') {
		return;
	}

	if (!order.user?.email) {
		console.warn(`[Email] Skipping order ${order.id} confirmation email because the user email is missing.`);
		await db.Order.update({ confirmationEmailSentAt: null }, { where: { id: order.id } });
		return;
	}

	try {
		const { subject, text, html, attachments: inlineAttachments } = await buildOrderConfirmationEmail(order);
		const ticketsPdf = await generateOrderTicketsPdf(order);
		await sendEmail({
			to: String(order.user.email),
			subject,
			text,
			html,
			attachments: [ticketsPdf, ...inlineAttachments]
		});
		console.log(`[Email] Sent order confirmation email for order ${order.id}`);
	} catch (error) {
		await db.Order.update({ confirmationEmailSentAt: null }, { where: { id: order.id } });
		throw error;
	}
};