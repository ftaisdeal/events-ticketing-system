import { DataTypes, Sequelize } from 'sequelize';

const createCategoryModel = (sequelize: Sequelize) => {
  const Category = sequelize.define('Category', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    slug: { type: DataTypes.STRING, allowNull: false, unique: true }
  });
  return Category;
};

export default createCategoryModel;