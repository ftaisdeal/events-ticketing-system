# iPhone App Installation Options

There are several legitimate ways to install a private iPhone app without listing it on the public App Store. Which option fits depends on who the users are (employees vs. external customers), whether the app is “in-house,” and how much control you need.

**Options that avoid the public App Store**

**1) TestFlight (fastest for pilots, not for “production” at scale)**

- **How it works:** You distribute builds to testers via Apple’s TestFlight.
- **Pros:** Simple; Apple-supported; good for betas and limited rollouts.
- **Constraints:** Intended for testing; users must accept invites; builds expire and you must keep shipping new builds; there are limits on tester counts and build availability.
- **Best for:** Internal QA, early customer pilots, staged validation.

**2) Apple Business Manager / Apple School Manager “Custom App” (private distribution through the App Store infrastructure)**

- **How it works:** The app is **not publicly searchable**, but it is still an App Store-style distribution available only to specific organizations (via Apple Business Manager) or via a private link.
- **Pros:** Clean installation/update experience; scalable; Apple-managed licensing; no public listing.
- **Constraints:** Typically targets organizations; still goes through Apple review; not ideal if you need to distribute broadly to consumers who are not tied to an organization.
- **Best for:** B2B/private client deployments (e.g., venues, event companies, corporate partners).

**3) Apple Developer Enterprise Program (true “in-house” distribution, no App Store)**

- **How it works:** You sign and distribute the app internally (often via an MDM or an internal portal) to **your employees**.
- **Pros:** No App Store; you can push internally and control devices.
- **Constraints (important):** It is **not for external customer distribution**. Apple is strict about this; misuse can lead to program termination and apps being disabled.
- **Best for:** Employee-only apps (staff ticket scanners, ops tools) within a single company.

**4) Ad Hoc distribution (limited device installs, generally for testing)**

- **How it works:** You register device UDIDs and sign builds for those devices.
- **Pros:** Works outside the App Store; straightforward for small groups.
- **Constraints:** Device-count limits; operationally painful (UDID collection, re-signing); not scalable for customers.
- **Best for:** Small private deployments, demos, or controlled testing on known devices.

**5) Third-party app stores / sideloading in certain regions (context-dependent)**

- **How it works:** In some jurisdictions (notably the EU), iOS now supports alternative distribution mechanisms under specific Apple programs/terms.
- **Pros:** Potential for consumer distribution outside the App Store in those regions.
- **Constraints:** Region- and policy-dependent; additional compliance and operational complexity; not universally available worldwide.
- **Best for:** Region-specific consumer distribution strategies, if you qualify and accept the tradeoffs.

**Practical guidance for a “private ticketing service”**

- If it’s **for your staff only** (e.g., door scanners, staff management): **Enterprise Program** (often paired with MDM) is typically the right pattern.
- If it’s **for specific business customers/partners** (venues, promoters, corporate clients): **Custom App via Apple Business Manager** is usually the cleanest “private but scalable” approach.
- If it’s **for the general public / event attendees** but you want it “private”: Apple generally expects **public App Store distribution** (or a web app / PWA). Attempts to use Enterprise for attendees/customers is a common compliance failure.
- If you just need **a pilot**: **TestFlight** is often the simplest.

**One more alternative: avoid native install entirely**

If your main needs are ticket display, QR code, wallet passes, and basic account access, a **mobile web app** plus **Apple Wallet passes (PassKit)** can deliver a “private ticketing” experience without an installed app at all. This can be a strong fit for attendee-facing ticketing.

If you tell me who the users are (employees, partner organizations, or attendees) and roughly how many devices/users you need to support, I can point you to the most appropriate distribution path and the main compliance pitfalls to avoid.