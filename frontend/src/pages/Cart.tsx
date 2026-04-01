import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '../utils/api';
import { clearStoredCart, readStoredCart, StoredCart, StoredCartItem, writeStoredCart } from '../utils/cartStorage';

type CartEventTicketType = {
	id: number;
	name: string;
	price: number;
	quantity: number;
	quantitySold: number;
};

type CartEventSummary = {
	id: number;
	title: string;
	startDateTime: string;
	endDateTime: string;
	venue?: {
		name?: string;
		address?: string;
		city?: string;
		state?: string;
		postalCode?: string;
	};
	ticketTypes?: CartEventTicketType[];
};

const MAX_CART_TICKETS = 5;

const Cart = (): JSX.Element => {
	const navigate = useNavigate();
	const [cart, setCart] = useState<StoredCart>(() => readStoredCart());
	const [eventSummary, setEventSummary] = useState<CartEventSummary | null>(null);
	const [isLoadingEvent, setIsLoadingEvent] = useState(false);

	const totalUnits = useMemo(
		() => cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
		[cart.items]
	);

	const cartDisplayItems = useMemo(() => {
		const ticketTypes = eventSummary?.ticketTypes || [];

		return cart.items.map((item) => {
			const ticketType = ticketTypes.find((candidate) => candidate.id === item.ticketTypeId);
			const available = ticketType
				? Math.max(0, Number(ticketType.quantity || 0) - Number(ticketType.quantitySold || 0))
				: 0;
			const maxQuantityByInventory = Math.max(Number(item.quantity || 1), available || 1);
			const maxQuantityByCartLimit = Number(item.quantity || 0) + Math.max(0, MAX_CART_TICKETS - totalUnits);
			const maxQuantity = Math.min(maxQuantityByInventory, maxQuantityByCartLimit);

			return {
				...item,
				name: ticketType?.name || `Ticket #${item.ticketTypeId}`,
				price: Number(ticketType?.price || 0),
				available,
				maxQuantity,
				maxQuantityByInventory
			};
		});
	}, [cart.items, eventSummary?.ticketTypes, totalUnits]);

	const totalAmount = useMemo(
		() => cartDisplayItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0),
		[cartDisplayItems]
	);

	useEffect(() => {
		let active = true;

		const loadEventSummary = async () => {
			if (!cart.eventId) {
				if (active) {
					setEventSummary(null);
				}
				return;
			}

			setIsLoadingEvent(true);
			try {
				const response = await api.get('/events?limit=500');
				if (!active) {
					return;
				}

				const events = (response.data.events || []) as CartEventSummary[];
				setEventSummary(events.find((event) => event.id === cart.eventId) || null);
			} catch (_error) {
				if (active) {
					setEventSummary(null);
				}
			} finally {
				if (active) {
					setIsLoadingEvent(false);
				}
			}
		};

		loadEventSummary();

		return () => {
			active = false;
		};
	}, [cart.eventId]);

	const formatEventRange = (startDateTime: string, endDateTime: string): string => {
		const start = new Date(startDateTime);
		const end = new Date(endDateTime);

		const date = start.toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		});

		const startTimeWithMeridiem = start.toLocaleTimeString(undefined, {
			hour: 'numeric',
			minute: '2-digit'
		});

		const endTimeWithMeridiem = end.toLocaleTimeString(undefined, {
			hour: 'numeric',
			minute: '2-digit'
		});

		const startTime = startTimeWithMeridiem.replace(/\s?[AP]M$/i, '');
		const endTime = endTimeWithMeridiem.replace(/\s?([AP]M)$/i, '$1').toUpperCase();

		return `${date}, ${startTime}-${endTime}`;
	};

	const persistCart = (nextEventId: number, nextItems: StoredCartItem[]) => {
		writeStoredCart(nextEventId, nextItems);
	};

	const updateCartItems = (nextItems: StoredCartItem[]) => {
		const sanitizedItems = nextItems
			.map((item) => ({
				ticketTypeId: Number(item.ticketTypeId) || 0,
				quantity: Number(item.quantity) || 0
			}))
			.filter((item) => item.ticketTypeId > 0 && item.quantity > 0);

		if (sanitizedItems.length === 0) {
			onClearCart();
			return;
		}

		setCart({ eventId: cart.eventId, items: sanitizedItems });
		persistCart(cart.eventId, sanitizedItems);
	};

	const adjustItemQuantity = (ticketTypeId: number, requestedQuantity: number, maxQuantityByInventory: number) => {
		if (!Number.isFinite(requestedQuantity)) {
			return;
		}

		const currentItem = cart.items.find((item) => item.ticketTypeId === ticketTypeId);
		if (!currentItem) {
			return;
		}

		const totalWithoutItem = totalUnits - Number(currentItem.quantity || 0);
		const maxQuantityByCartLimit = Math.max(0, MAX_CART_TICKETS - totalWithoutItem);
		const maxQuantity = Math.min(maxQuantityByInventory, maxQuantityByCartLimit);

		const normalizedQuantity = Math.max(0, Math.min(Math.floor(requestedQuantity), maxQuantity));

		if (normalizedQuantity < 1) {
			updateCartItems(cart.items.filter((item) => item.ticketTypeId !== ticketTypeId));
			return;
		}

		updateCartItems(
			cart.items.map((item) =>
				item.ticketTypeId === ticketTypeId ? { ...item, quantity: normalizedQuantity } : item
			)
		);
	};

	const onClearCart = () => {
		setCart({ eventId: 0, items: [] });
		setEventSummary(null);
		clearStoredCart();
	};

	const onProceedToCheckout = () => {
		if (totalUnits > MAX_CART_TICKETS) {
			return;
		}

		persistCart(cart.eventId, cart.items);
		navigate('/checkout');
	};

	const venueName = eventSummary?.venue?.name || 'TBA';
	const venueStreet = eventSummary?.venue?.address || '';
	const venueCityStateZip = [
		eventSummary?.venue?.city || '',
		eventSummary?.venue?.state || ''
	].filter(Boolean).join(', ') + `${eventSummary?.venue?.postalCode ? ` ${eventSummary.venue.postalCode}` : ''}`;
	const isOverTicketLimit = totalUnits > MAX_CART_TICKETS;

	return (
		<section>
			<h1 className="page-title">Your Cart</h1>
			{cart.items.length === 0 ? <p>No items in cart.</p> : null}

			{cart.items.length > 0 ? (
				<div className="panel-card form-stack" style={{ marginBottom: 12 }}>
					<h3 style={{ marginBottom: 4 }}>{eventSummary?.title || (isLoadingEvent ? 'Loading...' : 'Unknown event')}</h3>
					<p>{eventSummary ? formatEventRange(eventSummary.startDateTime, eventSummary.endDateTime) : 'TBA'}</p>
					<div className="event-card__meta">
						<p style={{ margin: 0 }}>{venueName}</p>
						{venueStreet ? <p style={{ margin: 0 }}>{venueStreet}</p> : null}
						{venueCityStateZip ? <p style={{ margin: 0 }}>{venueCityStateZip}</p> : null}
					</div>
					<div className="form-stack" style={{ marginTop: 6 }}>
						{cartDisplayItems.map((item) => (
							<div className="line-item-row" key={item.ticketTypeId}>
								<div>
									<p style={{ margin: 0, fontWeight: 700 }}>{item.name}</p>
									<p className="event-card__meta" style={{ margin: 0 }}>
										${item.price.toFixed(2)} each
									</p>
								</div>
								<div className="cart-item-controls">
									<input
										type="number"
										min={0}
										max={item.maxQuantity}
										value={item.quantity}
										onChange={(eventInput) => adjustItemQuantity(item.ticketTypeId, Number(eventInput.target.value), item.maxQuantityByInventory)}
										className="cart-qty-input"
										aria-label={`Quantity for ${item.name}`}
									/>
									<button
										type="button"
										className="action-btn action-btn--ghost"
										onClick={() => adjustItemQuantity(item.ticketTypeId, 0, item.maxQuantityByInventory)}
									>
										Remove
									</button>
								</div>
							</div>
						))}
					</div>
					{isOverTicketLimit ? (
						<p className="error-text" style={{ margin: 0 }}>
							Maximum {MAX_CART_TICKETS} tickets per order. Reduce quantity to continue.
						</p>
					) : null}
					<p>{totalUnits} ticket{totalUnits === 1 ? '' : 's'}</p>
					<p style={{ marginTop: 0, marginBottom: 0, fontWeight: 700 }}>Total: ${totalAmount.toFixed(2)}</p>
				</div>
			) : null}

			{cart.items.length > 0 ? (
				<div className="inline-actions">
					<button className="action-btn action-btn--primary" type="button" onClick={onProceedToCheckout} disabled={!cart.eventId || isOverTicketLimit}>
						Proceed to Checkout
					</button>
					<button className="action-btn action-btn--ghost" type="button" onClick={onClearCart}>
						Clear Cart
					</button>
				</div>
			) : null}
		</section>
	);
};

export default Cart;
