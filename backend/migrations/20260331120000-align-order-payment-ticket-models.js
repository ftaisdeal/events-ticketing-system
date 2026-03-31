'use strict';

const maybeAddColumn = async (queryInterface, tableName, columnName, definition) => {
  const table = await queryInterface.describeTable(tableName);
  if (!table[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
};

const maybeRemoveColumn = async (queryInterface, tableName, columnName) => {
  const table = await queryInterface.describeTable(tableName);
  if (table[columnName]) {
    await queryInterface.removeColumn(tableName, columnName);
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await maybeAddColumn(queryInterface, 'orders', 'orderNumber', {
      type: Sequelize.STRING(50),
      allowNull: true,
      unique: true
    });

    await maybeAddColumn(queryInterface, 'orders', 'userId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await maybeAddColumn(queryInterface, 'orders', 'eventId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await maybeAddColumn(queryInterface, 'orders', 'currency', {
      type: Sequelize.STRING(3),
      allowNull: false,
      defaultValue: 'USD'
    });

    await maybeAddColumn(queryInterface, 'orders', 'customerInfo', {
      type: Sequelize.JSON,
      allowNull: true
    });

    await maybeAddColumn(queryInterface, 'orders', 'expiresAt', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await maybeAddColumn(queryInterface, 'orders', 'confirmedAt', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await maybeAddColumn(queryInterface, 'ticket_types', 'eventId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await maybeAddColumn(queryInterface, 'ticket_types', 'quantitySold', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    });

    await maybeAddColumn(queryInterface, 'ticket_types', 'isActive', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true
    });

    await maybeAddColumn(queryInterface, 'tickets', 'orderId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await maybeAddColumn(queryInterface, 'tickets', 'ticketTypeId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await maybeAddColumn(queryInterface, 'tickets', 'attendeeName', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await maybeAddColumn(queryInterface, 'tickets', 'attendeeEmail', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await maybeAddColumn(queryInterface, 'tickets', 'price', {
      type: Sequelize.FLOAT,
      allowNull: false,
      defaultValue: 0
    });

    await maybeAddColumn(queryInterface, 'tickets', 'qrCode', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await maybeAddColumn(queryInterface, 'payments', 'orderId', {
      type: Sequelize.INTEGER,
      allowNull: true
    });

    await maybeAddColumn(queryInterface, 'payments', 'paymentIntentId', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await maybeAddColumn(queryInterface, 'payments', 'provider', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'stripe'
    });

    await maybeAddColumn(queryInterface, 'payments', 'currency', {
      type: Sequelize.STRING(3),
      allowNull: false,
      defaultValue: 'USD'
    });

    await maybeAddColumn(queryInterface, 'payments', 'transactionId', {
      type: Sequelize.STRING,
      allowNull: true
    });

    await maybeAddColumn(queryInterface, 'payments', 'metadata', {
      type: Sequelize.JSON,
      allowNull: true
    });

    await maybeAddColumn(queryInterface, 'payments', 'failureReason', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    await maybeAddColumn(queryInterface, 'payments', 'processedAt', {
      type: Sequelize.DATE,
      allowNull: true
    });
  },

  async down(queryInterface) {
    await maybeRemoveColumn(queryInterface, 'payments', 'processedAt');
    await maybeRemoveColumn(queryInterface, 'payments', 'failureReason');
    await maybeRemoveColumn(queryInterface, 'payments', 'metadata');
    await maybeRemoveColumn(queryInterface, 'payments', 'transactionId');
    await maybeRemoveColumn(queryInterface, 'payments', 'currency');
    await maybeRemoveColumn(queryInterface, 'payments', 'provider');
    await maybeRemoveColumn(queryInterface, 'payments', 'paymentIntentId');
    await maybeRemoveColumn(queryInterface, 'payments', 'orderId');

    await maybeRemoveColumn(queryInterface, 'tickets', 'qrCode');
    await maybeRemoveColumn(queryInterface, 'tickets', 'price');
    await maybeRemoveColumn(queryInterface, 'tickets', 'attendeeEmail');
    await maybeRemoveColumn(queryInterface, 'tickets', 'attendeeName');
    await maybeRemoveColumn(queryInterface, 'tickets', 'ticketTypeId');
    await maybeRemoveColumn(queryInterface, 'tickets', 'orderId');

    await maybeRemoveColumn(queryInterface, 'ticket_types', 'isActive');
    await maybeRemoveColumn(queryInterface, 'ticket_types', 'quantitySold');
    await maybeRemoveColumn(queryInterface, 'ticket_types', 'eventId');

    await maybeRemoveColumn(queryInterface, 'orders', 'confirmedAt');
    await maybeRemoveColumn(queryInterface, 'orders', 'expiresAt');
    await maybeRemoveColumn(queryInterface, 'orders', 'customerInfo');
    await maybeRemoveColumn(queryInterface, 'orders', 'currency');
    await maybeRemoveColumn(queryInterface, 'orders', 'eventId');
    await maybeRemoveColumn(queryInterface, 'orders', 'userId');
    await maybeRemoveColumn(queryInterface, 'orders', 'orderNumber');
  }
};
