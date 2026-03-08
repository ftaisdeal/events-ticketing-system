import { DataTypes, Sequelize } from 'sequelize';

const createTicketModel = (sequelize: Sequelize) => {
  const Ticket = sequelize.define('Ticket', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ticketNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    status: { type: DataTypes.STRING, defaultValue: 'valid' }
  });
  return Ticket;
};

export default createTicketModel;