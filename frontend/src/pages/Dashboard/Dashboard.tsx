import axios from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

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

type CreatedEvent = {
	id: number;
	title: string;
	slug: string;
	status: string;
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

type CreatedTicketType = {
	id: number;
	name: string;
	price: number;
	quantity: number;
};

const Dashboard = (): JSX.Element => {
	const { token, user } = useAuth();
	const [categories, setCategories] = useState<CategoryOption[]>([]);
	const [venues, setVenues] = useState<VenueOption[]>([]);
	const [managedEvents, setManagedEvents] = useState<ManagedEvent[]>([]);
	const [isLoadingManagedEvents, setIsLoadingManagedEvents] = useState(true);
	const [title, setTitle] = useState('');
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
	const [createdEvent, setCreatedEvent] = useState<CreatedEvent | null>(null);
	const [ticketTypeName, setTicketTypeName] = useState('General Admission');
	const [ticketTypePrice, setTicketTypePrice] = useState('25');
	const [ticketTypeQuantity, setTicketTypeQuantity] = useState('100');
	const [isCreatingTicketType, setIsCreatingTicketType] = useState(false);
	const [ticketTypeError, setTicketTypeError] = useState('');
	const [ticketTypeSuccess, setTicketTypeSuccess] = useState('');
	const [showCreateEventForm, setShowCreateEventForm] = useState(false);

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
		setDescription('');
		setStartDateTime('');
		setEndDateTime('');
		setStatus('draft');
		setCategoryId('');
		setVenueId('');
		setMaxCapacity('');
	};

	const onSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!token) {
			setError('You are not authenticated');
			return;
		}

		setIsSubmitting(true);
		setError('');
		setSuccess('');
		setCreatedEvent(null);
		setTicketTypeError('');
		setTicketTypeSuccess('');

		try {
			const response = await api.post(
				'/events',
				{
					title,
					description,
					startDateTime,
					endDateTime,
					timezone,
					status,
					categoryId: categoryId ? Number(categoryId) : null,
					venueId: venueId ? Number(venueId) : null,
					maxCapacity: maxCapacity ? Number(maxCapacity) : null
				},
				{ headers: getAuthHeader(token) }
			);

			const created = response.data.event as CreatedEvent;
			setCreatedEvent(created);
			setSuccess(`Event \"${created.title}\" created successfully.`);
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

	const onCreateTicketType = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!token) {
			setTicketTypeError('You are not authenticated');
			return;
		}

		if (!createdEvent) {
			setTicketTypeError('Create an event first');
			return;
		}

		setIsCreatingTicketType(true);
		setTicketTypeError('');
		setTicketTypeSuccess('');

		try {
			const response = await api.post(
				`/events/${createdEvent.id}/ticket-types`,
				{
					name: ticketTypeName,
					price: Number(ticketTypePrice),
					quantity: Number(ticketTypeQuantity)
				},
				{ headers: getAuthHeader(token) }
			);

			const created = response.data.ticketType as CreatedTicketType;
			setTicketTypeSuccess(`Ticket type \"${created.name}\" created successfully.`);
			await loadManagedEvents();
		} catch (submitError) {
			if (axios.isAxiosError(submitError)) {
				const payload = submitError.response?.data as { message?: string; errors?: Array<{ msg: string }> } | undefined;
				const validationMessage = payload?.errors?.[0]?.msg;
				setTicketTypeError(validationMessage || payload?.message || 'Failed to create ticket type');
			} else {
				setTicketTypeError('Failed to create ticket type');
			}
		} finally {
			setIsCreatingTicketType(false);
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
						onClick={() => setShowCreateEventForm((current) => !current)}
					>
						{showCreateEventForm ? 'Hide Create Event' : 'Create New Event'}
					</button>
				</div>

				{isLoadingManagedEvents ? <p>Loading events...</p> : null}
				{!isLoadingManagedEvents && managedEvents.length === 0 ? <p>No events found yet.</p> : null}

				{managedEvents.map((eventItem) => (
					<div className="line-item-row" key={eventItem.id}>
						<div>
							<strong>{eventItem.title}</strong>
							<p className="event-card__meta" style={{ margin: 0 }}>
								Status: {eventItem.status} | {new Date(eventItem.startDateTime).toLocaleString()} to{' '}
								{new Date(eventItem.endDateTime).toLocaleString()}
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
						<h2>Create Event</h2>
						<p>Publish a new event that appears in the public event catalog.</p>

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
										<option value="draft">Draft</option>
										<option value="published">Published</option>
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

							{error ? <p className="error-text">{error}</p> : null}
							{success ? <p>{success}</p> : null}

							<button className="action-btn action-btn--primary" type="submit" disabled={isSubmitting || isLoadingOptions}>
								{isSubmitting ? 'Creating Event...' : 'Create Event'}
							</button>
						</form>
					</article>

					<article className="panel-card">
						<h2>Next Steps</h2>
						<p>After creating the event, define ticket tiers and pricing for sales.</p>
						{createdEvent ? (
							<>
								<p>
									Created: <strong>{createdEvent.title}</strong>. View at{' '}
									<Link to={`/events/${createdEvent.slug}`}>/events/{createdEvent.slug}</Link>
								</p>

								<form className="auth-card" onSubmit={onCreateTicketType}>
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

									<div className="grid-two">
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
									</div>

									{ticketTypeError ? <p className="error-text">{ticketTypeError}</p> : null}
									{ticketTypeSuccess ? <p>{ticketTypeSuccess}</p> : null}

									<button className="action-btn action-btn--primary" type="submit" disabled={isCreatingTicketType}>
										{isCreatingTicketType ? 'Creating Ticket Type...' : 'Create Ticket Type'}
									</button>
								</form>
							</>
						) : null}
					</article>
				</div>
			) : null}
		</section>
	);
};

export default Dashboard;
