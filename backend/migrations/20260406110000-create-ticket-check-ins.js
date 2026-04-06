'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const normalizedTables = tables.map((tableName) => String(tableName));

    if (normalizedTables.includes('ticket_check_ins')) {
      return;
    }

    await queryInterface.createTable('ticket_check_ins', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      ticketId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'tickets',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      eventId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'events',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      scannedByUserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      source: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'scanner'
      },
      deviceId: {
        type: Sequelize.STRING(128),
        allowNull: true
      },
      notes: {
        type: Sequelize.STRING(255),
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('ticket_check_ins', ['eventId'], {
      name: 'ticket_check_ins_event_idx'
    });
    await queryInterface.addIndex('ticket_check_ins', ['scannedByUserId'], {
      name: 'ticket_check_ins_staff_idx'
    });
    await queryInterface.addIndex('ticket_check_ins', ['source'], {
      name: 'ticket_check_ins_source_idx'
    });
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const normalizedTables = tables.map((tableName) => String(tableName));

    if (!normalizedTables.includes('ticket_check_ins')) {
      return;
    }

    await queryInterface.dropTable('ticket_check_ins');
  }
};