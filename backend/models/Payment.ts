import { DataTypes, Sequelize } from 'sequelize';

const createPaymentModel = (sequelize: Sequelize) => {
  const Payment = sequelize.define('Payment', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    orderId: { type: DataTypes.INTEGER, allowNull: false },
    paymentIntentId: { type: DataTypes.STRING },
    provider: { type: DataTypes.STRING, allowNull: false, defaultValue: 'stripe' },
    amount: { type: DataTypes.FLOAT, allowNull: false },
    currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'USD' },
    status: { type: DataTypes.STRING, defaultValue: 'pending' },
    transactionId: { type: DataTypes.STRING },
    metadata: { type: DataTypes.JSON },
    failureReason: { type: DataTypes.TEXT },
    processedAt: { type: DataTypes.DATE }
  }, {
    tableName: 'payments',
    timestamps: true
  });

  (Payment as any).associate = (models: Record<string, any>) => {
    Payment.belongsTo(models.Order, {
      foreignKey: 'orderId',
      as: 'order'
    });
  };

  return Payment;
};

export default createPaymentModel;