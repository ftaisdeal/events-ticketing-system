import db from '../models';
import { isEmailConfigured, sendEmail } from '../utils/mailer';
import { sendUpcomingEventReminderEmails } from '../utils/eventReminderEmail';

type ParsedArgs = {
  dryRun: boolean;
  orderId?: number;
  eventId?: number;
};

const cliArgs = process.argv.slice(2);

const hasFlag = (flag: string) => cliArgs.includes(flag);

const parseNumericFlag = (flag: string) => {
  const withEquals = cliArgs.find((argument) => argument.startsWith(`${flag}=`));
  const rawValue = withEquals ? withEquals.slice(flag.length + 1) : (() => {
    const index = cliArgs.indexOf(flag);
    return index >= 0 ? cliArgs[index + 1] : undefined;
  })();

  if (!rawValue) {
    return undefined;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new Error(`Invalid value for ${flag}: ${rawValue}`);
  }

  return parsedValue;
};

const parseArgs = (): ParsedArgs => ({
  dryRun: hasFlag('--dry-run'),
  orderId: parseNumericFlag('--order-id'),
  eventId: parseNumericFlag('--event-id')
});

const parseRecipients = (value: string) => value
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const logRunEvent = (level: 'info' | 'error', event: string, data: Record<string, unknown> = {}) => {
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

const postSlackAlert = async (summary: string, details: Record<string, unknown>) => {
  const webhookUrl = process.env.EVENT_REMINDER_ALERT_SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return false;
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: `${summary}\n\n${JSON.stringify(details, null, 2)}`
    })
  });

  if (!response.ok) {
    throw new Error(`Slack webhook responded with status ${response.status}`);
  }

  return true;
};

const sendEmailAlert = async (summary: string, details: Record<string, unknown>) => {
  const alertRecipients = parseRecipients(process.env.EVENT_REMINDER_ALERT_TO || '');
  if (alertRecipients.length === 0 || !isEmailConfigured()) {
    return false;
  }

  const prettyDetails = JSON.stringify(details, null, 2);
  await sendEmail({
    to: alertRecipients.join(', '),
    subject: '[Ticketing] Event reminder job failure',
    text: `${summary}\n\n${prettyDetails}`,
    html: `<p>${summary}</p><pre>${prettyDetails}</pre>`
  });

  return true;
};

const sendFailureAlerts = async (summary: string, details: Record<string, unknown>) => {
  const channels: string[] = [];

  try {
    if (await postSlackAlert(summary, details)) {
      channels.push('slack');
    }
  } catch (error) {
    logRunEvent('error', 'alert_channel_failed', {
      channel: 'slack',
      error: serializeError(error)
    });
  }

  try {
    if (await sendEmailAlert(summary, details)) {
      channels.push('email');
    }
  } catch (error) {
    logRunEvent('error', 'alert_channel_failed', {
      channel: 'email',
      error: serializeError(error)
    });
  }

  logRunEvent('info', 'alert_dispatch_completed', {
    channels
  });
};

const main = async () => {
  let args: ParsedArgs = { dryRun: false };

  try {
    args = parseArgs();

    logRunEvent('info', 'run_started', args);
    await db.sequelize.authenticate();

    const stats = await sendUpcomingEventReminderEmails(args);
    logRunEvent('info', 'run_completed', {
      ...args,
      ...stats
    });

    if (!args.dryRun && stats.failures > 0) {
      await sendFailureAlerts('Event reminder job completed with send failures.', {
        ...args,
        ...stats
      });
      process.exitCode = 1;
    }
  } catch (error) {
    logRunEvent('error', 'run_failed', {
      ...args,
      error: serializeError(error)
    });

    if (!args.dryRun) {
      await sendFailureAlerts('Event reminder job failed before completion.', {
        ...args,
        error: serializeError(error)
      });
    }

    process.exitCode = 1;
  } finally {
    await db.sequelize.close().catch(() => undefined);
  }
};

void main();