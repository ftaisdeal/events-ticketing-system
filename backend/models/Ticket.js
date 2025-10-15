module.exports = (sequelize, DataTypes) => {
  const Ticket = sequelize.define('Ticket', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ticketNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    status: { type: DataTypes.STRING, defaultValue: 'valid' }
  });
  return Ticket;
};