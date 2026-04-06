import dotenv from 'dotenv';
import { DataTypes, Sequelize } from 'sequelize';

import createCategoryModel from './Category';
import createEventModel from './Event';
import createOrderModel from './Order';
import createPaymentModel from './Payment';
import createTicketModel from './Ticket';
import createTicketCheckInModel from './TicketCheckIn';
import createTicketTypeModel from './TicketType';
import createUserModel from './User';
import createVenueModel from './Venue';

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'ticketing_system',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

const db: Record<string, any> = {};

// Import models
db.User = createUserModel(sequelize);
db.Event = createEventModel(sequelize);
db.Venue = createVenueModel(sequelize);
db.TicketType = createTicketTypeModel(sequelize);
db.Order = createOrderModel(sequelize);
db.Ticket = createTicketModel(sequelize);
db.TicketCheckIn = createTicketCheckInModel(sequelize);
db.Payment = createPaymentModel(sequelize);
db.Category = createCategoryModel(sequelize);

// Define associations
Object.keys(db).forEach((modelName) => {
  if (db[modelName]?.associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export default db;
