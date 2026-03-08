import { DataTypes, Sequelize } from 'sequelize';

const createTicketTypeModel = (sequelize: Sequelize) => {
  const TicketType = sequelize.define('TicketType', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.FLOAT, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false }
  });
  return TicketType;
};

export default createTicketTypeModel;