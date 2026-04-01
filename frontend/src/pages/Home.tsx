import React from 'react';
import { Link } from 'react-router-dom';

const Home = (): JSX.Element => (
	<section className="hero">
		<div className="hero__content">
			<p className="eyebrow">RDX Theater</p>
			<h1>RDX Theater</h1>
			<p>
				Tickets to our fantastic shows in the San Francisco Bay Area.
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
				<h2>Card 1</h2>
				<p>Card 1 content</p>
			</article>
			<article className="stat-card">
				<h2>Card 2</h2>
				<p>Card 2 content</p>
			</article>
			<article className="stat-card">
				<h2>Card 3</h2>
				<p>Card 3 content</p>
			</article>
		</div>

		<img src="/img/stripe.png" alt="Stripe logo" />
	</section>
);

export default Home;
