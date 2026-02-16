import sequelize from './config';
import User from './models/UserModel/User';
import Template from './models/TemplateModel/Template';

// Initialize associations if any
// User.hasMany(...)

export {
  sequelize,
  User,
  Template,
};
