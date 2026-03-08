# **Ticketing System Bot Defenses**

Bots *do* buy tickets on custom or poorly protected ticketing systems — not because they “want” the tickets, but because automated scalping, fraud, and denial-of-service attacks are profitable or strategically useful to the humans who deploy them.

Here are the main reasons a bot would purchase (or attempt to purchase) tickets on your *home-built* system:

### **1. Scalping for Resale Profit**

Bots try to buy up large blocks of tickets the moment they go on sale so scalpers can resell them at a markup.
 This happens even to **small or unknown events** because:

- Event data is scraped from social media and venue calendars automatically.
- Bots don’t care about the event’s brand; they attack any site with demand > supply.
- Homegrown systems are often easier to overwhelm because they lack rate-limiting or bot detection.

Even for a mid-sized local production, a scalper may attempt to buy out opening night if they think they can resell at a profit.

### **2. Credit Card Testing**

Fraudsters use bots to “test” stolen credit cards by making small or low-profile transactions.

A *new* or *custom* ticketing site is a prime target because:

- It’s less likely to have sophisticated fraud detection.
- It’s less likely to share data with major payment processors’ risk-scoring systems.
- The purchase flow can often be automated easily.

If a stolen card works, the fraudster moves on to higher-value purchases elsewhere.

### **3. Stealing Tickets to Create Chaos or Harm Competitors**

Sometimes bots buy up tickets to:

- Make an event appear sold out.
- Prevent genuine attendees from purchasing.
- Reduce attendance to sabotage the production.

This is less common but *absolutely happens*, especially with niche productions or local business rivalries.

### **4. Denial-of-Service via Cart Stuffing**

Bots don’t even need to buy the ticket — sometimes they simply:

- Add thousands of tickets to a cart,
- Never check out,
- And thereby block real customers or slow the system to a crawl.

A custom ticketing system without strong concurrency handling is especially vulnerable.

### **5. Data Harvesting and Reconnaissance**

Bots may “purchase” tickets to:

- Harvest confirmation emails,
- Discover system weaknesses,
- Enumerate your event IDs, user IDs, or purchase flows,
- Probe your payment gateway for vulnerabilities.

This often precedes fraud or a larger attack.

### **Why custom ticketing systems attract bots**

Because compared to Ticketmaster, Eventbrite, or other established platforms, your system probably:

- Has no browser challenge (Cloudflare Turnstile, hCaptcha, etc.)
- Doesn’t have device fingerprinting
- Lacks velocity checks
- Lacks behavioral bot detection
- Doesn’t have a sophisticated fraud rules engine
- Doesn’t participate in industry-wide fraud intelligence networks

Bots go where defenses are weakest.

### **Summary**

A bot would buy tickets on your system because:

**They want:**

1. Scalping profit
2. Credit card testing
3. Sabotage
4. Cart-stuffing or denial-of-service leverage
5. Data access for further attacks

**You want to prevent:**

- Fraud chargebacks
- Fake sellouts
- Angry customers
- Lost revenue
- System crashes on opening night

### Extra

- The exact **bot protections** you need (beginner → advanced)
- Code for **rate limiting** and **purchase throttling**
- Secure purchase-flow designs
- A risk assessment for your specific production launch