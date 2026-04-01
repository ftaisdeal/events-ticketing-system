import axios from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../contexts/AuthContext';
import { api, getAuthHeader } from '../../utils/api';

type CategoryOption = {
	id: number;
	name: string;
	slug: string;
};

type VenueOption = {
	id: number;
	name: string;
	city: string;
	country: string;
};

type EditableTicketType = {
	id: number;
	name: string;
	price: number;
	quantity: number;
	isActive?: boolean;
	quantitySold?: number;
};

type EditableEvent = {
	id: number;
	title: string;
	slug: string;
	description: string;
	shortDescription?: string | null;
	startDateTime: string;
	endDateTime: string;
	timezone?: string | null;
	status: 'draft' | 'published';
	categoryId?: number | null;
	venueId?: number | null;
	maxCapacity?: number | null;
	ticketTypes?: EditableTicketType[];
};

type ManagedEvent = {
	id: number;
	title: string;
	slug: string;
	status: string;
	startDateTime: string;
	endDateTime: string;
	ticketsSold: number;
};

const formatEventRange = (startDateTime: string, endDateTime: string): string => {
	const start = new Date(startDateTime);
	const end = new Date(endDateTime);

	const date = start.toLocaleDateString(undefined, {
		weekday: 'long',
		month: 'long',
		day: 'numeric',
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

const Dashboard = (): JSX.Element => {
	const [searchParams, setSearchParams] = useSearchParams();
	const { token, user } = useAuth();
	const [categories, setCategories] = useState<CategoryOption[]>([]);
	const [venues, setVenues] = useState<VenueOption[]>([]);
	const [managedEvents, setManagedEvents] = useState<ManagedEvent[]>([]);
	const [isLoadingManagedEvents, setIsLoadingManagedEvents] = useState(true);
	const [title, setTitle] = useState('');
	const [shortDescription, setShortDescription] = useState('');
	const [description, setDescription] = useState('');
	const [startDateTime, setStartDateTime] = useState('');
	const [endDateTime, setEndDateTime] = useState('');
	const [timezone, setTimezone] = useState('UTC');
	const [status, setStatus] = useState<'draft' | 'published'>('draft');
	const [categoryId, setCategoryId] = useState('');
	const [venueId, setVenueId] = useState('');
	const [maxCapacity, setMaxCapacity] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isLoadingOptions, setIsLoadingOptions] = useState(true);
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [ticketTypeId, setTicketTypeId] = useState<number | null>(null);
	const [ticketTypeName, setTicketTypeName] = useState('General Admission');
	const [ticketTypePrice, setTicketTypePrice] = useState('25');
	const [ticketTypeQuantity, setTicketTypeQuantity] = useState('100');
	const [showCreateEventForm, setShowCreateEventForm] = useState(false);
	const [editingEventId, setEditingEventId] = useState<number | null>(null);
	const [isLoadingEditEvent, setIsLoadingEditEvent] = useState(false);

	const browserTimezone = useMemo(() => {
		try {
			return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
		} catch (_error) {
			return 'UTC';
		}
	}, []);

	useEffect(() => {
		setTimezone(browserTimezone);
	}, [browserTimezone]);

	const loadManagedEvents = useCallback(async () => {
		if (!token) {
			setManagedEvents([]);
			setIsLoadingManagedEvents(false);
			return;
		}

		setIsLoadingManagedEvents(true);
		try {
			const response = await api.get('/events/manage/events', {
				headers: getAuthHeader(token)
			});
			setManagedEvents((response.data.events || []) as ManagedEvent[]);
		} catch (_loadError) {
			setManagedEvents([]);
		} finally {
			setIsLoadingManagedEvents(false);
		}
	}, [token]);

	useEffect(() => {
		loadManagedEvents();
	}, [loadManagedEvents]);

	useEffect(() => {
		let active = true;

		const loadOptions = async () => {
			if (!token) {
				return;
			}

			setIsLoadingOptions(true);
			setError('');

			try {
				const response = await api.get('/events/meta/options', {
					headers: getAuthHeader(token)
				});

				if (!active) {
					return;
				}

				setCategories((response.data.categories || []) as CategoryOption[]);
				setVenues((response.data.venues || []) as VenueOption[]);
			} catch (loadError) {
				if (!active) {
					return;
				}

				if (axios.isAxiosError(loadError)) {
					const message =
						(loadError.response?.data as { message?: string } | undefined)?.message ||
						'Unable to load event options';
					setError(message);
				} else {
					setError('Unable to load event options');
				}
			} finally {
				if (active) {
					setIsLoadingOptions(false);
				}
			}
		};

		loadOptions();

		return () => {
			active = false;
		};
	}, [token]);

	const resetForm = () => {
		setTitle('');
		setShortDescription('');
		setDescription('');
		setStartDateTime('');
		setEndDateTime('');
		setStatus('draft');
		setCategoryId('');
		setVenueId('');
		setMaxCapacity('');
		setTimezone(browserTimezone);
		setTicketTypeId(null);
		setTicketTypeName('General Admission');
		setTicketTypePrice('25');
		setTicketTypeQuantity('100');
	};

	const formatDateTimeForInput = (value: string): string => {
		const parsed = new Date(value);
		if (Number.isNaN(parsed.getTime())) {
			return '';
		}

		const offsetMs = parsed.getTimezoneOffset() * 60000;
		const local = new Date(parsed.getTime() - offsetMs);
		return local.toISOString().slice(0, 16);
	};

	const clearEditMode = () => {
		setEditingEventId(null);
		setSearchParams({});
	};

	useEffect(() => {
		const mode = searchParams.get('mode');
		const eventIdValue = searchParams.get('eventId');

		if (mode !== 'edit' || !eventIdValue) {
			return;
		}

		const parsedEventId = Number(eventIdValue);
		if (!Number.isInteger(parsedEventId) || parsedEventId < 1 || !token) {
			return;
		}

		let active = true;
		const loadEditEvent = async () => {
			setIsLoadingEditEvent(true);
			setError('');
			setSuccess('');

			try {
				const response = await api.get(`/events/manage/events/${parsedEventId}`, {
					headers: getAuthHeader(token)
				});

				if (!active) {
					return;
				}

				const event = response.data.event as EditableEvent;
				setEditingEventId(event.id);
				setTitle(event.title || '');
				setShortDescription(event.shortDescription || '');
				setDescription(event.description || '');
				setStartDateTime(formatDateTimeForInput(event.startDateTime));
				setEndDateTime(formatDateTimeForInput(event.endDateTime));
				setTimezone(event.timezone || 'UTC');
				setStatus(event.status || 'draft');
				setCategoryId(event.categoryId ? String(event.categoryId) : '');
				setVenueId(event.venueId ? String(event.venueId) : '');
				setMaxCapacity(event.maxCapacity ? String(event.maxCapacity) : '');

				const firstTicketType = event.ticketTypes?.[0];
				if (firstTicketType) {
					setTicketTypeId(firstTicketType.id);
					setTicketTypeName(firstTicketType.name || 'General Admission');
					setTicketTypePrice(String(firstTicketType.price ?? 25));
					setTicketTypeQuantity(String(firstTicketType.quantity ?? 100));
				} else {
					setTicketTypeId(null);
					setTicketTypeName('General Admission');
					setTicketTypePrice('25');
					setTicketTypeQuantity('100');
				}

				setShowCreateEventForm(true);
			} catch (loadError) {
				if (!active) {
					return;
				}

				if (axios.isAxiosError(loadError)) {
					const message =
						(loadError.response?.data as { message?: string } | undefined)?.message || 'Unable to load event for editing';
					setError(message);
				} else {
					setError('Unable to load event for editing');
				}
			} finally {
				if (active) {
					setIsLoadingEditEvent(false);
				}
			}
		};

		loadEditEvent();

		return () => {
			active = false;
		};
	}, [searchParams, token]);

	const onSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!token) {
			setError('You are not authenticated');
			return;
		}

		setIsSubmitting(true);
		setError('');
		setSuccess('');

		try {
			const method = editingEventId ? 'put' : 'post';
			const endpoint = editingEventId ? `/events/${editingEventId}` : '/events';
			const response = await api.request({
				method,
				url: endpoint,
				headers: getAuthHeader(token),
				data: {
					title,
					shortDescription: shortDescription || null,
					description,
					startDateTime,
					endDateTime,
					timezone,
					status,
					categoryId: categoryId ? Number(categoryId) : null,
					venueId: venueId ? Number(venueId) : null,
					maxCapacity: maxCapacity ? Number(maxCapacity) : null
				}
			});

			const eventPayload = response.data.event as EditableEvent;
			const savedEventId = Number(eventPayload.id);
			if (!Number.isInteger(savedEventId) || savedEventId < 1) {
				throw new Error('Invalid event id returned from server');
			}

			const ticketPayload = {
				name: ticketTypeName,
				price: Number(ticketTypePrice),
				quantity: Number(ticketTypeQuantity)
			};

			if (editingEventId && ticketTypeId) {
				await api.put(`/events/${savedEventId}/ticket-types/${ticketTypeId}`, ticketPayload, {
					headers: getAuthHeader(token)
				});
			} else {
				const ticketResponse = await api.post(`/events/${savedEventId}/ticket-types`, ticketPayload, {
					headers: getAuthHeader(token)
				});
				const createdTicket = ticketResponse.data.ticketType as EditableTicketType;
				if (createdTicket?.id) {
					setTicketTypeId(createdTicket.id);
				}
			}

			setSuccess(
				editingEventId
					? `Event and ticket details for \"${eventPayload.title}\" updated successfully.`
					: `Event and ticket details for \"${eventPayload.title}\" created successfully.`
			);

			if (editingEventId) {
				clearEditMode();
				setShowCreateEventForm(false);
			} else {
				setEditingEventId(savedEventId);
				setSearchParams({ mode: 'edit', eventId: String(savedEventId) });
			}

			resetForm();
			await loadManagedEvents();
		} catch (submitError) {
			if (axios.isAxiosError(submitError)) {
				const payload = submitError.response?.data as { message?: string; errors?: Array<{ msg: string }> } | undefined;
				const validationMessage = payload?.errors?.[0]?.msg;
				setError(validationMessage || payload?.message || 'Failed to create event');
			} else {
				setError('Failed to create event');
			}
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<section>
			<h1 className="page-title">{user?.role === 'admin' ? 'Admin Dashboard' : 'Organizer Dashboard'}</h1>

			<article className="panel-card" style={{ marginBottom: 16 }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
					<h2 style={{ margin: 0 }}>All Events</h2>
					<button
						type="button"
						className="action-btn action-btn--primary"
						onClick={() => {
							setShowCreateEventForm((current) => {
								const next = !current;
								if (!next) {
									clearEditMode();
									resetForm();
									setEditingEventId(null);
								}
								return next;
							});
						}}
					>
						{showCreateEventForm ? 'Hide Create Event' : 'Create New Event'}
					</button>
				</div>

				{isLoadingEditEvent ? <p>Loading event editor...</p> : null}

				{isLoadingManagedEvents ? <p>Loading events...</p> : null}
				{!isLoadingManagedEvents && managedEvents.length === 0 ? <p>No events found yet.</p> : null}

				{managedEvents.map((eventItem) => (
					<div className="line-item-row" key={eventItem.id}>
						<div>
							<strong>{eventItem.title}</strong>
							<p className="event-card__meta" style={{ margin: 0 }}>
								Status: {eventItem.status} | {formatEventRange(eventItem.startDateTime, eventItem.endDateTime)}
							</p>
						</div>
						<div>
							<p style={{ margin: 0 }}>
								<strong>Tickets Sold:</strong> {eventItem.ticketsSold}
							</p>
							<p style={{ margin: 0 }}>
								<Link to={`/events/${eventItem.slug}`}>view</Link>
								{' | '}
								<Link to={`/dashboard?mode=edit&eventId=${eventItem.id}`}>edit</Link>
							</p>
						</div>
					</div>
				))}
			</article>

			{showCreateEventForm ? (
				<div className="event-grid">
					<article className="panel-card">
						<h2>{editingEventId ? 'Edit Event' : 'Create Event'}</h2>
						<p>Use one form to manage both event details and ticket details.</p>

						<form className="auth-card" onSubmit={onSubmit}>
							<label htmlFor="event-title">
								Title
								<input
									id="event-title"
									type="text"
									value={title}
									onChange={(eventInput) => setTitle(eventInput.target.value)}
									required
								/>
							</label>

							<label htmlFor="event-short-description">
								Short Description (optional)
								<input
									id="event-short-description"
									type="text"
									value={shortDescription}
									onChange={(eventInput) => setShortDescription(eventInput.target.value)}
									maxLength={500}
								/>
							</label>

							<label htmlFor="event-description">
								Description
								<textarea
									id="event-description"
									rows={5}
									value={description}
									onChange={(eventInput) => setDescription(eventInput.target.value)}
									required
								/>
							</label>

							<div className="grid-two">
								<label htmlFor="event-start">
									Start
									<input
										id="event-start"
										type="datetime-local"
										value={startDateTime}
										onChange={(eventInput) => setStartDateTime(eventInput.target.value)}
										required
									/>
								</label>

								<label htmlFor="event-end">
									End
									<input
										id="event-end"
										type="datetime-local"
										value={endDateTime}
										onChange={(eventInput) => setEndDateTime(eventInput.target.value)}
										required
									/>
								</label>
							</div>

							<div className="grid-two">
								<label htmlFor="event-timezone">
									Timezone
									<input
										id="event-timezone"
										type="text"
										value={timezone}
										onChange={(eventInput) => setTimezone(eventInput.target.value)}
									/>
								</label>

								<label htmlFor="event-status">
									Status
									<select
										id="event-status"
										value={status}
										onChange={(eventInput) => setStatus(eventInput.target.value as 'draft' | 'published')}
									>
										<option value="draft">draft</option>
										<option value="published">published</option>
									</select>
								</label>
							</div>

							<div className="grid-two">
								<label htmlFor="event-category">
									Category
									<select
										id="event-category"
										value={categoryId}
										onChange={(eventInput) => setCategoryId(eventInput.target.value)}
										disabled={isLoadingOptions}
									>
										<option value="">No category</option>
										{categories.map((category) => (
											<option key={category.id} value={String(category.id)}>
												{category.name}
											</option>
										))}
									</select>
								</label>

								<label htmlFor="event-venue">
									Venue
									<select
										id="event-venue"
										value={venueId}
										onChange={(eventInput) => setVenueId(eventInput.target.value)}
										disabled={isLoadingOptions}
									>
										<option value="">No venue</option>
										{venues.map((venue) => (
											<option key={venue.id} value={String(venue.id)}>
												{venue.name} ({venue.city}, {venue.country})
											</option>
										))}
									</select>
								</label>
							</div>

							<label htmlFor="event-capacity">
								Max Capacity (optional)
								<input
									id="event-capacity"
									type="number"
									min={1}
									value={maxCapacity}
									onChange={(eventInput) => setMaxCapacity(eventInput.target.value)}
								/>
							</label>

							<h3 style={{ marginBottom: 0 }}>Ticket Details</h3>
							<div className="grid-two">
								<label htmlFor="ticket-type-name">
									Ticket Type Name
									<input
										id="ticket-type-name"
										type="text"
										value={ticketTypeName}
										onChange={(eventInput) => setTicketTypeName(eventInput.target.value)}
										required
									/>
								</label>

								<label htmlFor="ticket-type-price">
									Price
									<input
										id="ticket-type-price"
										type="number"
										min={0.01}
										step={0.01}
										value={ticketTypePrice}
										onChange={(eventInput) => setTicketTypePrice(eventInput.target.value)}
										required
									/>
								</label>
							</div>

							<label htmlFor="ticket-type-quantity">
								Quantity
								<input
									id="ticket-type-quantity"
									type="number"
									min={1}
									value={ticketTypeQuantity}
									onChange={(eventInput) => setTicketTypeQuantity(eventInput.target.value)}
									required
								/>
							</label>

							{error ? <p className="error-text">{error}</p> : null}
							{success ? <p>{success}</p> : null}

							<button className="action-btn action-btn--primary" type="submit" disabled={isSubmitting || isLoadingOptions}>
								{isSubmitting ? (editingEventId ? 'Saving Event...' : 'Creating Event...') : editingEventId ? 'Save Event' : 'Create Event'}
							</button>

							{editingEventId ? (
								<button
									type="button"
									className="action-btn action-btn--ghost"
									onClick={() => {
										clearEditMode();
										setEditingEventId(null);
										resetForm();
										setShowCreateEventForm(false);
									}}
								>
									Cancel Edit
								</button>
							) : null}
						</form>
					</article>
				</div>
			) : null}
		</section>
	);
};

export default Dashboard;
