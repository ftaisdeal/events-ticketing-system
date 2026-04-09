export const formatCurrency = (amount: number, currency = 'USD') => {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: String(currency || 'USD').toUpperCase(),
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(Number(amount || 0));
};