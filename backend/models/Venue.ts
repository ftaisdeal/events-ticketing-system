import { DataTypes, Sequelize } from 'sequelize';

const createVenueModel = (sequelize: Sequelize) => {
  const Venue = sequelize.define('Venue', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    address: { type: DataTypes.TEXT, allowNull: false },
    city: { type: DataTypes.STRING, allowNull: false },
    state: { type: DataTypes.STRING, allowNull: true },
    country: { type: DataTypes.STRING, allowNull: false },
    postalCode: { type: DataTypes.STRING, allowNull: true }
  }, {
    tableName: 'venues',
    timestamps: true
  });

  return Venue;
};

export default createVenueModel;