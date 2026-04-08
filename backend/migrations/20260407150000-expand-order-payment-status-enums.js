'use strict';

const ORDER_STATUS_VALUES = ['pending', 'confirmed', 'cancelled', 'refunded', 'failed', 'expired'];
const PAYMENT_STATUS_VALUES = ['pending', 'succeeded', 'failed', 'cancelled', 'refunded', 'expired'];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('orders', 'status', {
      type: Sequelize.ENUM(...ORDER_STATUS_VALUES),
      allowNull: false,
      defaultValue: 'pending'
    });

    await queryInterface.changeColumn('payments', 'status', {
      type: Sequelize.ENUM(...PAYMENT_STATUS_VALUES),
      allowNull: false,
      defaultValue: 'pending'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        "UPDATE orders SET status = 'cancelled' WHERE status IN ('failed', 'expired')",
        { transaction }
      );

      await queryInterface.sequelize.query(
        "UPDATE payments SET status = 'failed' WHERE status = 'expired'",
        { transaction }
      );

      await queryInterface.changeColumn('orders', 'status', {
        type: Sequelize.ENUM('pending', 'confirmed', 'cancelled', 'refunded'),
        allowNull: false,
        defaultValue: 'pending',
        transaction
      });

      await queryInterface.changeColumn('payments', 'status', {
        type: Sequelize.ENUM('pending', 'succeeded', 'failed', 'cancelled', 'refunded'),
        allowNull: false,
        defaultValue: 'pending',
        transaction
      });
    });
  }
};