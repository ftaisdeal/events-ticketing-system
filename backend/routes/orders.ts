import crypto from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Transaction } from 'sequelize';

import db from '../models';

const { Order, TicketType, Payment, sequelize, Sequelize } = db;
const router = express.Router();

const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
const reservationMinutes = Number(process.env.ORDER_RESERVATION_MINUTES || 15);

type LineItem = {
	ticketTypeId: number;
	quantity: number;
	unitPrice: number;
	eventId: number;
	ticketTypeName: string;
};

type AuthUser = {
	userId: number;
	email: string;
	role: string;
};

type AuthenticatedRequest = Request & {
	user?: AuthUser;
};

const parseLineItemsFromOrder = (order: any): LineItem[] => {
	const customerInfo = order.customerInfo as { lineItems?: LineItem[] } | null;
	if (!customerInfo || !Array.isArray(customerInfo.lineItems)) {
		return [];
	}
	return customerInfo.lineItems;
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

const releaseReservedInventory = async (order: any, transaction: Transaction) => {
	const lineItems = parseLineItemsFromOrder(order);

	for (const item of lineItems) {
		const ticketType = await TicketType.findByPk(item.ticketTypeId, {
			transaction,
			lock: transaction.LOCK.UPDATE
		});

		if (!ticketType) {
			continue;
		}

		const currentSold = Number(ticketType.quantitySold || 0);
		const nextSold = Math.max(0, currentSold - item.quantity);
		await ticketType.update({ quantitySold: nextSold }, { transaction });
	}
};

const generateOrderNumber = () => {
	const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
	return `ORD-${Date.now()}-${suffix}`;
};

router.post('/reserve', authenticate, async (req: AuthenticatedRequest, res: Response) => {
	const transaction = await sequelize.transaction();

	try {
		const userId = req.user?.userId;
		const { items, eventId } = req.body as {
			eventId?: number;
			items?: Array<{ ticketTypeId: number; quantity: number }>;
		};

		if (!userId) {
			await transaction.rollback();
			return res.status(401).json({ message: 'Unauthorized' });
		}

		if (!eventId || !Array.isArray(items) || items.length === 0) {
			await transaction.rollback();
			return res.status(400).json({ message: 'eventId and at least one ticket item are required' });
		}

		const lineItems: LineItem[] = [];
		let totalAmount = 0;

		for (const item of items) {
			if (!item.ticketTypeId || !item.quantity || item.quantity < 1) {
				await transaction.rollback();
				return res.status(400).json({ message: 'Each item requires ticketTypeId and quantity >= 1' });
			}

			const ticketType = await TicketType.findByPk(item.ticketTypeId, {
				transaction,
				lock: transaction.LOCK.UPDATE
			});

			if (!ticketType || !ticketType.isActive) {
				await transaction.rollback();
				return res.status(404).json({ message: `Ticket type ${item.ticketTypeId} not found or inactive` });
			}

			if (Number(ticketType.eventId) !== Number(eventId)) {
				await transaction.rollback();
				return res.status(400).json({ message: `Ticket type ${item.ticketTypeId} does not belong to event ${eventId}` });
			}

			const available = Number(ticketType.quantity) - Number(ticketType.quantitySold || 0);
			if (available < item.quantity) {
				await transaction.rollback();
				return res.status(409).json({
					message: `Insufficient inventory for ${ticketType.name}`,
					available
				});
			}

			await ticketType.update({
				quantitySold: Number(ticketType.quantitySold || 0) + item.quantity
			}, { transaction });

			const unitPrice = Number(ticketType.price);
			totalAmount += unitPrice * item.quantity;

			lineItems.push({
				ticketTypeId: Number(ticketType.id),
				quantity: item.quantity,
				unitPrice,
				eventId: Number(eventId),
				ticketTypeName: String(ticketType.name)
			});
		}

		const expiresAt = new Date(Date.now() + reservationMinutes * 60 * 1000);
		const order = await Order.create({
			orderNumber: generateOrderNumber(),
			userId,
			eventId,
			totalAmount,
			currency: 'USD',
			status: 'pending',
			expiresAt,
			customerInfo: {
				lineItems
			}
		}, { transaction });

		const payment = await Payment.create({
			orderId: order.id,
			amount: totalAmount,
			currency: 'USD',
			provider: 'stripe',
			status: 'pending',
			metadata: {
				lineItems
			}
		}, { transaction });

		await transaction.commit();

		return res.status(201).json({
			order,
			payment,
			reservationExpiresAt: expiresAt
		});
	} catch (error) {
		await transaction.rollback();
		console.error('Reserve order error:', error);
		return res.status(500).json({ message: 'Unable to reserve tickets' });
	}
});

router.get('/my', authenticate, async (req: AuthenticatedRequest, res: Response) => {
	try {
		const userId = req.user?.userId;

		if (!userId) {
			return res.status(401).json({ message: 'Unauthorized' });
		}

		const orders = await Order.findAll({
			where: { userId },
			include: [{ model: Payment, as: 'payments' }],
			order: [['createdAt', 'DESC']]
		});

		return res.json({ orders });
	} catch (error) {
		console.error('Get my orders error:', error);
		return res.status(500).json({ message: 'Unable to fetch orders' });
	}
});

router.post('/:orderId/cancel', authenticate, async (req: AuthenticatedRequest, res: Response) => {
	const transaction = await sequelize.transaction();

	try {
		const userId = req.user?.userId;
		const orderId = Number(req.params.orderId);

		const order = await Order.findByPk(orderId, {
			transaction,
			lock: transaction.LOCK.UPDATE
		});

		if (!order) {
			await transaction.rollback();
			return res.status(404).json({ message: 'Order not found' });
		}

		if (order.userId !== userId) {
			await transaction.rollback();
			return res.status(403).json({ message: 'Forbidden' });
		}

		if (order.status !== 'pending') {
			await transaction.rollback();
			return res.status(400).json({ message: 'Only pending orders can be cancelled' });
		}

		await releaseReservedInventory(order, transaction);

		await order.update({
			status: 'cancelled',
			expiresAt: null
		}, { transaction });

		await Payment.update(
			{
				status: 'cancelled',
				failureReason: 'Cancelled by user',
				processedAt: new Date()
			},
			{
				where: {
					orderId,
					status: { [Sequelize.Op.ne]: 'succeeded' }
				},
				transaction
			}
		);

		await transaction.commit();
		return res.json({ message: 'Order cancelled and inventory released' });
	} catch (error) {
		await transaction.rollback();
		console.error('Cancel order error:', error);
		return res.status(500).json({ message: 'Unable to cancel order' });
	}
});

export default router;
