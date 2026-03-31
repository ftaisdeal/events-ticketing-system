import React from 'react';
import { Link } from 'react-router-dom';

const Home = (): JSX.Element => (
	<section className="hero">
		<div className="hero__content">
			<p className="eyebrow">Live Experiences Platform</p>
			<h1>Live Loud. Book Fast.</h1>
			<p>
				Browse local shows, reserve inventory instantly, and checkout with a payment flow that stays in sync.
			</p>
			<div className="hero__actions">
				<Link to="/events" className="action-btn action-btn--primary">
					Explore Events
				</Link>
				<Link to="/register" className="action-btn action-btn--ghost">
					Create Account
				</Link>
			</div>
		</div>

		<div className="hero__stats">
			<article className="stat-card">
				<h2>Real-Time Holds</h2>
				<p>Reserve seats for a limited window to prevent overselling.</p>
			</article>
			<article className="stat-card">
				<h2>Order Safety</h2>
				<p>Payment state and ticket issuance are tied to webhook events.</p>
			</article>
			<article className="stat-card">
				<h2>Organizer Ready</h2>
				<p>Built for dashboards, check-in flows, and event operations.</p>
			</article>
		</div>
	</section>
);

export default Home;
