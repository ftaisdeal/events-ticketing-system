import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CartItem } from '../utils/checkoutApi';

const cartStorageKey = 'ticketing_cart';

type StoredCart = {
	eventId: number;
	items: CartItem[];
};

const parseStoredCart = (): StoredCart => {
	const raw = localStorage.getItem(cartStorageKey);
	if (!raw) {
		return { eventId: 0, items: [] };
	}

	try {
		const parsed = JSON.parse(raw) as StoredCart;
		return {
			eventId: Number(parsed.eventId) || 0,
			items: Array.isArray(parsed.items) ? parsed.items : []
		};
	} catch (_error) {
		return { eventId: 0, items: [] };
	}
};

const Cart = (): JSX.Element => {
	const navigate = useNavigate();
	const [eventId, setEventId] = useState<number>(() => parseStoredCart().eventId);
	const [ticketTypeId, setTicketTypeId] = useState<number>(0);
	const [quantity, setQuantity] = useState<number>(1);
	const [items, setItems] = useState<CartItem[]>(() => parseStoredCart().items);

	const totalUnits = useMemo(
		() => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
		[items]
	);

	const persistCart = (nextEventId: number, nextItems: CartItem[]) => {
		localStorage.setItem(cartStorageKey, JSON.stringify({ eventId: nextEventId, items: nextItems }));
	};

	const onAddItem = () => {
		if (!eventId || !ticketTypeId || quantity < 1) {
			return;
		}

		const existingIndex = items.findIndex((item) => item.ticketTypeId === ticketTypeId);
		let nextItems: CartItem[];

		if (existingIndex >= 0) {
			nextItems = items.map((item, index) => {
				if (index !== existingIndex) {
					return item;
				}
				return {
					...item,
					quantity: item.quantity + quantity
				};
			});
		} else {
			nextItems = [...items, { ticketTypeId, quantity }];
		}

		setItems(nextItems);
		persistCart(eventId, nextItems);
		setTicketTypeId(0);
		setQuantity(1);
	};

	const onRemoveItem = (removeTicketTypeId: number) => {
		const nextItems = items.filter((item) => item.ticketTypeId !== removeTicketTypeId);
		setItems(nextItems);
		persistCart(eventId, nextItems);
	};

	const onClearCart = () => {
		setItems([]);
		localStorage.removeItem(cartStorageKey);
	};

	const onProceedToCheckout = () => {
		persistCart(eventId, items);
		navigate('/checkout');
	};

	return (
		<section>
			<h1 className="page-title">Your Cart</h1>
			<p>Build your reservation payload with event and ticket type IDs from your seeded data.</p>

			<div className="panel-card form-stack">
				<label htmlFor="eventId">
					Event ID
					<input
						id="eventId"
						type="number"
						min={1}
						value={eventId || ''}
						onChange={(e) => setEventId(Number(e.target.value))}
					/>
				</label>

				<label htmlFor="ticketTypeId">
					Ticket Type ID
					<input
						id="ticketTypeId"
						type="number"
						min={1}
						value={ticketTypeId || ''}
						onChange={(e) => setTicketTypeId(Number(e.target.value))}
					/>
				</label>

				<label htmlFor="quantity">
					Quantity
					<input
						id="quantity"
						type="number"
						min={1}
						value={quantity}
						onChange={(e) => setQuantity(Number(e.target.value))}
					/>
				</label>

				<button className="action-btn action-btn--primary" type="button" onClick={onAddItem}>
					Add Item
				</button>
			</div>

			<h2 style={{ marginTop: 24 }}>Items ({totalUnits})</h2>
			{items.length === 0 ? <p>No items in cart.</p> : null}

			{items.map((item) => (
				<div key={item.ticketTypeId} className="line-item-row">
					<span>
						Ticket Type #{item.ticketTypeId} x {item.quantity}
					</span>
					<button className="action-btn action-btn--ghost" type="button" onClick={() => onRemoveItem(item.ticketTypeId)}>
						Remove
					</button>
				</div>
			))}

			<div className="inline-actions">
				<button className="action-btn action-btn--primary" type="button" onClick={onProceedToCheckout} disabled={!eventId || items.length === 0}>
					Proceed to Checkout
				</button>
				<button className="action-btn action-btn--ghost" type="button" onClick={onClearCart} disabled={items.length === 0}>
					Clear Cart
				</button>
			</div>
		</section>
	);
};

export default Cart;
