import { DataTypes, Sequelize } from 'sequelize';

const createTicketModel = (sequelize: Sequelize) => {
  const Ticket = sequelize.define('Ticket', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ticketNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    orderId: { type: DataTypes.INTEGER, allowNull: false },
    ticketTypeId: { type: DataTypes.INTEGER, allowNull: false },
    attendeeName: { type: DataTypes.STRING },
    attendeeEmail: { type: DataTypes.STRING },
    price: { type: DataTypes.FLOAT, allowNull: false },
    qrCode: { type: DataTypes.TEXT },
    status: { type: DataTypes.STRING, defaultValue: 'valid' }
  }, {
    tableName: 'tickets',
    timestamps: true
  });

  (Ticket as any).associate = (models: Record<string, any>) => {
    Ticket.belongsTo(models.Order, {
      foreignKey: 'orderId',
      as: 'order'
    });
    Ticket.belongsTo(models.TicketType, {
      foreignKey: 'ticketTypeId',
      as: 'ticketType'
    });
    Ticket.hasOne(models.TicketCheckIn, {
      foreignKey: 'ticketId',
      as: 'checkIn'
    });
  };

  return Ticket;
};

export default createTicketModel;