import React from 'react';

const RefundPolicy = (): JSX.Element => {
	return (
		<section>
			<h1 className="page-title">Refund Policy</h1>
			<div className="panel-card policy-page">
				<p>
					All ticket sales are final unless an event is cancelled, materially rescheduled, or the refund is otherwise required by law.
				</p>
				<h2>Cancelled Events</h2>
				<p>
					If an event is cancelled and not rescheduled, the original purchaser will receive a refund to the original payment method.
				</p>
				<h2>Rescheduled Events</h2>
				<p>
					If an event is rescheduled, tickets will generally remain valid for the new date. If the organizer authorizes refunds, instructions will be provided to the original purchaser.
				</p>
				<h2>Non-Refundable Charges</h2>
				<p>
					Stripe processing fees may be non-refundable once a payment has been successfully processed, unless required otherwise by the organizer or applicable law.
				</p>
				<h2>Requesting Help</h2>
				<p>
					If you believe there has been an error with your order, contact customer support and include your order number so the team can review the request.
				</p>
			</div>
		</section>
	);
};

export default RefundPolicy;