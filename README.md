# Events Ticketing System

A full-stack events ticketing platform built with Node.js, React, and MySQL.

## Project Structure

```
ticketing/
├── backend/          # Node.js API server
├── frontend/         # React client application
├── database/         # Database scripts and migrations
└── README.md
```

## Tech Stack

- **Backend**: Node.js, Express.js, MySQL, Sequelize ORM
- **Frontend**: Vite, React, TypeScript, Material-UI
- **Database**: MySQL
- **Authentication**: JWT
- **Payment**: Stripe integration

## Getting Started

1. Clone the repository
2. Set up the database (see database/README.md)
3. Install and run the backend (see backend/README.md)
4. Install and run the frontend (see frontend/README.md)

## Features

- User authentication and authorization
- Event creation and management
- Ticket purchasing and inventory management
- Payment processing
- Order management
- Email notifications
- Admin dashboard
- Mobile-responsive design

## Stripe Checkout Flow

1. The cart is converted into a temporary ticket reservation.
2. The backend creates a pending order and Stripe PaymentIntent.
3. The frontend renders Stripe Elements for card entry.
4. Stripe webhook confirmation finalizes the order and issues tickets.

## Development

- Backend runs on http://localhost:3001
- Frontend runs on http://localhost:5173
- Database runs on localhost:3306
- Run backend npm scripts from the backend directory, for example: `cd backend && npm run db:reset:soft`
- Or run a backend script from the repository root with: `npm --prefix backend run <script>`
