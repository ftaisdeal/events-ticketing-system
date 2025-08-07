const express = require('express');
const { Event, User, Venue, Category, TicketType } = require('../models');
const { Op } = require('sequelize');

const router = express.Router();

// Get all events with filters
router.get('/', async (req, res) => {
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

    const offset = (page - 1) * limit;
    const where = { status: 'published' };

    // Apply filters
    if (category) {
      where['$category.slug$'] = category;
    }

    if (city) {
      where['$venue.city$'] = city;
    }

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    if (startDate) {
      where.startDateTime = { [Op.gte]: new Date(startDate) };
    }

    if (endDate) {
      where.endDateTime = { [Op.lte]: new Date(endDate) };
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
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    res.json({
      events: events.rows,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(events.count / limit),
        totalEvents: events.count,
        hasNext: page * limit < events.count,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single event by slug
router.get('/:slug', async (req, res) => {
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
router.get('/featured/list', async (req, res) => {
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

module.exports = router;
