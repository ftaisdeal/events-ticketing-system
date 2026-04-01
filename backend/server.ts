import cors from 'cors';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';

import db from './models';
import authRoutes from './routes/auth';
import eventRoutes from './routes/events';
import orderRoutes from './routes/orders';
import paymentRoutes from './routes/payments';
import ticketRoutes from './routes/tickets';
import userRoutes from './routes/users';
import venueRoutes from './routes/venues';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const isProduction = process.env.NODE_ENV === 'production';
const configuredFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const staticAllowedOrigins = new Set([
  configuredFrontendUrl,
  configuredFrontendUrl.replace('localhost', '127.0.0.1'),
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

const isLocalDevOrigin = (origin: string): boolean => {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
};

const expireStaleReservations = async () => {
	try {
		const { Order, TicketType, Payment, sequelize } = db;
		const expiredOrders = await Order.findAll({
			where: {
				status: 'pending',
				expiresAt: {
					[db.Sequelize.Op.lt]: new Date()
				}
			}
		});

		for (const order of expiredOrders) {
			const transaction = await sequelize.transaction();
			try {
				const lockedOrder = await Order.findByPk(order.id, {
					transaction,
					lock: transaction.LOCK.UPDATE
				});

				if (!lockedOrder || lockedOrder.status !== 'pending') {
					await transaction.rollback();
					continue;
				}

				const customerInfo = lockedOrder.customerInfo as { lineItems?: Array<{ ticketTypeId: number; quantity: number }> } | null;
				const lineItems = (customerInfo?.lineItems || []) as Array<{ ticketTypeId: number; quantity: number }>;

				for (const item of lineItems) {
					const ticketType = await TicketType.findByPk(item.ticketTypeId, {
						transaction,
						lock: transaction.LOCK.UPDATE
					});
					if (ticketType) {
						const currentSold = Number(ticketType.quantitySold || 0);
						const nextSold = Math.max(0, currentSold - item.quantity);
						await ticketType.update({ quantitySold: nextSold }, { transaction });
					}
				}

				await lockedOrder.update({ status: 'expired', expiresAt: null }, { transaction });
				await Payment.update(
					{
						status: 'expired',
						failureReason: 'Reservation expired',
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
				console.log(`[Cleanup] Expired order ${order.id}`);
			} catch (error) {
				await transaction.rollback();
				console.error(`[Cleanup] Error expiring order ${order.id}:`, error);
			}
		}

		if (expiredOrders.length > 0) {
			console.log(`[Cleanup] Expired ${expiredOrders.length} stale reservation(s)`);
		}
	} catch (error) {
		console.error('[Cleanup] Error during expiration check:', error);
	}
};

// Security middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const allowLocalDevOrigin = !isProduction && origin ? isLocalDevOrigin(origin) : false;

    if (!origin || staticAllowedOrigins.has(origin) || allowLocalDevOrigin) {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Logging
app.use(morgan('combined'));

// Stripe webhook must receive raw body for signature verification.
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/venues', venueRoutes);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 handler
app.use('*', (_req: Request, res: Response) => {
  res.status(404).json({ message: 'Route not found' });
});

// Database connection and server start
async function startServer() {
  try {
    await db.sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    // Sync database in development
    if (process.env.NODE_ENV === 'development') {
      await db.sequelize.sync();
      console.log('Database synchronized.');
    }

    // Run initial cleanup and set interval every 5 minutes
    await expireStaleReservations();
    setInterval(expireStaleReservations, 5 * 60 * 1000);
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
