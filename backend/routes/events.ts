import express, { Request, Response } from 'express';
import { Op } from 'sequelize';

import db from '../models';

const { Event, User, Venue, Category, TicketType } = db;

const router = express.Router();

// Get all events with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      city,
      search,
      startDate,
      endDate,
      sortBy = 'startDateTime',
      sortOrder = 'ASC'
    } = req.query;

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 12;
    const sortByValue = String(sortBy);
    const sortOrderValue = String(sortOrder).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    const offset = (pageNum - 1) * limitNum;
    const where: Record<string | symbol, any> = { status: 'published' };

    // Apply filters
    if (category) {
      where['$category.slug$'] = String(category);
    }

    if (city) {
      where['$venue.city$'] = String(city);
    }

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${String(search)}%` } },
        { description: { [Op.like]: `%${String(search)}%` } }
      ];
    }

    if (startDate) {
      where.startDateTime = { [Op.gte]: new Date(String(startDate)) };
    }

    if (endDate) {
      where.endDateTime = { [Op.lte]: new Date(String(endDate)) };
    }

    const events = await Event.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'organizerUser',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: Venue,
          as: 'venue',
          attributes: ['id', 'name', 'city', 'country']
        },
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug', 'color']
        },
        {
          model: TicketType,
          as: 'ticketTypes',
          attributes: ['id', 'name', 'price', 'quantity', 'quantitySold']
        }
      ],
      order: [[sortByValue, sortOrderValue]],
      limit: limitNum,
      offset,
      distinct: true
    });

    res.json({
      events: events.rows,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(events.count / limitNum),
        totalEvents: events.count,
        hasNext: pageNum * limitNum < events.count,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single event by slug
router.get('/:slug', async (req: Request<{ slug: string }>, res: Response) => {
  try {
    const event = await Event.findOne({
      where: { slug: req.params.slug },
      include: [
        {
          model: User,
          as: 'organizerUser',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: Venue,
          as: 'venue'
        },
        {
          model: Category,
          as: 'category'
        },
        {
          model: TicketType,
          as: 'ticketTypes',
          where: { isActive: true },
          required: false
        }
      ]
    });

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get featured events
router.get('/featured/list', async (_req: Request, res: Response) => {
  try {
    const events = await Event.findAll({
      where: {
        status: 'published',
        startDateTime: { [Op.gte]: new Date() }
      },
      include: [
        {
          model: User,
          as: 'organizerUser',
          attributes: ['id', 'firstName', 'lastName']
        },
        {
          model: Venue,
          as: 'venue',
          attributes: ['id', 'name', 'city', 'country']
        },
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'name', 'slug', 'color']
        }
      ],
      order: [['startDateTime', 'ASC']],
      limit: 6
    });

    res.json(events);
  } catch (error) {
    console.error('Get featured events error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
