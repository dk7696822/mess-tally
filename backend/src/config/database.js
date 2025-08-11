const { DataSource } = require("typeorm");
require("dotenv").config();

// Import entities
const User = require("../entities/User");
const Item = require("../entities/Item");
const Period = require("../entities/Period");
const Receipt = require("../entities/Receipt");
const ReceiptLine = require("../entities/ReceiptLine");
const Consumption = require("../entities/Consumption");
const ConsumptionLine = require("../entities/ConsumptionLine");
const ConsumptionAllocation = require("../entities/ConsumptionAllocation");
const PeriodItemBalance = require("../entities/PeriodItemBalance");

const AppDataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_DATABASE || "klub_tests_db",
  synchronize: false, // Always use migrations in production
  logging: process.env.NODE_ENV === "development",
  entities: [User, Item, Period, Receipt, ReceiptLine, Consumption, ConsumptionLine, ConsumptionAllocation, PeriodItemBalance],
  migrations: ["src/migrations/*.js"],
  subscribers: ["src/subscribers/*.js"],
});

module.exports = AppDataSource;
