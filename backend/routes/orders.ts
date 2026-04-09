import crypto from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Transaction } from 'sequelize';

import db from '../models';
import { calculateGrossOrderPricing, PricingBreakdown, toCents } from '../utils/pricing';

const { Order, TicketType, Payment, sequelize, Sequelize } = db;
const router = express.Router();

const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
const reservationMinutes = Number(process.env.ORDER_RESERVATION_MINUTES || 5);

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

type AuthUser = {
	userId: number;
	email: string;
	role: string;
};

type AuthenticatedRequest = Request & {
	user?: AuthUser;
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

	const subtotal = Number(pricing.subtotal);
	const processingFee = Number(pricing.processingFee);
	const totalAmount = Number(pricing.totalAmount);
	if (![subtotal, processingFee, totalAmount].every(Number.isFinite)) {
		return null;
	}

	return {
		subtotal,
		processingFee,
		totalAmount,
		feePercent: Number(pricing.feePercent) || 0,
		feeFixed: Number(pricing.feeFixed) || 0,
		includesProcessingFee: Boolean(pricing.includesProcessingFee)
	};
};

const calculateSubtotalFromLineItems = (lineItems: LineItem[]) => {
	const subtotalInCents = lineItems.reduce(
		(sum, item) => sum + toCents(Number(item.unitPrice || 0)) * (Number(item.quantity) || 0),
		0
	);
	return subtotalInCents / 100;
};

const buildCustomerInfo = (lineItems: LineItem[], pricing: PricingBreakdown) => ({
	lineItems,
	pricing
});

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

const normalizeRequestedItems = (items: Array<{ ticketTypeId: number; quantity: number }>) => {
	const quantityByTicketType = new Map<number, number>();

	for (const item of items) {
		const ticketTypeId = Number(item.ticketTypeId) || 0;
		const quantity = Number(item.quantity) || 0;
		if (ticketTypeId < 1 || quantity < 1) {
			continue;
		}

		quantityByTicketType.set(ticketTypeId, (quantityByTicketType.get(ticketTypeId) || 0) + quantity);
	}

	return Array.from(quantityByTicketType.entries())
		.map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }))
		.sort((a, b) => a.ticketTypeId - b.ticketTypeId);
};

const normalizeOrderLineItems = (lineItems: LineItem[]) => {
	return lineItems
		.map((item) => ({
			ticketTypeId: Number(item.ticketTypeId) || 0,
			quantity: Number(item.quantity) || 0
		}))
		.filter((item) => item.ticketTypeId > 0 && item.quantity > 0)
		.sort((a, b) => a.ticketTypeId - b.ticketTypeId);
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

		const normalizedEventId = Number(eventId) || 0;
		if (normalizedEventId < 1) {
			await transaction.rollback();
			return res.status(400).json({ message: 'Invalid eventId' });
		}

		const requestedItemsSignature = JSON.stringify(normalizeRequestedItems(items));
		const existingPendingOrders = await Order.findAll({
			where: {
				userId,
				eventId: normalizedEventId,
				status: 'pending',
				expiresAt: {
					[Sequelize.Op.gt]: new Date()
				}
			},
			order: [['createdAt', 'DESC']],
			transaction,
			lock: transaction.LOCK.UPDATE
		});

		for (const existingOrder of existingPendingOrders) {
			const existingItemsSignature = JSON.stringify(normalizeOrderLineItems(parseLineItemsFromOrder(existingOrder)));
			if (existingItemsSignature !== requestedItemsSignature) {
				continue;
			}

			const existingLineItems = parseLineItemsFromOrder(existingOrder);
			const pricing = parsePricingFromOrder(existingOrder)
				|| calculateGrossOrderPricing(calculateSubtotalFromLineItems(existingLineItems));

			if (Number(existingOrder.totalAmount) !== pricing.totalAmount) {
				await existingOrder.update({
					totalAmount: pricing.totalAmount,
					customerInfo: buildCustomerInfo(existingLineItems, pricing)
				}, { transaction });
			}

			let payment = await Payment.findOne({
				where: {
					orderId: existingOrder.id,
					status: 'pending'
				},
				transaction,
				lock: transaction.LOCK.UPDATE
			});

			if (!payment) {
				payment = await Payment.create({
					orderId: existingOrder.id,
					amount: pricing.totalAmount,
					currency: String(existingOrder.currency || 'USD'),
					provider: 'stripe',
					status: 'pending',
					metadata: {
						lineItems: existingLineItems,
						pricing
					}
				}, { transaction });
			} else if (Number(payment.amount) !== pricing.totalAmount) {
				await payment.update({
					amount: pricing.totalAmount,
					metadata: {
						lineItems: existingLineItems,
						pricing
					}
				}, { transaction });
			}

			await transaction.commit();
			return res.status(200).json({
				order: existingOrder,
				payment,
				reservationExpiresAt: existingOrder.expiresAt,
				reusedReservation: true
			});
		}

		const lineItems: LineItem[] = [];
		let subtotalInCents = 0;

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

			if (Number(ticketType.eventId) !== normalizedEventId) {
				await transaction.rollback();
				return res.status(400).json({ message: `Ticket type ${item.ticketTypeId} does not belong to event ${normalizedEventId}` });
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
			subtotalInCents += toCents(unitPrice) * item.quantity;

			lineItems.push({
				ticketTypeId: Number(ticketType.id),
				quantity: item.quantity,
				unitPrice,
				eventId: normalizedEventId,
				ticketTypeName: String(ticketType.name)
			});
		}

		const pricing = calculateGrossOrderPricing(subtotalInCents / 100);

		const expiresAt = new Date(Date.now() + reservationMinutes * 60 * 1000);
		const order = await Order.create({
			orderNumber: generateOrderNumber(),
			userId,
			eventId: normalizedEventId,
			totalAmount: pricing.totalAmount,
			currency: 'USD',
			status: 'pending',
			expiresAt,
			customerInfo: buildCustomerInfo(lineItems, pricing)
		}, { transaction });

		const payment = await Payment.create({
			orderId: order.id,
			amount: pricing.totalAmount,
			currency: 'USD',
			provider: 'stripe',
			status: 'pending',
			metadata: {
				lineItems,
				pricing
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
			where: {
				userId,
				status: {
					[Sequelize.Op.in]: ['pending', 'confirmed']
				}
			},
			include: [{ model: Payment, as: 'payments' }],
			order: [['createdAt', 'DESC']]
		});

		return res.json({ orders });
	} catch (error) {
		console.error('Get my orders error:', error);
		return res.status(500).json({ message: 'Unable to fetch orders' });
	}
});

router.get('/:orderId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
	try {
		const userId = req.user?.userId;
		const orderId = Number(req.params.orderId);

		if (!userId) {
			return res.status(401).json({ message: 'Unauthorized' });
		}

		if (!orderId) {
			return res.status(400).json({ message: 'Invalid orderId' });
		}

		const order = await Order.findOne({
			where: {
				id: orderId,
				userId,
				status: {
					[Sequelize.Op.in]: ['pending', 'confirmed']
				}
			},
			include: [
				{ model: Payment, as: 'payments' },
				{ model: db.Event, as: 'event' },
				{
					model: db.Ticket,
					as: 'tickets',
					include: [{ model: db.TicketType, as: 'ticketType' }]
				}
			]
		});

		if (!order) {
			return res.status(404).json({ message: 'Order not found' });
		}

		return res.json({ order });
	} catch (error) {
		console.error('Get order detail error:', error);
		return res.status(500).json({ message: 'Unable to fetch order' });
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

router.post('/:orderId/expire', authenticate, async (req: AuthenticatedRequest, res: Response) => {
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
			return res.status(200).json({ message: 'Order already finalized', status: order.status });
		}

		await releaseReservedInventory(order, transaction);

		await order.update({
			status: 'expired',
			expiresAt: null
		}, { transaction });

		await Payment.update(
			{
				status: 'expired',
				failureReason: 'Reservation expired',
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
		return res.json({ message: 'Order expired and inventory released' });
	} catch (error) {
		await transaction.rollback();
		console.error('Expire order error:', error);
		return res.status(500).json({ message: 'Unable to expire order' });
	}
});

export default router;
