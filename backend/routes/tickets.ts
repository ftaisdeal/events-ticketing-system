import express, { NextFunction, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';

import db from '../models';

const { Event, Order, Ticket, TicketCheckIn, TicketType, User, Venue, sequelize, Sequelize } = db;
const router = express.Router();

const jwtSecret = process.env.JWT_SECRET || 'dev-secret';

type AuthUser = {
	userId: number;
	email: string;
	role: string;
};

type AuthenticatedRequest = Request & {
	user?: AuthUser;
};

type TicketLookupContext = {
	ticket: any;
	event: any;
	order: any;
	checkIn: any | null;
};

const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
	try {
		const token = req.headers.authorization?.split(' ')[1];
		if (!token) {
			return res.status(401).json({ message: 'No token provided' });
		}

		const decoded = jwt.verify(token, jwtSecret) as AuthUser;
		req.user = decoded;
		next();
	} catch (_error) {
		return res.status(401).json({ message: 'Invalid token' });
	}
};

const requireStaffRole = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
	if (req.user?.role === 'admin' || req.user?.role === 'organizer') {
		next();
		return;
	}

	res.status(403).json({ message: 'Staff access is required' });
};

const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
	const errors = validationResult(req);
	if (!errors.isEmpty()) {
		return res.status(400).json({
			message: 'Invalid request',
			errors: errors.array()
		});
	}

	next();
};

const normalizeScanCode = (code: string): string => code.trim();

const buildEventWhereClause = (user: AuthUser, eventId?: number) => {
	const startOfToday = new Date();
	startOfToday.setHours(0, 0, 0, 0);

	const where: Record<string, unknown> = {
		status: 'published',
		startDateTime: {
			[Sequelize.Op.gte]: startOfToday
		}
	};

	if (eventId) {
		where.id = eventId;
	}

	if (user.role !== 'admin') {
		where.organizerId = user.userId;
	}

	return where;
};

const getEventForStaff = async (user: AuthUser, eventId: number) => {
	return Event.findOne({
		where: buildEventWhereClause(user, eventId),
		include: [{ model: Venue, as: 'venue' }]
	});
};

const findTicketByCode = async (code: string, transaction?: any) => {
	const normalizedCode = normalizeScanCode(code);
	const parsedTicketNumber = normalizedCode.startsWith('ticket:')
		? normalizedCode.slice('ticket:'.length)
		: normalizedCode;

	return Ticket.findOne({
		where: normalizedCode.startsWith('ticket:') || /^TKT-/i.test(normalizedCode)
			? { ticketNumber: parsedTicketNumber }
			: {
				[Sequelize.Op.or]: [
					{ qrCode: normalizedCode },
					{ ticketNumber: normalizedCode }
				]
			},
		include: [
			{
				model: Order,
				as: 'order',
				include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] }]
			},
			{
				model: TicketType,
				as: 'ticketType',
				include: [{ model: Event, as: 'event', include: [{ model: Venue, as: 'venue' }] }]
			},
			{
				model: TicketCheckIn,
				as: 'checkIn',
				include: [{ model: User, as: 'scannedBy', attributes: ['id', 'firstName', 'lastName', 'email'] }]
			}
		],
		transaction,
		lock: transaction ? transaction.LOCK.UPDATE : undefined
	});
};

const getEventStats = async (eventId: number) => {
	const totalIssued = await Ticket.count({
		include: [{
			model: TicketType,
			as: 'ticketType',
			where: { eventId }
		}]
	});

	const checkedInCount = await TicketCheckIn.count({
		where: { eventId }
	});

	return {
		totalIssued,
		checkedInCount,
		remainingCount: Math.max(0, totalIssued - checkedInCount)
	};
};

const serializeLookupResult = (result: string, context: TicketLookupContext | null, extra?: Record<string, unknown>) => {
	if (!context) {
		return {
			result,
			...extra
		};
	}

	const ticket = context.ticket;
	const order = context.order;
	const event = context.event;
	const checkIn = context.checkIn;

	return {
		result,
		ticket: {
			id: ticket.id,
			ticketNumber: ticket.ticketNumber,
			qrCode: ticket.qrCode,
			status: ticket.status,
			attendeeName: ticket.attendeeName,
			attendeeEmail: ticket.attendeeEmail,
			price: ticket.price
		},
		order: order ? {
			id: order.id,
			orderNumber: order.orderNumber,
			status: order.status,
			customer: order.user ? {
				id: order.user.id,
				firstName: order.user.firstName,
				lastName: order.user.lastName,
				email: order.user.email
			} : null
		} : null,
		event: event ? {
			id: event.id,
			title: event.title,
			slug: event.slug,
			startDateTime: event.startDateTime,
			venue: event.venue ? {
				id: event.venue.id,
				name: event.venue.name,
				city: event.venue.city,
				country: event.venue.country
			} : null
		} : null,
		ticketType: ticket.ticketType ? {
			id: ticket.ticketType.id,
			name: ticket.ticketType.name
		} : null,
		checkIn: checkIn ? {
			id: checkIn.id,
			scannedAt: checkIn.createdAt,
			source: checkIn.source,
			deviceId: checkIn.deviceId,
			scannedBy: checkIn.scannedBy ? {
				id: checkIn.scannedBy.id,
				firstName: checkIn.scannedBy.firstName,
				lastName: checkIn.scannedBy.lastName,
				email: checkIn.scannedBy.email
			} : null
		} : null,
		...extra
	};
};

const buildTicketContext = (ticket: any): TicketLookupContext => ({
	ticket,
	order: ticket.order || null,
	event: ticket.ticketType?.event || null,
	checkIn: ticket.checkIn || null
});

router.get('/check-in/events', authenticate, requireStaffRole, async (req: AuthenticatedRequest, res: Response) => {
	try {
		const user = req.user as AuthUser;
		const events = await Event.findAll({
			where: buildEventWhereClause(user),
			include: [{ model: Venue, as: 'venue' }],
			order: [['startDateTime', 'ASC']],
			limit: 1
		});

		const serializedEvents = await Promise.all(events.map(async (event: any) => {
			const stats = await getEventStats(event.id);
			return {
				id: event.id,
				title: event.title,
				slug: event.slug,
				status: event.status,
				startDateTime: event.startDateTime,
				endDateTime: event.endDateTime,
				venue: event.venue ? {
					id: event.venue.id,
					name: event.venue.name,
					city: event.venue.city,
					country: event.venue.country
				} : null,
				stats
			};
		}));

		return res.json({ events: serializedEvents });
	} catch (error) {
		console.error('List check-in events error:', error);
		return res.status(500).json({ message: 'Unable to load check-in events' });
	}
});

router.get(
	'/check-in/events/:eventId/summary',
	authenticate,
	requireStaffRole,
	[param('eventId').isInt({ min: 1 })],
	handleValidationErrors,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const eventId = Number(req.params.eventId);
			const event = await getEventForStaff(req.user as AuthUser, eventId);

			if (!event) {
				return res.status(404).json({ message: 'Event not found' });
			}

			const stats = await getEventStats(eventId);
			return res.json({
				event: {
					id: event.id,
					title: event.title,
					slug: event.slug,
					status: event.status,
					startDateTime: event.startDateTime,
					endDateTime: event.endDateTime
				},
				stats
			});
		} catch (error) {
			console.error('Check-in summary error:', error);
			return res.status(500).json({ message: 'Unable to load event summary' });
		}
	}
);

router.post(
	'/check-in/lookup',
	authenticate,
	requireStaffRole,
	[
		body('code').isString().trim().notEmpty(),
		body('eventId').optional().isInt({ min: 1 })
	],
	handleValidationErrors,
	async (req: AuthenticatedRequest, res: Response) => {
		try {
			const code = normalizeScanCode(String(req.body.code));
			const eventId = req.body.eventId ? Number(req.body.eventId) : undefined;

			const ticket = await findTicketByCode(code);
			if (!ticket) {
				return res.json(serializeLookupResult('not_found', null));
			}

			const context = buildTicketContext(ticket);
			const event = context.event;

			if (!event) {
				return res.json(serializeLookupResult('not_found', null));
			}

			const accessibleEvent = await getEventForStaff(req.user as AuthUser, event.id);
			if (!accessibleEvent) {
				return res.json(serializeLookupResult('forbidden_event', context));
			}

			if (eventId && event.id !== eventId) {
				return res.json(serializeLookupResult('wrong_event', context));
			}

			if (context.order?.status !== 'confirmed') {
				return res.json(serializeLookupResult('payment_not_confirmed', context));
			}

			if (ticket.status === 'cancelled') {
				return res.json(serializeLookupResult('ticket_cancelled', context));
			}

			if (context.checkIn) {
				return res.json(serializeLookupResult('already_checked_in', context));
			}

			return res.json(serializeLookupResult('valid', context));
		} catch (error) {
			console.error('Lookup ticket error:', error);
			return res.status(500).json({ message: 'Unable to lookup ticket' });
		}
	}
);

router.post(
	'/check-in/redeem',
	authenticate,
	requireStaffRole,
	[
		body('code').isString().trim().notEmpty(),
		body('eventId').optional().isInt({ min: 1 }),
		body('deviceId').optional().isString().trim().isLength({ max: 128 }),
		body('source').optional().isString().trim().isLength({ max: 32 }),
		body('notes').optional().isString().trim().isLength({ max: 255 })
	],
	handleValidationErrors,
	async (req: AuthenticatedRequest, res: Response) => {
		const transaction = await sequelize.transaction();

		try {
			const code = normalizeScanCode(String(req.body.code));
			const expectedEventId = req.body.eventId ? Number(req.body.eventId) : undefined;
			const deviceId = typeof req.body.deviceId === 'string' ? req.body.deviceId.trim() : undefined;
			const source = typeof req.body.source === 'string' && req.body.source.trim()
				? req.body.source.trim()
				: 'scanner';
			const notes = typeof req.body.notes === 'string' && req.body.notes.trim()
				? req.body.notes.trim()
				: undefined;

			const ticket = await findTicketByCode(code, transaction);
			if (!ticket) {
				await transaction.rollback();
				return res.json(serializeLookupResult('not_found', null));
			}

			const context = buildTicketContext(ticket);
			const event = context.event;

			if (!event) {
				await transaction.rollback();
				return res.json(serializeLookupResult('not_found', null));
			}

			const accessibleEvent = await getEventForStaff(req.user as AuthUser, event.id);
			if (!accessibleEvent) {
				await transaction.rollback();
				return res.json(serializeLookupResult('forbidden_event', context));
			}

			if (expectedEventId && expectedEventId !== event.id) {
				await transaction.rollback();
				return res.json(serializeLookupResult('wrong_event', context));
			}

			if (context.order?.status !== 'confirmed') {
				await transaction.rollback();
				return res.json(serializeLookupResult('payment_not_confirmed', context));
			}

			if (ticket.status === 'cancelled') {
				await transaction.rollback();
				return res.json(serializeLookupResult('ticket_cancelled', context));
			}

			if (context.checkIn) {
				await transaction.rollback();
				return res.json(serializeLookupResult('already_checked_in', context));
			}

			await TicketCheckIn.create({
				ticketId: ticket.id,
				eventId: event.id,
				scannedByUserId: req.user?.userId,
				source,
				deviceId,
				notes,
				metadata: {
					rawCode: code
				}
			}, { transaction });

			await ticket.update({ status: 'used' }, { transaction });
			await transaction.commit();

			const refreshedTicket = await findTicketByCode(code);
			return res.json(serializeLookupResult('admitted', refreshedTicket ? buildTicketContext(refreshedTicket) : context));
		} catch (error) {
			await transaction.rollback();
			console.error('Redeem ticket error:', error);
			return res.status(500).json({ message: 'Unable to redeem ticket' });
		}
	}
);

export default router;
