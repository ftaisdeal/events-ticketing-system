import db from '../models';

const RESETTABLE_TABLES = [
	{ label: 'ticket check-ins', model: db.TicketCheckIn, tableName: 'ticket_check_ins' },
	{ label: 'tickets', model: db.Ticket, tableName: 'tickets' },
	{ label: 'payments', model: db.Payment, tableName: 'payments' },
	{ label: 'orders', model: db.Order, tableName: 'orders' }
];

const assertSafeToRun = () => {
	const nodeEnv = process.env.NODE_ENV || 'development';
	const dbHost = process.env.DB_HOST || 'localhost';
	const hasConfirmFlag = process.argv.includes('--confirm');
	const isLocalDatabase = dbHost === 'localhost' || dbHost === '127.0.0.1';

	if (!hasConfirmFlag) {
		throw new Error('Soft reset requires the --confirm flag.');
	}

	if (nodeEnv !== 'development') {
		throw new Error(`Soft reset only runs in development. Current NODE_ENV: ${nodeEnv}`);
	}

	if (!isLocalDatabase) {
		throw new Error(`Soft reset only runs against a local database host. Current DB_HOST: ${dbHost}`);
	}
	};

const resetAutoIncrement = async (tableName: string) => {
	await db.sequelize.query(`ALTER TABLE ${tableName} AUTO_INCREMENT = 1`);
};

const main = async () => {
	assertSafeToRun();

	await db.sequelize.authenticate();

	const counts = await Promise.all(
		RESETTABLE_TABLES.map(async ({ label, model }) => ({
			label,
			count: await model.count()
		}))
	);

	const transaction = await db.sequelize.transaction();

	try {
		await db.TicketCheckIn.destroy({ where: {}, transaction });
		await db.Ticket.destroy({ where: {}, transaction });
		await db.Payment.destroy({ where: {}, transaction });
		await db.Order.destroy({ where: {}, transaction });
		await db.TicketType.update({ quantitySold: 0 }, { where: {}, transaction });

		await transaction.commit();

		for (const { tableName } of RESETTABLE_TABLES) {
			await resetAutoIncrement(tableName);
		}

		console.log('Soft reset complete. Removed transactional checkout data and reset ticket inventory.');
		for (const { label, count } of counts) {
			console.log(`- Cleared ${count} ${label}`);
		}
		console.log('- Reset quantitySold to 0 for all ticket types');
		console.log('- Preserved users, events, venues, categories, and ticket types');
	} catch (error) {
		await transaction.rollback();
		throw error;
	} finally {
		await db.sequelize.close();
	}
};

void main().catch((error) => {
	console.error('Soft reset failed:', error);
	process.exit(1);
});