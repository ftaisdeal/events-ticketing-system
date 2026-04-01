import React from 'react';

const Footer = (): JSX.Element => (
	<footer className="site-footer">
		<div className="event-card__meta" style={{ display: 'flex', alignItems: 'center' }}>
		</div>
		<div className="site-footer__inner">
			<img src="/img/stripe.png" alt="Stripe secure payment logo"/>
			Secure checkout powered by Stripe.
		</div>
	</footer>
);

export default Footer;
