import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

type LineItem = {
	ticketTypeId: number;
	quantity: number;
	unitPrice: number;
	eventId: number;
	ticketTypeName: string;
};

type TicketSummary = {
	ticketNumber: string;
	shortCode: string;
	qrCode: string;
	ticketTypeName: string;
	attendeeName?: string;
	attendeeEmail?: string;
	qrImage: Buffer;
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

const getVenueAddressLine = (venue: any) => {
	if (!venue) {
		return '';
	}

	const statePostalParts = [venue.state, venue.postalCode].filter(Boolean).join(' ');
	return [venue.address, statePostalParts].filter(Boolean).join(', ');
};

const sanitizeFilename = (value: string) => {
	return value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-');
};

const collectTicketSummaries = async (order: any): Promise<TicketSummary[]> => {
	if (!Array.isArray(order.tickets)) {
		return [];
	}

	const tickets = await Promise.all(order.tickets.map(async (ticket: any) => {
		const qrCode = String(ticket.qrCode || `ticket:${ticket.ticketNumber}`);
		return {
			ticketNumber: String(ticket.ticketNumber),
			shortCode: String(ticket.shortCode || ''),
			qrCode,
			ticketTypeName: String(ticket.ticketType?.name || 'Ticket'),
			attendeeName: ticket.attendeeName ? String(ticket.attendeeName) : undefined,
			attendeeEmail: ticket.attendeeEmail ? String(ticket.attendeeEmail) : undefined,
			qrImage: await QRCode.toBuffer(qrCode, {
				margin: 1,
				width: 512
			})
		};
	}));

	return tickets.filter((ticket: TicketSummary) => Boolean(ticket.ticketNumber));
};

const renderSummaryPage = (doc: PDFKit.PDFDocument, order: any, lineItems: LineItem[], tickets: TicketSummary[]) => {
	const eventTitle = order.event?.title || 'Your event';
	const eventTimeZone = resolveTimeZone(order.event?.timezone);
	const eventDate = formatEventDateTime(order.event?.startDateTime, eventTimeZone);
	const venueName = String(order.event?.venue?.name || '');
	const venueAddressLine = getVenueAddressLine(order.event?.venue);
	const customerName = [order.user?.firstName, order.user?.lastName].filter(Boolean).join(' ') || 'Customer';
	const total = formatMoney(Number(order.totalAmount || 0), String(order.currency || 'USD'));

	doc.fontSize(24).font('Helvetica-Bold').text('RDX Theater Tickets');
	doc.moveDown(0.5);
	doc.fontSize(12).font('Helvetica').text(`Order: ${order.orderNumber}`);
	doc.text(`Customer: ${customerName}`);
	doc.text(`Event: ${eventTitle}`);
	doc.text(`Date: ${eventDate}`);
	if (venueName) {
		doc.text(`Venue: ${venueName}`);
	}
	if (venueAddressLine) {
		doc.text(`Address: ${venueAddressLine}`);
	}
	doc.text(`Total: ${total}`);

	doc.moveDown();
	doc.fontSize(15).font('Helvetica-Bold').text('Order summary');
	doc.moveDown(0.5);
	doc.fontSize(12).font('Helvetica');

	if (lineItems.length === 0) {
		doc.text('Tickets will appear in your account shortly.');
		return;
	}

	for (const item of lineItems) {
		doc.text(`${item.ticketTypeName}: ${item.quantity} x ${formatMoney(Number(item.unitPrice || 0), String(order.currency || 'USD'))}`);
	}

	doc.moveDown();
	if (tickets.length > 0) {
		doc.fontSize(15).font('Helvetica-Bold').text('Ticket QR codes');
		doc.moveDown(0.5);
		const previewTickets = tickets.slice(0, 4);
		previewTickets.forEach((ticket, index) => {
			const column = index % 2;
			const row = Math.floor(index / 2);
			const x = 70 + (column * 240);
			const y = 320 + (row * 170);

			doc.image(ticket.qrImage, x, y, {
				fit: [110, 110]
			});
			doc.font('Helvetica-Bold').fontSize(11).text(ticket.ticketTypeName, x, y + 118, {
				width: 140,
				align: 'left'
			});
			doc.font('Helvetica').fontSize(10).text(ticket.ticketNumber, x, y + 134, {
				width: 150,
				align: 'left'
			});
			if (ticket.shortCode) {
				doc.text(`Code: ${formatShortCode(ticket.shortCode)}`, x, y + 148, {
					width: 150,
					align: 'left'
				});
			}
		});

		if (tickets.length > previewTickets.length) {
			doc.font('Helvetica').fontSize(10).fillColor('#555555').text(`Showing the first ${previewTickets.length} QR codes on this page. Additional tickets appear on later pages.`, 70, 665, {
				width: doc.page.width - 140,
				align: 'left'
			});
			doc.fillColor('black');
		}
	}

	doc.moveDown();
	doc.fillColor('#555555').fontSize(10).text('Present the following pages at entry. Each ticket includes a QR code and short check-in code.', {
		align: 'left'
	});
	doc.fillColor('black');
};

const renderTicketPage = (doc: PDFKit.PDFDocument, order: any, ticket: TicketSummary, ticketIndex: number, ticketCount: number) => {
	const eventTitle = order.event?.title || 'Your event';
	const eventTimeZone = resolveTimeZone(order.event?.timezone);
	const eventDate = formatEventDateTime(order.event?.startDateTime, eventTimeZone);
	const venueName = String(order.event?.venue?.name || '');
	const venueAddressLine = getVenueAddressLine(order.event?.venue);

	doc.addPage();
	doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80).lineWidth(1).strokeColor('#d1c6b8').stroke();
	doc.fillColor('black');
	doc.font('Helvetica-Bold').fontSize(22).text(eventTitle, 60, 60, {
		width: doc.page.width - 120,
		align: 'center'
	});
	doc.moveDown(0.5);
	doc.font('Helvetica').fontSize(12).text(eventDate, {
		align: 'center'
	});
	if (venueName || venueAddressLine) {
		doc.moveDown(0.25);
		doc.text([venueName, venueAddressLine].filter(Boolean).join(' | '), {
			align: 'center'
		});
	}

	doc.image(ticket.qrImage, (doc.page.width - 220) / 2, 150, {
		fit: [220, 220],
		align: 'center'
	});

	doc.font('Helvetica-Bold').fontSize(16).text(ticket.ticketTypeName, 60, 400, {
		width: doc.page.width - 120,
		align: 'center'
	});
	doc.moveDown(0.5);
	doc.font('Helvetica').fontSize(12).text(`Ticket number: ${ticket.ticketNumber}`, {
		align: 'center'
	});
	if (ticket.shortCode) {
		doc.text(`Check-in code: ${formatShortCode(ticket.shortCode)}`, {
			align: 'center'
		});
	}
	if (ticket.attendeeName) {
		doc.text(`Attendee: ${ticket.attendeeName}`, {
			align: 'center'
		});
	}
	if (ticket.attendeeEmail) {
		doc.text(`Email: ${ticket.attendeeEmail}`, {
			align: 'center'
		});
	}

	doc.moveDown(1.5);
	doc.fontSize(10).fillColor('#555555').text(`Order ${order.orderNumber} | Ticket ${ticketIndex + 1} of ${ticketCount}`, {
		align: 'center'
	});
	doc.moveDown(0.5);
	doc.text('Please keep this PDF available on your phone or bring a printed copy to the event.', {
		align: 'center'
	});
	doc.fillColor('black');
};

export const generateOrderTicketsPdf = async (order: any): Promise<{
	filename: string;
	content: Buffer;
	contentType: string;
}> => {
	const lineItems = parseLineItemsFromOrder(order);
	const tickets = await collectTicketSummaries(order);
	const filename = `${sanitizeFilename(String(order.orderNumber || `order-${order.id}`))}-tickets.pdf`;

	const doc = new PDFDocument({
		autoFirstPage: true,
		margin: 50,
		size: 'LETTER',
		info: {
			Title: `Tickets for order ${order.orderNumber}`,
			Author: 'RDX Theater'
		}
	});

	const chunks: Buffer[] = [];

	const pdfBufferPromise = new Promise<Buffer>((resolve, reject) => {
		doc.on('data', (chunk: Buffer) => {
			chunks.push(chunk);
		});
		doc.on('end', () => {
			resolve(Buffer.concat(chunks));
		});
		doc.on('error', reject);
	});

	renderSummaryPage(doc, order, lineItems, tickets);

	for (let index = 0; index < tickets.length; index += 1) {
		renderTicketPage(doc, order, tickets[index], index, tickets.length);
	}

	doc.end();

	return {
		filename,
		content: await pdfBufferPromise,
		contentType: 'application/pdf'
	};
};