import crypto from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { Transaction } from 'sequelize';

import db from '../models';
import { sendOrderConfirmationEmailIfNeeded } from '../utils/orderConfirmationEmail';
import { PricingBreakdown } from '../utils/pricing';

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

type OrderCustomerInfo = {
	lineItems?: LineItem[];
	pricing?: PricingBreakdown;
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

const shortCodeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const createRandomShortCode = () => {
	let code = '';
	for (let index = 0; index < 8; index += 1) {
		const nextIndex = crypto.randomInt(0, shortCodeAlphabet.length);
		code += shortCodeAlphabet[nextIndex];
	}
	return code;
};

const generateTicketShortCode = async (transaction: Transaction) => {
	for (let attempt = 0; attempt < 10; attempt += 1) {
		const shortCode = createRandomShortCode();
		const existingTicket = await Ticket.findOne({
			where: { shortCode },
			transaction,
			lock: transaction.LOCK.UPDATE
		});

		if (!existingTicket) {
			return shortCode;
		}
	}

	throw new Error('Unable to generate a unique ticket short code');
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

const finalizeSucceededPaymentIntent = async (intent: Stripe.PaymentIntent) => {
	const transaction = await sequelize.transaction();
	let confirmedOrderId: number | null = null;

	try {
		const payment = await Payment.findOne({
			where: { paymentIntentId: intent.id },
			transaction,
			lock: transaction.LOCK.UPDATE
		});

		if (!payment) {
			await transaction.rollback();
			return { outcome: 'payment_not_found' as const };
		}

		if (payment.status === 'succeeded') {
			await transaction.rollback();
			await sendOrderConfirmationEmailIfNeeded(payment.orderId).catch((error) => {
				console.error('Order confirmation email error:', error);
			});
			return {
				outcome: 'already_processed' as const,
				orderId: payment.orderId
			};
		}

		const order = await Order.findByPk(payment.orderId, {
			transaction,
			lock: transaction.LOCK.UPDATE
		});

		if (!order) {
			await transaction.rollback();
			return { outcome: 'order_not_found' as const };
		}

		if (order.expiresAt && new Date(order.expiresAt).getTime() < Date.now()) {
			await transaction.rollback();
			await markOrderAsCancelled(order, 'Reservation expired before webhook confirmation', 'expired');
			return {
				outcome: 'reservation_expired' as const,
				orderId: order.id
			};
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
		confirmedOrderId = order.id;

		for (const lineItem of lineItems) {
			for (let i = 0; i < lineItem.quantity; i += 1) {
				const ticketNumber = generateTicketNumber();
				const shortCode = await generateTicketShortCode(transaction);
				await Ticket.create({
					ticketNumber,
					shortCode,
					orderId: order.id,
					ticketTypeId: lineItem.ticketTypeId,
					price: lineItem.unitPrice,
					status: 'valid',
					qrCode: `ticket:${ticketNumber}`
				}, { transaction });
			}
		}

		await transaction.commit();

		if (confirmedOrderId) {
			await sendOrderConfirmationEmailIfNeeded(confirmedOrderId).catch((error) => {
				console.error('Order confirmation email error:', error);
			});
		}

		return {
			outcome: 'confirmed' as const,
			orderId: confirmedOrderId
		};
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
		const lineItems = parseLineItemsFromOrder(order);
		const pricing = parsePricingFromOrder(order);
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
					lineItems,
					pricing
				}
			}
		});

		await payment.update({
			amount: Number(order.totalAmount),
			currency: String(order.currency || 'USD').toUpperCase(),
			metadata: {
				lineItems,
				pricing
			},
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

router.post('/reconcile', authenticate, async (req: AuthenticatedRequest, res: Response) => {
	try {
		if (!stripe) {
			return res.status(503).json({ message: 'Stripe is not configured. Add STRIPE_SECRET_KEY.' });
		}

		const userId = req.user?.userId;
		const { orderId, paymentIntentId } = req.body as { orderId?: number; paymentIntentId?: string };

		if (!userId || !orderId) {
			return res.status(400).json({ message: 'orderId is required' });
		}

		const order = await Order.findByPk(orderId);
		if (!order || order.userId !== userId) {
			return res.status(404).json({ message: 'Order not found' });
		}

		const payment = await Payment.findOne({ where: { orderId: order.id } });
		const resolvedPaymentIntentId = String(paymentIntentId || payment?.paymentIntentId || '');

		if (!resolvedPaymentIntentId) {
			return res.json({
				reconciled: false,
				orderStatus: order.status,
				paymentStatus: payment?.status || null,
				paymentIntentStatus: null
			});
		}

		const intent = await stripe.paymentIntents.retrieve(resolvedPaymentIntentId);
		let reconcileOutcome: string | null = null;

		if (intent.status === 'succeeded') {
			const result = await finalizeSucceededPaymentIntent(intent);
			reconcileOutcome = result.outcome;
		}

		const refreshedOrder = await Order.findByPk(order.id);
		const refreshedPayment = await Payment.findOne({ where: { orderId: order.id } });

		return res.json({
			reconciled: reconcileOutcome === 'confirmed' || reconcileOutcome === 'already_processed',
			reconcileOutcome,
			orderStatus: refreshedOrder?.status || order.status,
			paymentStatus: refreshedPayment?.status || payment?.status || null,
			paymentIntentStatus: intent.status
		});
	} catch (error) {
		console.error('Reconcile payment error:', error);
		return res.status(500).json({ message: 'Unable to reconcile payment status' });
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
			const result = await finalizeSucceededPaymentIntent(intent);

			if (result.outcome === 'payment_not_found') {
				return res.status(200).json({ received: true, ignored: 'payment not found' });
			}

			if (result.outcome === 'order_not_found') {
				return res.status(200).json({ received: true, ignored: 'order not found' });
			}

			if (result.outcome === 'reservation_expired') {
				return res.status(200).json({ received: true, ignored: 'reservation expired' });
			}

			if (result.outcome === 'already_processed') {
				return res.status(200).json({ received: true, ignored: 'already processed' });
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
