import { DataTypes, Sequelize } from 'sequelize';

const createOrderModel = (sequelize: Sequelize) => {
  const Order = sequelize.define('Order', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    orderNumber: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    eventId: { type: DataTypes.INTEGER, allowNull: false },
    totalAmount: { type: DataTypes.FLOAT, allowNull: false },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'USD' },
    status: { type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'refunded', 'failed', 'expired'), defaultValue: 'pending' },
    customerInfo: { type: DataTypes.JSON },
    expiresAt: { type: DataTypes.DATE },
    confirmedAt: { type: DataTypes.DATE },
    confirmationEmailSentAt: { type: DataTypes.DATE },
    eventReminderEmailSentAt: { type: DataTypes.DATE }
  }, {
    tableName: 'orders',
    timestamps: true
  });

  (Order as any).associate = (models: Record<string, any>) => {
    Order.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
    Order.belongsTo(models.Event, {
      foreignKey: 'eventId',
      as: 'event'
    });
    Order.hasMany(models.Ticket, {
      foreignKey: 'orderId',
      as: 'tickets'
    });
    Order.hasMany(models.Payment, {
      foreignKey: 'orderId',
      as: 'payments'
    });
  };

  return Order;
};

export default createOrderModel;