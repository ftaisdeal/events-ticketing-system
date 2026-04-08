import { isEmailConfigured, sendEmail } from '../utils/mailer';

const resolveRecipient = (): string => {
	const cliRecipient = process.argv.slice(2).find((argument) => !argument.startsWith('--'));
	return cliRecipient || process.env.EMAIL_TEST_TO || process.env.EMAIL_USER || '';
};

const main = async () => {
	if (!isEmailConfigured()) {
		throw new Error('Email is not configured. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, and optionally EMAIL_FROM.');
	}

	const recipient = resolveRecipient();
	if (!recipient) {
		throw new Error('No recipient provided. Pass an email address as an argument or set EMAIL_TEST_TO in the environment.');
	}

	await sendEmail({
		to: recipient,
		subject: 'RDX Theater SMTP test',
		text: [
			'This is a test email from the RDX Theater ticketing backend.',
			'',
			'If you received this message, the SMTP configuration is working.'
		].join('\n'),
		html: [
			'<p>This is a test email from the RDX Theater ticketing backend.</p>',
			'<p>If you received this message, the SMTP configuration is working.</p>'
		].join('')
	});

	console.log(`Test email sent to ${recipient}`);
};

void main().catch((error) => {
	console.error('Email test failed:', error);
	process.exit(1);
});