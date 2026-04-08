# Backend API Server

Node.js/Express.js backend for the Events Ticketing System.

## Features

- RESTful API design
- JWT authentication
- MySQL database with Sequelize ORM
- Input validation and sanitization
- Rate limiting and security headers
- Email notifications
- Stripe PaymentIntent creation and webhook confirmation
- Comprehensive error handling

## Project Structure

```
backend/
├── models/           # Sequelize models
├── routes/           # API route handlers
├── middleware/       # Custom middleware
├── utils/           # Utility functions
├── tests/           # Test files
├── server.ts        # Main server file
├── package.json     # Dependencies
└── README.md        # This file
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Configuration

Copy the environment template and configure your settings:

```bash
cp .env.example .env
```

The example file contains:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ticketing_system
DB_USER=root
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_here

# Server
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Stripe
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret
ORDER_RESERVATION_MINUTES=15

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
```

### 3. Database Setup

Make sure MySQL is running and create the database:

```bash
# Connect to MySQL
mysql -u root -p

# Create database
CREATE DATABASE ticketing_system;
EXIT;

# Import schema
mysql -u root -p ticketing_system < ../database/schema.sql
```

### 4. Start the Server

Development mode (with auto-restart):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

The server will start on http://localhost:3001

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/verify` - Verify JWT token

### Events
- `GET /api/events` - Get all events (with filters)
- `GET /api/events/:slug` - Get single event
- `GET /api/events/featured/list` - Get featured events

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

### Orders
- `POST /api/orders/reserve` - Reserve inventory and create pending order
- `GET /api/orders/my` - Get current user's active reservations and confirmed orders
- `POST /api/orders/:orderId/cancel` - Cancel pending order and release inventory

### Payments
- `POST /api/payments/create-intent` - Create payment intent
- `POST /api/payments/webhook` - Stripe webhook
- `POST /api/payments/expire-reservations` - Expire all pending reservations past `expiresAt`

## Stripe Flow

1. The frontend reserves inventory with `POST /api/orders/reserve`.
2. The backend creates a pending order and pending payment record.
3. The frontend calls `POST /api/payments/create-intent` to request a Stripe PaymentIntent.
4. Stripe Elements confirms the payment in the browser using the returned client secret.
5. Stripe sends `payment_intent.succeeded` or failure events to `POST /api/payments/webhook`.
6. The webhook updates the payment, confirms the order, and creates tickets.

For local testing, use Stripe CLI forwarding so the signed webhook secret matches your local server:

```bash
stripe listen --forward-to localhost:3001/api/payments/webhook
```

## Database Models

- **User** - User accounts and authentication
- **Event** - Event information and details
- **Venue** - Event locations
- **Category** - Event categories
- **TicketType** - Different ticket types for events
- **Order** - Customer orders
- **Ticket** - Individual tickets
- **Payment** - Payment transactions

## Security Features

- Helmet.js for security headers
- CORS protection
- Rate limiting
- Input validation and sanitization
- JWT token authentication
- Password hashing with bcrypt
- SQL injection prevention with Sequelize

## Testing

Run tests:
```bash
npm test
```

Run a typecheck:
```bash
npm run typecheck
```

Soft reset local transactional data:
```bash
npm run db:reset:soft
```

This command is destructive and intended for local development only. It clears orders, payments, tickets, and check-ins, resets `ticket_types.quantitySold` to `0`, and preserves users, events, venues, categories, and ticket types.

## Deployment

1. Set `NODE_ENV=production`
2. Configure production database
3. Set secure JWT secret
4. Configure production Stripe keys
5. Set up SSL certificates
6. Configure reverse proxy (nginx)

## Development

### Adding New Routes

1. Create route file in `routes/` directory
2. Import and register in `server.ts`
3. Add authentication middleware if needed
4. Implement validation and error handling

### Database Migrations

Using Sequelize CLI:
```bash
# Create migration
npx sequelize-cli migration:generate --name migration-name

# Run migrations
npm run migrate

# Undo migration
npm run migrate:undo
```
