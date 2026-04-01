import express, { NextFunction, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';

import db from '../models';

const { Venue } = db;
const jwtSecret = process.env.JWT_SECRET || 'dev-secret';

const router = express.Router();

type AuthUser = {
  userId: number;
  email: string;
  role: string;
};

type AuthenticatedRequest = Request & {
  user?: AuthUser;
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

const ensureAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  next();
};

router.get('/', authenticate, ensureAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const venues = await Venue.findAll({
      order: [['name', 'ASC']]
    });

    return res.json({ venues });
  } catch (error) {
    console.error('Get venues error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', authenticate, ensureAdmin, [
  body('name').trim().isLength({ min: 2, max: 200 }),
  body('address').trim().isLength({ min: 3, max: 500 }),
  body('city').trim().isLength({ min: 2, max: 100 }),
  body('state').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('country').trim().isLength({ min: 2, max: 100 }),
  body('postalCode').optional({ nullable: true }).trim().isLength({ max: 20 })
], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, address, city, state, country, postalCode } = req.body as {
      name: string;
      address: string;
      city: string;
      state?: string;
      country: string;
      postalCode?: string;
    };

    const venue = await Venue.create({
      name,
      address,
      city,
      state: state || null,
      country,
      postalCode: postalCode || null
    });

    return res.status(201).json({
      message: 'Venue created successfully',
      venue
    });
  } catch (error) {
    console.error('Create venue error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
