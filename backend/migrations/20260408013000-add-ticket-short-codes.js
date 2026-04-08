'use strict';

const SHORT_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SHORT_CODE_LENGTH = 8;

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

const generateShortCode = (usedCodes) => {
  while (true) {
    let code = '';
    for (let index = 0; index < SHORT_CODE_LENGTH; index += 1) {
      const nextIndex = Math.floor(Math.random() * SHORT_CODE_ALPHABET.length);
      code += SHORT_CODE_ALPHABET[nextIndex];
    }

    if (!usedCodes.has(code)) {
      usedCodes.add(code);
      return code;
    }
  }
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await maybeAddColumn(queryInterface, 'tickets', 'shortCode', {
      type: Sequelize.STRING(16),
      allowNull: true,
      unique: true
    });

    const [rows] = await queryInterface.sequelize.query('SELECT id, shortCode FROM tickets ORDER BY id ASC;');
    const usedCodes = new Set(rows.map((row) => row.shortCode).filter(Boolean));

    for (const row of rows) {
      if (row.shortCode) {
        continue;
      }

      const shortCode = generateShortCode(usedCodes);
      await queryInterface.sequelize.query('UPDATE tickets SET shortCode = :shortCode WHERE id = :id', {
        replacements: {
          shortCode,
          id: row.id
        }
      });
    }

    await queryInterface.changeColumn('tickets', 'shortCode', {
      type: Sequelize.STRING(16),
      allowNull: false,
      unique: true
    });
  },

  async down(queryInterface) {
    await maybeRemoveColumn(queryInterface, 'tickets', 'shortCode');
  }
};