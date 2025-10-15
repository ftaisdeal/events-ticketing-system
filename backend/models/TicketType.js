module.exports = (sequelize, DataTypes) => {
  const TicketType = sequelize.define('TicketType', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.FLOAT, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false }
  });
  return TicketType;
};