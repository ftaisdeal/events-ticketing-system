# Check-in PWA Architecture

## Recommendation

Build check-in as a separate frontend app in the same repository and against the same backend.

This keeps the scanner isolated from the storefront while preserving one source of truth for authentication, event data, ticket issuance, and redemption.

## Split Of Responsibility

### Existing customer frontend

- Discovery, cart, checkout, orders, and account flows
- Customer-facing navigation and marketing presentation
- Stripe checkout and order/payment lifecycle

### New check-in PWA

- Staff-only login and event selection
- Camera scanning and manual code entry
- Ticket lookup and redemption
- Lightweight service worker and installable shell

### Shared backend

- JWT authentication
- Event access control for organizer/admin staff
- Ticket issuance after payment confirmation
- Idempotent redemption endpoints and audit record persistence

## Redemption Model

The backend now uses a dedicated `ticket_check_ins` record instead of relying only on the mutable `tickets.status` field.

### Why

- Prevent duplicate admissions with a unique constraint on `ticketId`
- Preserve an auditable record of who admitted the ticket and from which device/source
- Keep the ticket row as the canonical current state while storing the successful redemption as an event record

### Current behavior

- Payment confirmation issues tickets with QR values in the form `ticket:TKT-...`
- Check-in lookup validates event access, order state, and ticket state
- Redeem creates one `ticket_check_ins` row and marks the ticket `used`
- Duplicate scans return `already_checked_in` without creating another record

## API Surface

### Staff event selection

- `GET /api/tickets/check-in/events`
- `GET /api/tickets/check-in/events/:eventId/summary`

### Ticket operations

- `POST /api/tickets/check-in/lookup`
- `POST /api/tickets/check-in/redeem`

All endpoints require organizer or admin JWT auth.

## Operational Notes

- Keep the check-in PWA online-first unless offline admission is a hard requirement.
- Deploy the PWA independently from the storefront so emergency scanner fixes do not wait for customer-site releases.
- Set `CHECKIN_PWA_URL` on the backend to the deployed origin of the PWA so scanner requests pass CORS.
- Use dedicated staff devices where possible, especially on iOS.
- Add PNG PWA icons and full offline conflict rules before calling the scanner production-ready.