import { DataTypes } from 'sequelize';
import sequelize from '../../config';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true,
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // Example of using hstore if they really want it, but usually it's for dynamic data
  settings: {
    type: DataTypes.HSTORE,
    allowNull: true,
  },
}, {
  timestamps: true,
});

export default User;
