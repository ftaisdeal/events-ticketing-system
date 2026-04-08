import { Op } from 'sequelize';

import db from '../models';
import { isEmailConfigured, sendEmail } from './mailer';

const DEFAULT_LOOKAHEAD_HOURS = 48;

type ReminderRunStats = {
  scanned: number;
  matched: number;
  sent: number;
  simulated: number;
  failures: number;
  skippedMissingEmail: number;
  skippedAlreadySent: number;
  skippedDateWindow: number;
};

type ReminderRunOptions = {
  referenceDate?: Date;
  lookaheadHours?: number;
  dryRun?: boolean;
  orderId?: number;
  eventId?: number;
};

const logReminderEvent = (level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown> = {}) => {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    scope: 'event-reminder-job',
    level,
    event,
    ...data
  });

  if (level === 'error') {
    console.error(payload);
    return;
  }

  if (level === 'warn') {
    console.warn(payload);
    return;
  }

  console.log(payload);
};

const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    message: String(error)
  };
};

const padNumber = (value: number) => String(value).padStart(2, '0');

const resolveTimeZone = (value: unknown): string => {
  const candidate = typeof value === 'string' && value.trim() ? value.trim() : 'UTC';

  try {
    Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch (_error) {
    return 'UTC';
  }
};

const getDatePartsInTimeZone = (date: Date, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((part) => part.type === 'year')?.value || 0);
  const month = Number(parts.find((part) => part.type === 'month')?.value || 0);
  const day = Number(parts.find((part) => part.type === 'day')?.value || 0);

  return { year, month, day };
};

const getDateKeyInTimeZone = (date: Date, timeZone: string) => {
  const { year, month, day } = getDatePartsInTimeZone(date, timeZone);
  return `${year}-${padNumber(month)}-${padNumber(day)}`;
};

const getTomorrowDateKeyInTimeZone = (referenceDate: Date, timeZone: string) => {
  const { year, month, day } = getDatePartsInTimeZone(referenceDate, timeZone);
  const tomorrowUtc = new Date(Date.UTC(year, month - 1, day + 1));

  return `${tomorrowUtc.getUTCFullYear()}-${padNumber(tomorrowUtc.getUTCMonth() + 1)}-${padNumber(tomorrowUtc.getUTCDate())}`;
};

const isEventTomorrowInTimeZone = (eventStartDate: Date, timeZone: string, referenceDate: Date) => {
  return getDateKeyInTimeZone(eventStartDate, timeZone) === getTomorrowDateKeyInTimeZone(referenceDate, timeZone);
};

const formatEventDateTime = (eventStartDate: Date, timeZone: string) => {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(eventStartDate);
};

const formatTicketSummary = (tickets: any[]) => {
  const quantityByTicketType = new Map<string, number>();

  for (const ticket of tickets) {
    const ticketTypeName = String(ticket.ticketType?.name || 'Ticket');
    quantityByTicketType.set(ticketTypeName, (quantityByTicketType.get(ticketTypeName) || 0) + 1);
  }

  return Array.from(quantityByTicketType.entries()).map(([ticketTypeName, quantity]) => ({
    ticketTypeName,
    quantity
  }));
};

const buildVenueLine = (event: any) => {
  if (!event.venue) {
    return '';
  }

  const parts = [event.venue.name, event.venue.city, event.venue.state, event.venue.country].filter(Boolean);
  return parts.join(', ');
};

const buildEventReminderEmail = (order: any) => {
  const userName = [order.user?.firstName, order.user?.lastName].filter(Boolean).join(' ') || 'Customer';
  const eventTitle = String(order.event?.title || 'your event');
  const timeZone = resolveTimeZone(order.event?.timezone);
  const eventStartDate = new Date(order.event.startDateTime);
  const eventDateTime = formatEventDateTime(eventStartDate, timeZone);
  const venueLine = buildVenueLine(order.event);
  const orderUrlBase = process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL;
  const orderUrl = orderUrlBase ? `${String(orderUrlBase).replace(/\/$/, '')}/orders/${order.id}` : '';
  const ticketSummary = formatTicketSummary(Array.isArray(order.tickets) ? order.tickets : []);
  const ticketLines = ticketSummary.length > 0
    ? ticketSummary.map((ticket) => `- ${ticket.ticketTypeName}: ${ticket.quantity}`).join('\n')
    : '- Your tickets are available in your account';
  const ticketHtml = ticketSummary.length > 0
    ? `<ul>${ticketSummary.map((ticket) => `<li>${ticket.ticketTypeName}: ${ticket.quantity}</li>`).join('')}</ul>`
    : '<p>Your tickets are available in your account.</p>';

  const text = [
    `Hello ${userName},`,
    '',
    `This is a reminder that ${eventTitle} is tomorrow.`,
    '',
    `When: ${eventDateTime}`,
    venueLine ? `Where: ${venueLine}` : '',
    '',
    'Tickets on this order:',
    ticketLines,
    orderUrl ? '' : '',
    orderUrl ? `View your order: ${orderUrl}` : '',
    '',
    'We look forward to seeing you.'
  ].filter(Boolean).join('\n');

  const html = [
    `<p>Hello ${userName},</p>`,
    `<p>This is a reminder that <strong>${eventTitle}</strong> is tomorrow.</p>`,
    `<p><strong>When:</strong> ${eventDateTime}${venueLine ? `<br /><strong>Where:</strong> ${venueLine}` : ''}</p>`,
    '<p><strong>Tickets on this order:</strong></p>',
    ticketHtml,
    orderUrl ? `<p><a href="${orderUrl}">View your order</a></p>` : '',
    '<p>We look forward to seeing you.</p>'
  ].filter(Boolean).join('');

  return {
    subject: `Reminder: ${eventTitle} is tomorrow`,
    text,
    html
  };
};

export const sendUpcomingEventReminderEmails = async ({
  referenceDate = new Date(),
  lookaheadHours = Number(process.env.EVENT_REMINDER_LOOKAHEAD_HOURS || DEFAULT_LOOKAHEAD_HOURS),
  dryRun = false,
  orderId,
  eventId
}: ReminderRunOptions = {}): Promise<ReminderRunStats> => {
  const stats: ReminderRunStats = {
    scanned: 0,
    matched: 0,
    sent: 0,
    simulated: 0,
    failures: 0,
    skippedMissingEmail: 0,
    skippedAlreadySent: 0,
    skippedDateWindow: 0
  };

  if (!dryRun && !isEmailConfigured()) {
    logReminderEvent('warn', 'email_not_configured', {
      dryRun
    });
    return stats;
  }

  const windowEnd = new Date(referenceDate.getTime() + Math.max(1, lookaheadHours) * 60 * 60 * 1000);
  const orderWhere: Record<string, unknown> = {
    status: 'confirmed',
    eventReminderEmailSentAt: null
  };
  const eventWhere: Record<string, unknown> = {
    status: {
      [Op.ne]: 'cancelled'
    }
  };

  if (orderId) {
    orderWhere.id = orderId;
  }

  if (eventId) {
    eventWhere.id = eventId;
  }

  if (!orderId && !eventId) {
    eventWhere.startDateTime = {
      [Op.gte]: referenceDate,
      [Op.lt]: windowEnd
    };
  }

  const orders = await db.Order.findAll({
    where: orderWhere,
    include: [
      {
        model: db.User,
        as: 'user'
      },
      {
        model: db.Event,
        as: 'event',
        required: true,
        where: eventWhere,
        include: [
          {
            model: db.Venue,
            as: 'venue',
            required: false
          }
        ]
      },
      {
        model: db.Ticket,
        as: 'tickets',
        required: false,
        include: [
          {
            model: db.TicketType,
            as: 'ticketType',
            required: false
          }
        ]
      }
    ],
    order: [[{ model: db.Event, as: 'event' }, 'startDateTime', 'ASC']]
  });

  stats.scanned = orders.length;
  logReminderEvent('info', 'run_candidates_loaded', {
    dryRun,
    referenceDate: referenceDate.toISOString(),
    windowEnd: windowEnd.toISOString(),
    scanned: stats.scanned,
    orderId: orderId || null,
    eventId: eventId || null
  });

  for (const order of orders) {
    if (order.eventReminderEmailSentAt) {
      stats.skippedAlreadySent += 1;
      continue;
    }

    const emailAddress = String(order.user?.email || '').trim();
    if (!emailAddress) {
      stats.skippedMissingEmail += 1;
      logReminderEvent('warn', 'order_skipped_missing_email', {
        orderId: order.id,
        eventId: order.event?.id,
        eventTitle: order.event?.title
      });
      continue;
    }

    const eventStartDate = new Date(order.event.startDateTime);
    const timeZone = resolveTimeZone(order.event?.timezone);
    if (!isEventTomorrowInTimeZone(eventStartDate, timeZone, referenceDate)) {
      stats.skippedDateWindow += 1;
      if (dryRun || orderId || eventId) {
        logReminderEvent('info', 'order_skipped_date_window', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          eventId: order.event?.id,
          eventTitle: order.event?.title,
          eventStartDateTime: eventStartDate.toISOString(),
          eventTimeZone: timeZone,
          referenceDate: referenceDate.toISOString()
        });
      }
      continue;
    }

    stats.matched += 1;

    const logContext = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: order.user?.id,
      eventId: order.event?.id,
      eventTitle: order.event?.title,
      eventStartDateTime: eventStartDate.toISOString(),
      eventTimeZone: timeZone,
      recipientEmail: emailAddress,
      dryRun
    };

    if (dryRun) {
      stats.simulated += 1;
      logReminderEvent('info', 'order_dry_run_match', logContext);
      continue;
    }

    try {
      const { subject, text, html } = buildEventReminderEmail(order);
      await sendEmail({
        to: emailAddress,
        subject,
        text,
        html
      });

      await db.Order.update(
        { eventReminderEmailSentAt: new Date() },
        {
          where: {
            id: order.id,
            eventReminderEmailSentAt: null
          }
        }
      );

      stats.sent += 1;
      logReminderEvent('info', 'order_sent', logContext);
    } catch (error) {
      stats.failures += 1;
      logReminderEvent('error', 'order_send_failed', {
        ...logContext,
        error: serializeError(error)
      });
    }
  }

  return stats;
};