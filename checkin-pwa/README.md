# Check-In PWA

Separate staff-facing Progressive Web App for ticket redemption and event admissions.

## Why This Is Separate

The storefront and the door-scanner have different release and runtime constraints. This app keeps camera permissions, service worker behavior, and admissions UX isolated from the customer checkout experience while still using the same backend and JWT auth flow.

## Features In This Scaffold

- Staff login using the existing backend auth endpoint
- Event list for organizer/admin users
- Dedicated event check-in console
- Live QR scanning with manual code entry fallback
- PWA manifest and service worker wiring
- Ticket redemption against the backend check-in endpoints

## Local Development

```bash
cd checkin-pwa
npm install
npm run dev
```

Default local URL: http://localhost:5174

## Environment Variables

```env
VITE_API_BASE_URL=http://localhost:3001
```

If the backend is deployed separately, set `CHECKIN_PWA_URL` on the backend to this app's origin so CORS allows staff devices to connect.

## Backend Endpoints Used

- `GET /api/tickets/check-in/events`
- `GET /api/tickets/check-in/events/:eventId/summary`
- `POST /api/tickets/check-in/redeem`

## Production Notes

- Replace the SVG app icons with real PNG icon assets before shipping.
- Serve over HTTPS so camera access and install prompts work consistently.
- Keep this app on its own deploy target even if it stays in the same repository.