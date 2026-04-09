# Cart Stuffing Defense Plan

## Short Answer

Cart stuffing should be treated as a first-class abuse case. Stripe does not solve this problem because it happens before the payment stage.

Stripe becomes relevant once a payment attempt starts. Cart stuffing happens earlier, at the reservation layer.

## Current System Strength

The current backend already has the right basic shape for reservation-based inventory control.

The reserve flow:

- creates short-lived pending orders
- sets an expiration time
- temporarily increments reserved inventory

This is the correct foundation. The next step is to harden the reservation system against abuse at scale.

## Core Strategy

The goal is not to eliminate reservations. Reservations are necessary for checkout.

The goal is to make abusive reservations:

- difficult to create in volume
- short-lived
- easy to detect
- limited in their impact on available inventory

## Recommended Protections

### 1. Keep reservations short

Reservation windows should remain brief. Around five minutes is a reasonable default.

Long reservation windows make cart stuffing much more damaging because inventory stays blocked for too long.

### 2. Enforce per-customer ticket limits before checkout

If an event has a maximum number of tickets per customer, enforce it during reservation creation.

Do not wait until payment time.

This is one of the most effective controls against hoarding behavior.

### 3. Add velocity limits on reservation attempts

Rate-limit reservation creation by:

- user ID
- IP address
- event ID

Examples of suspicious behavior:

- too many reserve calls in a short period
- repeated cart changes for the same event
- many abandoned pending orders

A normal customer may revise a cart once or twice. A bot will hit the reserve endpoint repeatedly.

### 4. Allow only one active pending order per user per event

If a user already has an active pending order for an event, either reuse it or require it to expire before another different reservation can be created.

This prevents one account from tying up multiple blocks of inventory for the same event.

### 5. Release inventory promptly after expiration

Expired pending orders must return inventory quickly.

This requires a reliable cleanup process so abandoned reservations do not linger. If reservations expire slowly or inconsistently, cart stuffing becomes much more effective.

### 6. Add bot friction on high-risk events

For high-demand on-sale moments, add a bot challenge before reservation creation.

Examples:

- Cloudflare Turnstile
- hCaptcha

This should be applied selectively when risk is high, not necessarily for every event at all times.

### 7. Track reservation abuse patterns

Log the following events:

- reservation created
- reservation reused
- reservation expired
- checkout started
- payment succeeded

Then watch for patterns such as:

- many reservations with no payments
- many accounts from one IP
- many near-maximum carts for one event
- repeated reservations that always expire

### 8. Consider reservation budgets during spikes

For especially high-demand events, consider limiting how much inventory may be held in pending status at once.

If necessary, add a queue or waiting-room pattern during the first release window instead of allowing unlimited simultaneous reservation attempts.

## Recommended Policy For This System

The recommended initial policy is:

- one active pending order per user per event
- five-minute reservation timeout
- hard per-event ticket cap per customer
- rate limiting on the reservation endpoint
- expiration cleanup job every minute
- optional bot challenge for high-risk events
- admin visibility into pending versus confirmed inventory

## Main Risk To Prevent

The problem is not that reservations exist.

The real risk is that a bot can create pending holds faster than they expire.

That is what rate limiting, per-user caps, and aggressive cleanup must prevent.

## Practical Summary

The plan is not to stop every abusive reservation attempt.

The plan is to make reservation abuse:

- expensive
- short-lived
- constrained
- visible to operators

That is the correct defense model for cart stuffing in a ticketing system.