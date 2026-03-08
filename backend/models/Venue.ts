import { DataTypes, Sequelize } from 'sequelize';

const createVenueModel = (sequelize: Sequelize) => {
  const Venue = sequelize.define('Venue', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    address: { type: DataTypes.STRING }
  });
  return Venue;
};

export default createVenueModel;