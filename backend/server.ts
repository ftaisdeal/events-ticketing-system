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
