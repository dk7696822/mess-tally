require("dotenv").config();

module.exports = {
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_DATABASE || "klub_tests_db",
  synchronize: false,
  logging: process.env.NODE_ENV === "development",
  entities: ["src/entities/*.js"],
  migrations: ["src/migrations/*.js"],
  subscribers: ["src/subscribers/*.js"],
  cli: {
    entitiesDir: "src/entities",
    migrationsDir: "src/migrations",
    subscribersDir: "src/subscribers",
  },
};
