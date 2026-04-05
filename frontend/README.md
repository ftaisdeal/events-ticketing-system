# Frontend React Application

Vite-powered React frontend for the Events Ticketing System.

## Features

- Modern React with Hooks and TypeScript
- Material-UI component library
- React Router for navigation
- React Query for data fetching
- Stripe Elements checkout flow
- Responsive design
- Authentication context
- Form validation
- Toast notifications

## Project Structure

```
frontend/
├── public/          # Static files
├── src/
│   ├── components/  # Reusable components
│   ├── pages/       # Page components
│   ├── contexts/    # React contexts
│   ├── pages/       # Route-level pages
│   ├── utils/       # Utility functions
│   ├── App.tsx      # Main app component
│   └── index.tsx    # App entry point
├── package.json     # Dependencies
└── README.md        # This file
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Environment Configuration

Copy the example environment file and adjust the values for your setup:

```bash
cp .env.example .env
```

The example file contains:

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
VITE_PRIMARY_ORGANIZER_EMAIL=organizer@example.com
```

### 3. Start Development Server

```bash
npm run dev
```

The application will start on http://localhost:5173

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview the production build locally
- `npm run typecheck` - Run the TypeScript compiler without emitting files
- `npm test` - Run tests

## Pages and Components

### Pages
- **Home** - Upcoming events landing page
- **Events** - Event listing with filters
- **EventDetail** - Single event details and ticket selection
- **Login/Register** - Authentication pages
- **Profile** - User profile management
- **Cart** - Shopping cart and ticket quantities
- **Checkout** - Reservation countdown plus Stripe payment form
- **Orders** - Order history
- **Dashboard** - Event organizer dashboard

### Key Components
- **Navbar** - Navigation header
- **Footer** - Site footer
- **StripePaymentForm** - Stripe CardElement payment form
- **ProtectedRoute** - Authentication guard

## State Management

- **AuthContext** - User authentication state
- **React Query** - Server state management
- **Local State** - Component-level state with useState

## API Integration

The frontend communicates with the backend API using:
- Axios for HTTP requests
- React Query for caching and synchronization
- Custom hooks for API calls

### Example API Usage

```javascript
import { useQuery } from 'react-query';
import { getEvents } from '../services/eventService';

const EventsList = () => {
  const { data: events, isLoading, error } = useQuery('events', getEvents);
  
  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading events</div>;
  
  return (
    <div>
      {events.map(event => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
};
```

## Styling

- Material-UI for component library
- Custom CSS for specific styling
- Responsive design with Material-UI breakpoints
- Consistent theme configuration

## Authentication

- JWT token storage in localStorage
- Protected routes with authentication guards
- Automatic token refresh
- Role-based access control

## Payment Integration

- Checkout first reserves inventory and creates a pending order
- The frontend requests a Stripe PaymentIntent from the backend
- Stripe Elements renders a secure card form in checkout
- The browser confirms the payment with Stripe using the client secret
- The backend webhook marks the order confirmed and issues tickets
- The Orders page shows a temporary processing state while webhook confirmation settles

## Build and Deployment

### Development Build
```bash
npm run build
```

### Production Deployment
1. Build the application
2. Upload the generated `dist/` folder to your web server
3. Configure web server for SPA routing
4. Set production environment variables

### Environment Variables
- `VITE_API_BASE_URL` - Backend origin, for example `http://localhost:3001`
- `VITE_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key
- `VITE_PRIMARY_ORGANIZER_EMAIL` - Optional organizer email used by protected dashboard routes

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance Optimization

- Code splitting with React.lazy
- Image optimization
- Bundle size optimization
- Caching strategies with React Query

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation
4. Create pull requests for review
