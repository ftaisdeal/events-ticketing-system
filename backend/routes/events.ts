import express, { NextFunction, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';

import db from '../models';

const { Event, User, Venue, Category, TicketType } = db;
const jwtSecret = process.env.JWT_SECRET || 'dev-secret';

const getPrimaryOrganizerEmail = () => process.env.PRIMARY_ORGANIZER_EMAIL?.trim().toLowerCase();

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

const ensureOrganizer = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || (req.user.role !== 'organizer' && req.user.role !== 'admin')) {
    return res.status(403).json({ message: 'Organizer or admin access required' });
  }

  // Admins should always be able to manage events.
  if (req.user.role === 'admin') {
    next();
    return;
  }

  const primaryOrganizerEmail = getPrimaryOrganizerEmail();
  if (!primaryOrganizerEmail) {
    next();
    return;
  }

  const tokenEmail = req.user.email?.trim().toLowerCase();
  if (tokenEmail && tokenEmail === primaryOrganizerEmail) {
    next();
    return;
  }

  const user = await User.findByPk(req.user.userId, { attributes: ['id', 'email'] });
  if (!user) {
    return res.status(401).json({ message: 'User not found' });
  }

  const userEmail = (user.email as string).trim().toLowerCase();
  if (userEmail !== primaryOrganizerEmail) {
    return res.status(403).json({ message: 'Only the primary organizer account can manage events' });
  }

  next();
};

const toSlug = (value: string) => value
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

const ensureUniqueSlug = async (baseSlug: string) => {
  let slug = baseSlug;
  let suffix = 1;

  while (await Event.findOne({ where: { slug } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
};

const canManageEvent = (req: AuthenticatedRequest, organizerId: number): boolean => {
  return req.user?.role === 'admin' || organizerId === req.user?.userId;
};

const eventValidationRules = [
  body('title').trim().isLength({ min: 3, max: 200 }),
  body('description').trim().isLength({ min: 10 }),
  body('startDateTime').isISO8601(),
  body('endDateTime').isISO8601(),
  body('timezone').optional().isLength({ min: 2, max: 50 }),
  body('status').optional().isIn(['draft', 'published']),
  body('isPublic').optional().isBoolean(),
  body('categoryId').optional({ nullable: true }).isInt({ min: 1 }),
  body('venueId').optional({ nullable: true }).isInt({ min: 1 }),
  body('maxCapacity').optional({ nullable: true }).isInt({ min: 1 })
];

const ticketTypeValidationRules = [
  body('name').trim().isLength({ min: 2, max: 100 }),
  body('price').isFloat({ gt: 0 }),
  body('quantity').isInt({ min: 1 }),
  body('isActive').optional().isBoolean()
];

// Organizer helpers for event creation form
router.get('/meta/options', authenticate, ensureOrganizer, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [categories, venues] = await Promise.all([
      Category.findAll({
        attributes: ['id', 'name', 'slug'],
        order: [['name', 'ASC']]
      }),
      Venue.findAll({
        attributes: ['id', 'name', 'city', 'country'],
        order: [['name', 'ASC']]
      })
    ]);

    res.json({ categories, venues });
  } catch (error) {
    console.error('Get event meta options error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', authenticate, ensureOrganizer, eventValidationRules, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      description,
      shortDescription,
      startDateTime,
      endDateTime,
      timezone,
      status,
      isPublic,
      categoryId,
      venueId,
      maxCapacity
    } = req.body as {
      title: string;
      description: string;
      shortDescription?: string;
      startDateTime: string;
      endDateTime: string;
      timezone?: string;
      status?: 'draft' | 'published';
      isPublic?: boolean;
      categoryId?: number | null;
      venueId?: number | null;
      maxCapacity?: number | null;
    };

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    if (end <= start) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    if (categoryId) {
      const category = await Category.findByPk(categoryId);
      if (!category) {
        return res.status(400).json({ message: 'Invalid category' });
      }
    }

    if (venueId) {
      const venue = await Venue.findByPk(venueId);
      if (!venue) {
        return res.status(400).json({ message: 'Invalid venue' });
      }
    }

    const baseSlug = toSlug(title);
    const slug = await ensureUniqueSlug(baseSlug);

    const event = await Event.create({
      title,
      description,
      shortDescription: shortDescription || null,
      slug,
      startDateTime: start,
      endDateTime: end,
      timezone: timezone || 'UTC',
      status: status || 'draft',
      isPublic: typeof isPublic === 'boolean' ? isPublic : true,
      organizerId: req.user!.userId,
      categoryId: categoryId || null,
      venueId: venueId || null,
      maxCapacity: maxCapacity || null
    });

    const createdEvent = await Event.findByPk(event.id, {
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
          attributes: ['id', 'name', 'slug']
        }
      ]
    });

    res.status(201).json({
      message: 'Event created successfully',
      event: createdEvent
    });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:eventId/ticket-types', authenticate, ensureOrganizer, ticketTypeValidationRules, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const eventId = Number(req.params.eventId);
    if (!Number.isInteger(eventId) || eventId < 1) {
      return res.status(400).json({ message: 'Invalid event id' });
    }

    const event = await Event.findByPk(eventId, {
      attributes: ['id', 'title', 'organizerId']
    });

    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (req.user?.role !== 'admin' && Number((event as any).organizerId) !== req.user?.userId) {
      return res.status(403).json({ message: 'You can only manage ticket types for your own events' });
    }

    const { name, price, quantity, isActive } = req.body as {
      name: string;
      price: number;
      quantity: number;
      isActive?: boolean;
    };

    const ticketType = await TicketType.create({
      eventId,
      name,
      price: Number(price),
      quantity: Number(quantity),
      isActive: typeof isActive === 'boolean' ? isActive : true
    });

    return res.status(201).json({
      message: 'Ticket type created successfully',
      ticketType,
      event: {
        id: (event as any).id,
        title: (event as any).title
      }
    });
  } catch (error) {
    console.error('Create ticket type error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:eventId/ticket-types/:ticketTypeId', authenticate, ensureOrganizer, ticketTypeValidationRules, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const eventId = Number(req.params.eventId);
    const ticketTypeId = Number(req.params.ticketTypeId);
    if (!Number.isInteger(eventId) || eventId < 1 || !Number.isInteger(ticketTypeId) || ticketTypeId < 1) {
      return res.status(400).json({ message: 'Invalid id' });
    }

    const event = await Event.findByPk(eventId, {
      attributes: ['id', 'organizerId']
    });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (!canManageEvent(req, Number((event as any).organizerId))) {
      return res.status(403).json({ message: 'You can only manage ticket types for your own events' });
    }

    const ticketType = await TicketType.findOne({ where: { id: ticketTypeId, eventId } });
    if (!ticketType) {
      return res.status(404).json({ message: 'Ticket type not found' });
    }

    const { name, price, quantity, isActive } = req.body as {
      name: string;
      price: number;
      quantity: number;
      isActive?: boolean;
    };

    await ticketType.update({
      name,
      price: Number(price),
      quantity: Number(quantity),
      isActive: typeof isActive === 'boolean' ? isActive : true
    });

    return res.json({
      message: 'Ticket type updated successfully',
      ticketType
    });
  } catch (error) {
    console.error('Update ticket type error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

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

router.get('/manage/events', authenticate, ensureOrganizer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const where: Record<string, any> = {};
    if (req.user?.role !== 'admin') {
      where.organizerId = req.user?.userId;
    }

    const events = await Event.findAll({
      where,
      include: [
        {
          model: TicketType,
          as: 'ticketTypes',
          attributes: ['quantitySold']
        }
      ],
      order: [['startDateTime', 'DESC']]
    });

    const serializedEvents = events.map((eventRecord: any) => {
      const event = eventRecord.get({ plain: true }) as {
        id: number;
        title: string;
        slug: string;
        status: string;
        startDateTime: string;
        endDateTime: string;
        ticketTypes?: Array<{ quantitySold: number }>;
      };

      const ticketsSold = (event.ticketTypes || []).reduce((sum, ticketType) => {
        return sum + Number(ticketType.quantitySold || 0);
      }, 0);

      return {
        id: event.id,
        title: event.title,
        slug: event.slug,
        status: event.status,
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        ticketsSold
      };
    });

    res.json({ events: serializedEvents });
  } catch (error) {
    console.error('Get managed events error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/manage/events/:eventId', authenticate, ensureOrganizer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const eventId = Number(req.params.eventId);
    if (!Number.isInteger(eventId) || eventId < 1) {
      return res.status(400).json({ message: 'Invalid event id' });
    }

    const event = await Event.findByPk(eventId, {
      include: [
        {
          model: TicketType,
          as: 'ticketTypes',
          attributes: ['id', 'name', 'price', 'quantity', 'isActive', 'quantitySold'],
          required: false
        }
      ]
    });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (!canManageEvent(req, Number((event as any).organizerId))) {
      return res.status(403).json({ message: 'You can only manage your own events' });
    }

    return res.json({ event });
  } catch (error) {
    console.error('Get managed event error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.put('/:eventId', authenticate, ensureOrganizer, eventValidationRules, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const eventId = Number(req.params.eventId);
    if (!Number.isInteger(eventId) || eventId < 1) {
      return res.status(400).json({ message: 'Invalid event id' });
    }

    const event = await Event.findByPk(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (!canManageEvent(req, Number((event as any).organizerId))) {
      return res.status(403).json({ message: 'You can only manage your own events' });
    }

    const {
      title,
      description,
      shortDescription,
      startDateTime,
      endDateTime,
      timezone,
      status,
      isPublic,
      categoryId,
      venueId,
      maxCapacity
    } = req.body as {
      title: string;
      description: string;
      shortDescription?: string;
      startDateTime: string;
      endDateTime: string;
      timezone?: string;
      status?: 'draft' | 'published';
      isPublic?: boolean;
      categoryId?: number | null;
      venueId?: number | null;
      maxCapacity?: number | null;
    };

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    if (end <= start) {
      return res.status(400).json({ message: 'End date must be after start date' });
    }

    if (categoryId) {
      const category = await Category.findByPk(categoryId);
      if (!category) {
        return res.status(400).json({ message: 'Invalid category' });
      }
    }

    if (venueId) {
      const venue = await Venue.findByPk(venueId);
      if (!venue) {
        return res.status(400).json({ message: 'Invalid venue' });
      }
    }

    const nextTitle = title.trim();
    const currentTitle = String((event as any).title || '').trim();
    let slug = (event as any).slug as string;
    if (nextTitle.toLowerCase() !== currentTitle.toLowerCase()) {
      slug = await ensureUniqueSlug(toSlug(nextTitle));
    }

    await event.update({
      title,
      description,
      shortDescription: shortDescription || null,
      slug,
      startDateTime: start,
      endDateTime: end,
      timezone: timezone || 'UTC',
      status: status || 'draft',
      isPublic: typeof isPublic === 'boolean' ? isPublic : true,
      categoryId: categoryId || null,
      venueId: venueId || null,
      maxCapacity: maxCapacity || null
    });

    return res.json({
      message: 'Event updated successfully',
      event
    });
  } catch (error) {
    console.error('Update event error:', error);
    return res.status(500).json({ message: 'Server error' });
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

export default router;
