import { Sequelize } from 'sequelize';
import path from 'path';
import { app } from 'electron';
import sqlite3 from 'sqlite3';
import 'dotenv/config';

const isProduction = process.env.NODE_ENV === 'production' || app.isPackaged;

const dbPath = isProduction
  ? path.join(process.resourcesPath, 'database.sqlite')
  : path.join(__dirname, '../../../database.sqlite');

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  dialectModule: sqlite3,
  storage: dbPath,
  logging: false,
});

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ SQLite connected at:', dbPath);
  } catch (error: any) {
    console.error('❌ DB connection failed:', error.message);
  }
};

export default sequelize;
