export const CART_STORAGE_KEY = 'ticketing_cart';
export const CART_UPDATED_EVENT = 'cartUpdated';

export type StoredCartItem = {
	ticketTypeId: number;
	quantity: number;
};

export type StoredCart = {
	eventId: number;
	items: StoredCartItem[];
};

const dispatchCartUpdated = () => {
	window.dispatchEvent(new Event(CART_UPDATED_EVENT));
};

export const readStoredCart = (): StoredCart => {
	const raw = localStorage.getItem(CART_STORAGE_KEY);
	if (!raw) {
		return { eventId: 0, items: [] };
	}

	try {
		const parsed = JSON.parse(raw) as StoredCart;
		return {
			eventId: Number(parsed.eventId) || 0,
			items: Array.isArray(parsed.items)
				? parsed.items
						.map((item) => ({
							ticketTypeId: Number(item.ticketTypeId) || 0,
							quantity: Number(item.quantity) || 0
						}))
						.filter((item) => item.ticketTypeId > 0 && item.quantity > 0)
				: []
		};
	} catch (_error) {
		return { eventId: 0, items: [] };
	}
};

export const writeStoredCart = (eventId: number, items: StoredCartItem[]) => {
	localStorage.setItem(
		CART_STORAGE_KEY,
		JSON.stringify({
			eventId,
			items
		})
	);
	dispatchCartUpdated();
};

export const clearStoredCart = () => {
	localStorage.removeItem(CART_STORAGE_KEY);
	dispatchCartUpdated();
};

export const hasStoredCartItems = (): boolean => {
	const cart = readStoredCart();
	return cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) > 0;
};