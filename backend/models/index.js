const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'ticketing_system',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
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

const db = {};

// Import models
db.User = require('./User')(sequelize, DataTypes);
db.Event = require('./Event')(sequelize, DataTypes);
db.Venue = require('./Venue')(sequelize, DataTypes);
db.TicketType = require('./TicketType')(sequelize, DataTypes);
db.Order = require('./Order')(sequelize, DataTypes);
db.Ticket = require('./Ticket')(sequelize, DataTypes);
db.Payment = require('./Payment')(sequelize, DataTypes);
db.Category = require('./Category')(sequelize, DataTypes);

// Define associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
