import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { api, getAuthHeader } from '../lib/api';
import { useAuth } from '../state/AuthContext';
import { CheckInEvent } from '../types';

const formatEventTime = (value: string) => new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
}).format(new Date(value));

const EventsPage = (): JSX.Element => {
  const { token, user, logout } = useAuth();
  const [events, setEvents] = useState<CheckInEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const response = await api.get('/tickets/check-in/events', {
          headers: getAuthHeader(token)
        });
        setEvents(response.data.events as CheckInEvent[]);
      } catch (_error) {
        setError('Unable to load staff events.');
      } finally {
        setIsLoading(false);
      }
    };

    void loadEvents();
  }, [token]);

  return (
    <main className="page-shell">
      <header className="page-header brand-header">
        <div className="brand-title"><span className="brand-mark">RDX</span> Check In</div>
      </header>

      {isLoading ? <div className="status-shell">Loading events...</div> : null}
      {error ? <div className="status-shell error-state">{error}</div> : null}

      <section className="event-grid">
        {events.map((eventItem) => (
          <Link key={eventItem.id} className="event-card" to={`/events/${eventItem.id}/check-in`}>
            <p className="event-kicker">{formatEventTime(eventItem.startDateTime)}</p>
            <h2>{eventItem.title}</h2>
            <p>{eventItem.venue ? `${eventItem.venue.name} · ${eventItem.venue.city}` : 'Venue not assigned'}</p>
            <div className="stats-row">
              <span>{eventItem.stats.checkedInCount} checked in</span>
              <span>{eventItem.stats.remainingCount} waiting</span>
            </div>
          </Link>
        ))}
        {!isLoading && !events.length ? <div className="status-shell">No eligible events were found for this account.</div> : null}
      </section>

      <footer className="session-bar">
        <p className="session-copy">Signed in as {user?.firstName} {user?.lastName}.</p>
        <button type="button" className="ghost-button" onClick={logout}>Sign out</button>
      </footer>
    </main>
  );
};

export default EventsPage;