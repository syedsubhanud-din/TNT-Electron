import { DataTypes } from 'sequelize';
import { sequelize } from '../../config';

const Template = sequelize.define('Template', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  mfgDate: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  expDate: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  gtin: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  batch: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  tmdaReg: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  serialNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  timestamps: true,
});

export default Template;
