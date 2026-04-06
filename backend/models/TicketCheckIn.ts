import { DataTypes, Sequelize } from 'sequelize';

const createTicketCheckInModel = (sequelize: Sequelize) => {
  const TicketCheckIn = sequelize.define('TicketCheckIn', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ticketId: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    eventId: { type: DataTypes.INTEGER, allowNull: false },
    scannedByUserId: { type: DataTypes.INTEGER, allowNull: false },
    source: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'scanner' },
    deviceId: { type: DataTypes.STRING(128) },
    notes: { type: DataTypes.STRING(255) },
    metadata: { type: DataTypes.JSON }
  }, {
    tableName: 'ticket_check_ins',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['ticketId']
      },
      {
        fields: ['eventId']
      },
      {
        fields: ['scannedByUserId']
      }
    ]
  });

  (TicketCheckIn as any).associate = (models: Record<string, any>) => {
    TicketCheckIn.belongsTo(models.Ticket, {
      foreignKey: 'ticketId',
      as: 'ticket'
    });
    TicketCheckIn.belongsTo(models.Event, {
      foreignKey: 'eventId',
      as: 'event'
    });
    TicketCheckIn.belongsTo(models.User, {
      foreignKey: 'scannedByUserId',
      as: 'scannedBy'
    });
  };

  return TicketCheckIn;
};

export default createTicketCheckInModel;