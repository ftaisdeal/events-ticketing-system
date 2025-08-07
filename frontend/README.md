# Frontend React Application

React.js frontend for the Events Ticketing System.

## Features

- Modern React with Hooks
- Material-UI component library
- React Router for navigation
- React Query for data fetching
- Stripe payment integration
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
│   ├── hooks/       # Custom hooks
│   ├── services/    # API services
│   ├── utils/       # Utility functions
│   ├── App.js       # Main app component
│   └── index.js     # App entry point
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

Create `.env` file in the frontend directory:

```env
REACT_APP_API_URL=http://localhost:3001/api
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

### 3. Start Development Server

```bash
npm start
```

The application will start on http://localhost:3000

## Available Scripts

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run tests
- `npm eject` - Eject from Create React App (not recommended)

## Pages and Components

### Pages
- **Home** - Landing page with featured events
- **Events** - Event listing with filters
- **EventDetail** - Single event details and ticket selection
- **Login/Register** - Authentication pages
- **Profile** - User profile management
- **Cart** - Shopping cart
- **Checkout** - Payment processing
- **Orders** - Order history
- **Dashboard** - Event organizer dashboard

### Key Components
- **Navbar** - Navigation header
- **Footer** - Site footer
- **EventCard** - Event display card
- **TicketSelector** - Ticket quantity selection
- **PaymentForm** - Stripe payment form
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

- Stripe Elements for secure payment forms
- Payment intent creation and confirmation
- Error handling for payment failures
- Order confirmation flow

## Build and Deployment

### Development Build
```bash
npm run build
```

### Production Deployment
1. Build the application
2. Upload `build/` folder to web server
3. Configure web server for SPA routing
4. Set production environment variables

### Environment Variables
- `REACT_APP_API_URL` - Backend API URL
- `REACT_APP_STRIPE_PUBLISHABLE_KEY` - Stripe public key

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
