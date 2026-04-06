import crypto from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { Transaction } from 'sequelize';

import db from '../models';

const { Order, Payment, Ticket, TicketType, sequelize } = db;
const router = express.Router();

const jwtSecret = process.env.JWT_SECRET || 'dev-secret';
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const stripe = stripeSecretKey
	? new Stripe(stripeSecretKey, {
			apiVersion: '2023-08-16'
		})
	: null;

type AuthUser = {
	userId: number;
	email: string;
	role: string;
};

type AuthenticatedRequest = Request & {
	user?: AuthUser;
};

type LineItem = {
	ticketTypeId: number;
	quantity: number;
	unitPrice: number;
	eventId: number;
	ticketTypeName: string;
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

const parseLineItemsFromOrder = (order: any): LineItem[] => {
	const customerInfo = order.customerInfo as { lineItems?: LineItem[] } | null;
	if (!customerInfo || !Array.isArray(customerInfo.lineItems)) {
		return [];
	}
	return customerInfo.lineItems;
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

const generateTicketNumber = () => {
	const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
	return `TKT-${Date.now()}-${suffix}`;
};

const markOrderAsCancelled = async (order: any, reason: string, status: 'cancelled' | 'expired' | 'failed' = 'cancelled') => {
	const transaction = await sequelize.transaction();

	try {
		const lockedOrder = await Order.findByPk(order.id, {
			transaction,
			lock: transaction.LOCK.UPDATE
		});

		if (!lockedOrder || lockedOrder.status !== 'pending') {
			await transaction.rollback();
			return;
		}

		await releaseReservedInventory(lockedOrder, transaction);
		await lockedOrder.update({ status, expiresAt: null }, { transaction });

		await Payment.update(
			{
				status,
				failureReason: reason,
				processedAt: new Date()
			},
			{
				where: {
					orderId: lockedOrder.id,
					status: 'pending'
				},
				transaction
			}
		);

		await transaction.commit();
	} catch (error) {
		await transaction.rollback();
		throw error;
	}
};

router.post('/create-intent', authenticate, async (req: AuthenticatedRequest, res: Response) => {
	try {
		if (!stripe) {
			return res.status(503).json({ message: 'Stripe is not configured. Add STRIPE_SECRET_KEY.' });
		}

		const userId = req.user?.userId;
		const { orderId } = req.body as { orderId?: number };

		if (!userId || !orderId) {
			return res.status(400).json({ message: 'orderId is required' });
		}

		const order = await Order.findByPk(orderId);
		if (!order || order.userId !== userId) {
			return res.status(404).json({ message: 'Order not found' });
		}

		if (order.status !== 'pending') {
			return res.status(400).json({ message: 'Payment can only be created for pending orders' });
		}

		if (order.expiresAt && new Date(order.expiresAt).getTime() < Date.now()) {
			await markOrderAsCancelled(order, 'Reservation expired before payment intent creation', 'expired');
			return res.status(410).json({ message: 'Reservation expired' });
		}

		const amountInCents = Math.round(Number(order.totalAmount) * 100);
		const paymentIntent = await stripe.paymentIntents.create({
			amount: amountInCents,
			currency: String(order.currency || 'usd').toLowerCase(),
			metadata: {
				orderId: String(order.id),
				userId: String(userId)
			}
		});

		const [payment] = await Payment.findOrCreate({
			where: { orderId: order.id },
			defaults: {
				orderId: order.id,
				amount: Number(order.totalAmount),
				currency: String(order.currency || 'USD').toUpperCase(),
				provider: 'stripe',
				status: 'pending',
				metadata: {
					lineItems: parseLineItemsFromOrder(order)
				}
			}
		});

		await payment.update({
			paymentIntentId: paymentIntent.id,
			status: 'pending'
		});

		return res.json({
			clientSecret: paymentIntent.client_secret,
			paymentIntentId: paymentIntent.id,
			orderId: order.id
		});
	} catch (error) {
		console.error('Create payment intent error:', error);
		return res.status(500).json({ message: 'Unable to create payment intent' });
	}
});

router.post('/webhook', async (req: Request, res: Response) => {
	try {
		let event: Stripe.Event;

		if (stripe && stripeWebhookSecret) {
			const signature = req.headers['stripe-signature'];
			if (!signature || typeof signature !== 'string') {
				return res.status(400).send('Missing stripe-signature header');
			}

			event = stripe.webhooks.constructEvent(
				req.body as Buffer,
				signature,
				stripeWebhookSecret
			);
		} else {
			event = req.body as Stripe.Event;
		}

		if (event.type === 'payment_intent.succeeded') {
			const intent = event.data.object as Stripe.PaymentIntent;
			const transaction = await sequelize.transaction();

			try {
				const payment = await Payment.findOne({
					where: { paymentIntentId: intent.id },
					transaction,
					lock: transaction.LOCK.UPDATE
				});

				if (!payment) {
					await transaction.rollback();
					return res.status(200).json({ received: true, ignored: 'payment not found' });
				}

				if (payment.status === 'succeeded') {
					await transaction.rollback();
					return res.status(200).json({ received: true, ignored: 'already processed' });
				}

				const order = await Order.findByPk(payment.orderId, {
					transaction,
					lock: transaction.LOCK.UPDATE
				});

				if (!order) {
					await transaction.rollback();
					return res.status(200).json({ received: true, ignored: 'order not found' });
				}

				if (order.expiresAt && new Date(order.expiresAt).getTime() < Date.now()) {
					await transaction.rollback();
				await markOrderAsCancelled(order, 'Reservation expired before webhook confirmation', 'expired');
					return res.status(200).json({ received: true, ignored: 'reservation expired' });
				}

				const lineItems = parseLineItemsFromOrder(order);

				await payment.update({
					status: 'succeeded',
					transactionId: intent.latest_charge ? String(intent.latest_charge) : intent.id,
					processedAt: new Date(),
					failureReason: null
				}, { transaction });

				await order.update({
					status: 'confirmed',
					confirmedAt: new Date(),
					expiresAt: null
				}, { transaction });

				for (const lineItem of lineItems) {
					for (let i = 0; i < lineItem.quantity; i += 1) {
						const ticketNumber = generateTicketNumber();
						await Ticket.create({
							ticketNumber,
							orderId: order.id,
							ticketTypeId: lineItem.ticketTypeId,
							price: lineItem.unitPrice,
							status: 'valid',
							qrCode: `ticket:${ticketNumber}`
						}, { transaction });
					}
				}

				await transaction.commit();
			} catch (error) {
				await transaction.rollback();
				throw error;
			}
		}

		if (event.type === 'payment_intent.payment_failed' || event.type === 'payment_intent.canceled') {
			const intent = event.data.object as Stripe.PaymentIntent;
			const payment = await Payment.findOne({ where: { paymentIntentId: intent.id } });

			if (payment) {
				const order = await Order.findByPk(payment.orderId);

				await payment.update({
					status: event.type === 'payment_intent.canceled' ? 'cancelled' : 'failed',
					failureReason: intent.last_payment_error?.message || 'Payment failed',
					processedAt: new Date()
				});

				if (order && order.status === 'pending') {
					await markOrderAsCancelled(order, 'Payment failed or cancelled', 'failed');
				}
			}
		}

		return res.status(200).json({ received: true });
	} catch (error) {
		console.error('Stripe webhook error:', error);
		return res.status(400).send('Webhook error');
	}
});

router.post('/expire-reservations', async (_req: Request, res: Response) => {
	try {
		const expiredOrders = await Order.findAll({
			where: {
				status: 'pending',
				expiresAt: {
					[db.Sequelize.Op.lt]: new Date()
				}
			}
		});

		for (const order of expiredOrders) {
			await markOrderAsCancelled(order, 'Reservation expired', 'expired');
		}

		return res.json({
			message: 'Expired reservations processed',
			expiredCount: expiredOrders.length
		});
	} catch (error) {
		console.error('Expire reservations error:', error);
		return res.status(500).json({ message: 'Unable to expire reservations' });
	}
});

export default router;
