const DEFAULT_STRIPE_FEE_PERCENT = 0.029;
const DEFAULT_STRIPE_FEE_FIXED = 0.3;

const normalizePercent = (value: string | undefined, fallback: number) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 1) {
		return fallback;
	}
	return parsed;
};

const normalizeAmount = (value: string | undefined, fallback: number) => {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) {
		return fallback;
	}
	return parsed;
};

export const stripeFeePercent = normalizePercent(process.env.STRIPE_FEE_PERCENT, DEFAULT_STRIPE_FEE_PERCENT);
export const stripeFeeFixed = normalizeAmount(process.env.STRIPE_FEE_FIXED, DEFAULT_STRIPE_FEE_FIXED);

export const toCents = (amount: number) => Math.max(0, Math.round(Number(amount || 0) * 100));

export const fromCents = (amountInCents: number) => Math.max(0, amountInCents) / 100;

export type PricingBreakdown = {
	subtotal: number;
	processingFee: number;
	totalAmount: number;
	feePercent: number;
	feeFixed: number;
	includesProcessingFee: boolean;
};

export const calculateGrossOrderPricing = (subtotal: number): PricingBreakdown => {
	const subtotalInCents = toCents(subtotal);
	const fixedFeeInCents = toCents(stripeFeeFixed);
	const includesProcessingFee = stripeFeePercent > 0 || fixedFeeInCents > 0;

	if (subtotalInCents <= 0 || !includesProcessingFee) {
		return {
			subtotal: fromCents(subtotalInCents),
			processingFee: 0,
			totalAmount: fromCents(subtotalInCents),
			feePercent: stripeFeePercent,
			feeFixed: stripeFeeFixed,
			includesProcessingFee
		};
	}

	const grossInCents = Math.ceil((subtotalInCents + fixedFeeInCents) / (1 - stripeFeePercent));
	const processingFeeInCents = Math.max(0, grossInCents - subtotalInCents);

	return {
		subtotal: fromCents(subtotalInCents),
		processingFee: fromCents(processingFeeInCents),
		totalAmount: fromCents(grossInCents),
		feePercent: stripeFeePercent,
		feeFixed: stripeFeeFixed,
		includesProcessingFee
	};
};