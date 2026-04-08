import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import ScannerPanel from '../components/ScannerPanel';
import { api, getAuthHeader } from '../lib/api';
import { useAuth } from '../state/AuthContext';
import { CheckInEvent, CheckInResult } from '../types';

const resultToneByKey: Record<string, 'neutral' | 'good' | 'bad'> = {
  valid: 'neutral',
  admitted: 'good',
  already_checked_in: 'bad',
  not_found: 'bad',
  wrong_event: 'bad',
  forbidden_event: 'bad',
  payment_not_confirmed: 'bad',
  ticket_cancelled: 'bad'
};

const resultLabelByKey: Record<string, string> = {
  valid: 'Valid ticket',
  admitted: 'Admitted',
  already_checked_in: 'Already checked in',
  not_found: 'Ticket not found',
  wrong_event: 'Wrong event',
  forbidden_event: 'Event access denied',
  payment_not_confirmed: 'Payment not confirmed',
  ticket_cancelled: 'Ticket cancelled'
};

const formatShortCode = (shortCode?: string) => {
  const normalized = String(shortCode || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (normalized.length !== 8) {
    return normalized;
  }

  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
};

const CheckInPage = (): JSX.Element => {
  const { eventId } = useParams();
  const { token, user, logout } = useAuth();
  const [eventItem, setEventItem] = useState<CheckInEvent | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const numericEventId = Number(eventId) || 0;

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const [summaryResponse, eventsResponse] = await Promise.all([
          api.get(`/tickets/check-in/events/${numericEventId}/summary`, {
            headers: getAuthHeader(token)
          }),
          api.get('/tickets/check-in/events', {
            headers: getAuthHeader(token)
          })
        ]);

        const matchingEvent = (eventsResponse.data.events as CheckInEvent[]).find((item) => item.id === numericEventId) || null;
        setEventItem(matchingEvent ? {
          ...matchingEvent,
          stats: summaryResponse.data.stats as CheckInEvent['stats']
        } : null);
      } catch (_error) {
        setError('Unable to load the selected event.');
      } finally {
        setIsLoading(false);
      }
    };

    if (numericEventId > 0) {
      void loadSummary();
    } else {
      setError('Invalid event selection.');
      setIsLoading(false);
    }
  }, [numericEventId, token]);

  const resultTone = useMemo(() => {
    if (!result) {
      return 'neutral';
    }

    return resultToneByKey[result.result] || 'neutral';
  }, [result]);

  const redeemCode = async (code: string) => {
    if (!code.trim()) {
      return;
    }

    setIsRedeeming(true);
    setError(null);

    try {
      const response = await api.post('/tickets/check-in/redeem', {
        code,
        eventId: numericEventId,
        source: 'pwa',
        deviceId: typeof navigator !== 'undefined' ? navigator.userAgent : undefined
      }, {
        headers: getAuthHeader(token)
      });

      setResult(response.data as CheckInResult);

      const summaryResponse = await api.get(`/tickets/check-in/events/${numericEventId}/summary`, {
        headers: getAuthHeader(token)
      });

      setEventItem((current) => current ? {
        ...current,
        stats: summaryResponse.data.stats as CheckInEvent['stats']
      } : current);
    } catch (_error) {
      setError('Unable to process this scan.');
    } finally {
      setIsRedeeming(false);
      setManualCode('');
    }
  };

  const onManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await redeemCode(manualCode);
  };

  return (
    <main className="page-shell">
      <header className="page-header tight-header centered-header">
        <div className="centered-header-content checkin-header-content">
          <Link className="brand-link" to="/events">
            <div className="brand-title checkin-page-title"><span className="brand-mark">RDX</span> Check In</div>
          </Link>
          <p className="eyebrow checkin-eyebrow">{eventItem?.title || 'Check-in console'}</p>
        </div>
      </header>

      {isLoading ? <div className="status-shell">Loading event lane...</div> : null}
      {error ? <div className="status-shell error-state">{error}</div> : null}

      {eventItem ? (
        <>
          <section className="checkin-grid">
            <ScannerPanel onScan={(code) => void redeemCode(code)} />

            <aside className="result-card">
              <div className={`result-state tone-${resultTone}`}>
                <p className="eyebrow">Latest result</p>
                <h3>{result ? (resultLabelByKey[result.result] || result.result) : 'Waiting for first scan'}</h3>
                {result?.ticket ? <p>Ticket #{result.ticket.ticketNumber}{result.ticket.shortCode ? ` • Check-in ${formatShortCode(result.ticket.shortCode)}` : ''}</p> : null}
              </div>

              <form className="manual-form" onSubmit={onManualSubmit}>
                <label>
                  <span className="manual-entry-label">Manual code entry</span>
                  <input
                    value={manualCode}
                    onChange={(event) => setManualCode(event.target.value)}
                    placeholder="short code, ticket:TKT-..., or raw QR value"
                  />
                </label>
                <button type="submit" className="primary-button" disabled={isRedeeming}>
                  {isRedeeming ? 'Processing...' : 'Submit code'}
                </button>
              </form>

              {result?.order?.customer ? (
                <div className="detail-stack">
                  <h3>Customer</h3>
                  <p>{result.order.customer.firstName} {result.order.customer.lastName}</p>
                  <p>{result.order.customer.email}</p>
                </div>
              ) : null}

              {result?.checkIn ? (
                <div className="detail-stack">
                  <h3>Check-in record</h3>
                  <p>{new Date(result.checkIn.scannedAt).toLocaleString()}</p>
                  <p>{result.checkIn.scannedBy ? `${result.checkIn.scannedBy.firstName} ${result.checkIn.scannedBy.lastName}` : 'Unknown staff'}</p>
                </div>
              ) : null}
            </aside>
          </section>

          <section className="summary-band">
            <div>
              <span>Issued</span>
              <strong>{eventItem.stats.totalIssued}</strong>
            </div>
            <div>
              <span>Checked in</span>
              <strong>{eventItem.stats.checkedInCount}</strong>
            </div>
            <div>
              <span>Remaining</span>
              <strong>{eventItem.stats.remainingCount}</strong>
            </div>
          </section>
        </>
      ) : null}

      <footer className="session-bar">
        <p className="session-copy">Signed in as {user?.firstName} {user?.lastName}.</p>
        <button type="button" className="ghost-button" onClick={logout}>Sign out</button>
      </footer>
    </main>
  );
};

export default CheckInPage;