import React from 'react';

const Dashboard = (): JSX.Element => (
	<section>
		<h1 className="page-title">Organizer Dashboard</h1>
		<div className="event-grid">
			<article className="panel-card">
				<h2>Event Management</h2>
				<p>Create and update events, ticket types, and capacity settings.</p>
			</article>
			<article className="panel-card">
				<h2>Check-In Workflow</h2>
				<p>Use ticket QR tools and manual check-in flows to manage entry.</p>
			</article>
			<article className="panel-card">
				<h2>Order Monitoring</h2>
				<p>Track pending reservations, confirmed purchases, and payment failures.</p>
			</article>
		</div>
	</section>
);

export default Dashboard;
