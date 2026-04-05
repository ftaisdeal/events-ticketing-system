import React, { FormEvent, useState } from 'react';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';

type StripePaymentFormProps = {
	clientSecret: string;
	onSuccess: (paymentIntentId: string, status: string) => void;
	disabled?: boolean;
};

const cardElementOptions = {
	style: {
		base: {
			fontFamily: 'Verdana, Arial, Helvetica, sans-serif',
			fontSize: '16px',
			color: '#1e1a16',
			'::placeholder': {
				color: '#6f665f'
			}
		},
		invalid: {
			color: '#bf2f2f'
		}
	}
} as const;

const StripePaymentForm = ({ clientSecret, onSuccess, disabled = false }: StripePaymentFormProps): JSX.Element => {
	const stripe = useStripe();
	const elements = useElements();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState('');

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError('');

		if (disabled) {
			return;
		}

		if (!stripe || !elements) {
			setError('Secure payment form is still loading. Try again in a moment.');
			return;
		}

		const cardElement = elements.getElement(CardElement);
		if (!cardElement) {
			setError('Payment field is unavailable. Refresh and try again.');
			return;
		}

		setIsSubmitting(true);

		try {
			const result = await stripe.confirmCardPayment(clientSecret, {
				payment_method: {
					card: cardElement
				}
			});

			if (result.error) {
				setError(result.error.message || 'Payment could not be completed.');
				return;
			}

			if (result.paymentIntent) {
				onSuccess(result.paymentIntent.id, result.paymentIntent.status);
				return;
			}

			setError('Payment response was incomplete. Please try again.');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form className="payment-form" onSubmit={handleSubmit}>
			<label>
				Card details
				<div className="payment-field-shell">
					<CardElement options={cardElementOptions} />
				</div>
			</label>
			<button className="action-btn action-btn--primary" type="submit" disabled={disabled || isSubmitting || !stripe || !elements}>
				{isSubmitting ? 'Confirming Payment...' : 'Pay Now'}
			</button>
			{error ? <p className="error-text payment-status-text">{error}</p> : null}
		</form>
	);
};

export default StripePaymentForm;