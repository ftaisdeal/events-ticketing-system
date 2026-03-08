import { DataTypes, Sequelize } from 'sequelize';

const createOrderModel = (sequelize: Sequelize) => {
  const Order = sequelize.define('Order', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    totalAmount: { type: DataTypes.FLOAT, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: 'pending' }
  });
  return Order;
};

export default createOrderModel;