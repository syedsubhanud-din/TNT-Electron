import { Sequelize } from "sequelize";
import "dotenv/config";

export const sequelize = new Sequelize(
  process.env.DB_NAME || 'postgres',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    dialect: "postgres",
    logging: false,
  }
);

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Docker PostgreSQL connected");
  } catch (error: any) {
    console.error("❌ DB connection failed:", error.message);
  }
};

export default sequelize;