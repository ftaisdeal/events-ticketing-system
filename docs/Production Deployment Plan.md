# Production Deployment Plan

## Goal

Deploy the main website, customer ticketing frontend, check-in PWA, and ticketing backend on a single Linux VPS under the `rdx.theater` domain.

This design prioritizes:

- One domain for a continuous customer journey and cleaner analytics
- One server for simpler routing, logging, and deployment
- Private source code outside the public web root
- Static frontend publishing with a managed Node.js backend
- Clean support for future background jobs, admin tools, and observability

## Recommended Hosting Model

Use the VPS as the primary production host for all public-facing RDX properties:

- `https://rdx.theater/` for the main website
- `https://rdx.theater/tickets` for the customer ticketing frontend
- `https://rdx.theater/checkin` for the staff check-in PWA
- `https://rdx.theater/api` for the shared backend API

Avoid splitting these across multiple hosts unless there is a strong operational reason to do so.

## Recommended Server Stack

- Linux VPS
- CyberPanel for site and TLS management if desired
- OpenLiteSpeed or Nginx as the public web server layer
- Node.js LTS for the backend runtime
- PM2 or `systemd` for backend process management
- MySQL or MariaDB on the same VPS, or on a managed database if preferred
- Cron for scheduled tasks such as reminder emails

If CyberPanel becomes restrictive for path-based routing, configure the underlying web server directly rather than forcing the architecture into the panel's defaults.

## Production Directory Layout

Keep source code private and publish only built assets to the public web root.

```text
/home/rdx/
  apps/
    website/
      .git/
      ...
    ticketing/
      .git/
      backend/
      frontend/
      checkin-pwa/
      scripts/
      docs/
  logs/
    website/
    ticketing/
  backups/
    database/
    uploads/
  env/
    website.env
    ticketing-backend.env

/var/www/rdx/
  public/
    index.html
    assets/
    tickets/
      index.html
      assets/
    checkin/
      index.html
      assets/
```

### Notes

- `/home/rdx/apps/website` contains the website source or deploy checkout.
- `/home/rdx/apps/ticketing` contains the full ticketing repository.
- `/var/www/rdx/public` is the only public web root.
- `backend`, `.env`, scripts, and Git metadata should never be placed in the public directory.

## URL Routing Plan

The production site should behave as one product surface:

- `/` serves the main website
- `/tickets` serves the customer ticketing frontend
- `/checkin` serves the check-in PWA
- `/api` proxies to the Node.js backend

Optional future paths:

- `/admin` for internal admin UI
- `/boxoffice` for in-person sales workflows

### Why this routing model is preferable

- Same-domain analytics and attribution are simpler
- No CORS complexity for the browser clients
- Cookies and session identifiers remain first-party
- Marketing pages and ticket flows can share consistent tracking

## Application Responsibility Split

### Main website

- Marketing pages
- Organization information
- Show discovery entry points
- Navigation into the ticket funnel

### Ticketing frontend

- Event detail pages
- Cart and checkout
- Order confirmation and customer order views
- Account flows related to purchases

### Check-in PWA

- Staff authentication
- Event selection
- Ticket scanning and manual entry
- On-site redemption workflows

### Shared backend API

- Authentication and authorization
- Events, ticket inventory, orders, and payments
- Email workflows
- Ticket issuance and check-in validation
- Admin and reporting endpoints

## Backend Process Management

Use PM2 or `systemd` on the VPS. PM2 is usually easier for a Node.js application with one or more scripts.

### Recommended PM2 processes

- `rdx-ticketing-api` for the backend API
- optional worker process later if reminder emails or other jobs are moved out of cron

### PM2 expectations

- Keep the backend running after crashes
- Restart cleanly during deploys
- Persist process definitions across reboot
- Centralize stdout and stderr logs

If you prefer fewer moving parts and are comfortable managing Linux services directly, `systemd` is equally valid.

## Deployment Model

Use a single private Git checkout per repository, then build and publish static assets into the public directory.

### Website deploy

1. Pull latest website code into `/home/rdx/apps/website`
2. Install dependencies if needed
3. Build the production website bundle
4. Publish build output into `/var/www/rdx/public`

### Ticketing deploy

1. Pull latest ticketing code into `/home/rdx/apps/ticketing`
2. Build the customer frontend
3. Publish the customer frontend build into `/var/www/rdx/public/tickets`
4. Build the check-in PWA
5. Publish the check-in PWA build into `/var/www/rdx/public/checkin`
6. Install backend dependencies
7. Build the backend if required
8. Run database migrations if required
9. Restart the backend process

## One-Command Manual Deploy

Start here first. A single deployment script should handle the full ticketing release.

Suggested location:

```text
/home/rdx/apps/ticketing/scripts/deploy-production.sh
```

Suggested responsibilities:

1. Validate environment variables
2. Pull the latest branch or tag
3. Build frontend assets
4. Publish frontend assets to the public directory
5. Build backend assets
6. Run migrations
7. Restart the backend with PM2
8. Exit non-zero on failure

This script should be the single source of truth for ticketing deployment. Any future automation should call this same script.

## Git Hook Auto-Deploy After Push

Once the manual deployment script is stable, optionally add push-triggered deployment.

Recommended pattern:

- Bare repository at `/home/rdx/repos/ticketing.git`
- Working checkout at `/home/rdx/apps/ticketing`
- `post-receive` hook triggers `deploy-production.sh`

This gives a clean flow:

1. Local machine pushes to the VPS remote
2. Bare repo receives the push
3. Hook updates the working tree
4. Hook calls the same deploy script used for manual deployments

Do not let deployment logic drift between manual and automated paths.

## Database Placement

The simplest initial setup is to keep the database on the same VPS.

Advantages:

- Lowest latency between API and database
- Simpler networking
- Simpler first deployment

Tradeoffs:

- Shared failure domain with the application server
- Backups and restore discipline become more important

If the ticketing load grows materially, moving the database to a managed service can be revisited later.

## Scheduled Jobs

Your ticketing project already includes email reminder functionality. On the VPS, schedule these explicitly with cron or `systemd` timers.

Examples:

- Event reminder email jobs
- Cleanup or reconciliation jobs
- Log rotation helpers if not otherwise configured

Keep scheduled jobs separate from the web process. Do not hide critical recurring jobs inside the request-serving process.

## Environment Configuration

Store production secrets outside the repository.

Recommended environment files:

- `/home/rdx/env/ticketing-backend.env`
- `/home/rdx/env/website.env`

Expected ticketing backend environment categories:

- database connection settings
- JWT secrets
- Stripe keys and webhook secret
- email transport settings
- app URLs such as `APP_URL`, `TICKETING_URL`, and `CHECKIN_PWA_URL`
- logging and runtime environment values

Do not commit production secrets into Git.

## Reverse Proxy And Static Serving

Serve static assets directly from the web server. Proxy only API traffic to Node.js.

Recommended behavior:

- `/`, `/tickets`, and `/checkin` are served as static applications
- `/api` proxies to `http://127.0.0.1:<backend-port>`
- deep links for the frontend apps should fall back to each app's `index.html`

That fallback behavior matters for routes such as:

- `/tickets/events/123`
- `/tickets/orders/456`
- `/checkin/event/789`

## Analytics And Funnel Tracking

One VPS and one domain are beneficial because they allow a more reliable end-to-end funnel model.

Recommended funnel stages:

1. Website landing page view
2. Event page view
3. Click into ticket purchase flow
4. Add to cart
5. Checkout start
6. Payment submitted
7. Payment success
8. Order confirmation view

### Tracking recommendations

- Use one analytics property for the entire domain
- Standardize event naming across website and ticketing frontend
- Generate or preserve a first-party session identifier across the flow
- Log server-side order creation and payment confirmation events with order IDs
- Reconcile frontend analytics with backend order records when analyzing conversion

### Why single-domain matters

- fewer attribution gaps
- fewer cookie boundary issues
- simpler debugging of funnel drop-off
- cleaner integration with ad platforms and analytics tools

## Logging And Monitoring

At minimum, collect logs in separate locations for:

- web server access logs
- web server error logs
- ticketing backend application logs
- scheduled job logs

Recommended next steps after initial deployment:

- uptime monitoring for `/` and `/api/health`
- error alerting for backend failures
- disk usage and memory monitoring
- database backup verification

## Security Baseline

At minimum, do the following before going live:

1. SSH key-only login for administration if possible
2. Firewall rules allowing only required ports
3. HTTPS everywhere with automatic renewal
4. Non-root runtime user for the application
5. Production secrets outside the repository
6. Routine OS security updates
7. Database credentials with least privilege
8. Regular database backups and restore testing

## Backup Strategy

Back up the following independently:

- database dumps
- uploaded assets if uploads are added later
- environment files
- deployment scripts and server config snapshots

Keep at least one backup copy off-server. A backup stored only on the VPS is not a backup strategy.

## Rollback Strategy

Plan rollback before first production launch.

Minimum rollback model:

1. Tag each production release in Git
2. Keep the last known-good frontend build artifact or be able to rebuild it quickly
3. Keep database migrations reversible where possible
4. Restart the backend against the previous release when needed

If an automated deploy is later introduced, it should stop on any failed build, migration, or restart step.

## Recommended Initial Implementation Order

1. Provision the VPS and secure it
2. Point the domain to the VPS
3. Configure the public web root and TLS
4. Deploy the main website to `/`
5. Deploy the ticketing frontend to `/tickets`
6. Deploy the check-in PWA to `/checkin`
7. Run the backend under PM2 or `systemd`
8. Configure `/api` reverse proxying
9. Validate deep-link routing for all frontend apps
10. Configure cron jobs for reminder emails and other scheduled tasks
11. Add analytics and server-side event logging validation
12. Add backup and monitoring checks

## Recommended Final Architecture

Use the VPS as the single production home for:

- the existing website
- the customer-facing ticketing frontend
- the staff-facing check-in PWA
- the shared Node.js backend API
- the database, at least initially

This is the cleanest fit for:

- a unified customer journey
- same-domain analytics
- predictable deployment behavior
- private source code and public asset separation
- future operational flexibility

## Practical Summary

Use one server, one domain, one reverse proxy layer, one backend runtime, and separate public static builds for the website, ticketing frontend, and check-in PWA.

Keep all source repositories outside the public web root. Publish only built assets into the public directory. Manage the backend explicitly with PM2 or `systemd`, and treat analytics, backups, and rollback as part of the deployment design rather than afterthoughts.