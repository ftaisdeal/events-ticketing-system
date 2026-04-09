import React from 'react';

const CustomerSupport = (): JSX.Element => {
	return (
		<section>
			<h1 className="page-title">Customer Support</h1>
			<div className="panel-card policy-page">
				<p>
					For help with ticket access, order issues, or event questions, contact the support team and include your order number whenever possible.
				</p>
				<h2>Email</h2>
				<p>
					<a href="mailto:support@rdx.theater">support@rdx.theater</a>
				</p>
				<h2>Response Time</h2>
				<p>
					Support requests are typically answered within one to two business days. Response times may be longer on weekends, holidays, or on the day of a major event.
				</p>
				<h2>Include</h2>
				<p>
					Please include your full name, the email used for the order, the event name, and your order number so support can respond efficiently.
				</p>
			</div>
		</section>
	);
};

export default CustomerSupport;