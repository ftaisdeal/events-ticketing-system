module.exports = (sequelize, DataTypes) => {
  const Venue = sequelize.define('Venue', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    address: { type: DataTypes.STRING }
  });
  return Venue;
};