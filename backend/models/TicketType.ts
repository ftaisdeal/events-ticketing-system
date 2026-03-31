import { DataTypes, Sequelize } from 'sequelize';

const createTicketTypeModel = (sequelize: Sequelize) => {
  const TicketType = sequelize.define('TicketType', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    eventId: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.FLOAT, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    quantitySold: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  }, {
    tableName: 'ticket_types',
    timestamps: true
  });

  (TicketType as any).associate = (models: Record<string, any>) => {
    TicketType.belongsTo(models.Event, {
      foreignKey: 'eventId',
      as: 'event'
    });
    TicketType.hasMany(models.Ticket, {
      foreignKey: 'ticketTypeId',
      as: 'tickets'
    });
  };

  return TicketType;
};

export default createTicketTypeModel;