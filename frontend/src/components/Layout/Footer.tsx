import React from 'react';
import { Link } from 'react-router-dom';

const Footer = (): JSX.Element => (
	<footer className="site-footer">
		<div className="site-footer__inner">
			<div className="site-footer__branding">
				<a
					href="https://stripe.com"
					target="_blank"
					rel="noreferrer"
					className="site-footer__brand-link"
					aria-label="Visit Stripe"
				>
					<img src="/img/stripe.png" alt="Stripe secure payment logo" />
				</a>
				<div className="site-footer__content">
					<Link to="/refund-policy" className="site-footer__link">Refund Policy</Link>
					<Link to="/support" className="site-footer__link">Customer Support</Link>
					<span className="site-footer__text">Secure checkout powered by Stripe.</span>
				</div>
			</div>
		</div>
	</footer>
);

export default Footer;
