import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

const emailHost = process.env.EMAIL_HOST;
const emailPort = Number(process.env.EMAIL_PORT || 587);
const emailUser = process.env.EMAIL_USER;
const emailPassword = process.env.EMAIL_PASSWORD;
const emailFrom = process.env.EMAIL_FROM || emailUser;

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

export const isEmailConfigured = (): boolean => {
	return Boolean(emailHost && emailPort && emailUser && emailPassword && emailFrom);
};

const getTransporter = async (): Promise<nodemailer.Transporter> => {
	if (!isEmailConfigured()) {
		throw new Error('Email is not configured. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD, and optionally EMAIL_FROM.');
	}

	if (!transporterPromise) {
		transporterPromise = Promise.resolve(nodemailer.createTransport({
			host: emailHost,
			port: emailPort,
			secure: emailPort === 465,
			auth: {
				user: emailUser,
				pass: emailPassword
			}
		}));
	}

	return transporterPromise;
};

export const sendEmail = async ({
	to,
	subject,
	text,
	html
}: {
	to: string;
	subject: string;
	text: string;
	html: string;
}): Promise<void> => {
	const transporter = await getTransporter();

	await transporter.sendMail({
		from: emailFrom,
		to,
		subject,
		text,
		html
	});
};