const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const AppDataSource = require("./config/database");

// Import routes
const authRoutes = require("./routes/auth");
const itemRoutes = require("./routes/items");
const periodRoutes = require("./routes/periods");
const receiptRoutes = require("./routes/receipts");
const consumptionRoutes = require("./routes/consumptions");
const reportRoutes = require("./routes/reports");

const app = express();
const PORT = process.env.PORT || 3001;

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, "../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Helper functions for data storage
const getMonthlyDataPath = (period) => path.join(dataDir, `monthly-${period}.json`);

const saveMonthlyData = (period, data) => {
  try {
    const filePath = getMonthlyDataPath(period);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Error saving monthly data:", error);
    return false;
  }
};

const loadMonthlyData = (period) => {
  try {
    const filePath = getMonthlyDataPath(period);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error("Error loading monthly data:", error);
    return null;
  }
};

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Trust proxy for rate limiting
app.set("trust proxy", 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/items", itemRoutes);
app.use("/api/periods", periodRoutes);
app.use("/api/receipts", receiptRoutes);
app.use("/api/consumptions", consumptionRoutes);
app.use("/api", reportRoutes); // Reports includes both /api/reports and /api/exports

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// GET monthly data endpoint
app.get("/api/monthly-data/:period", (req, res) => {
  try {
    const { period } = req.params;

    if (!period) {
      return res.status(400).json({
        error: "Period parameter is required",
      });
    }

    const data = loadMonthlyData(period);

    if (data) {
      res.json({
        success: true,
        period,
        entries: data.entries || [],
        savedAt: data.savedAt,
      });
    } else {
      res.json({
        success: true,
        period,
        entries: [],
        message: "No data found for this period",
      });
    }
  } catch (error) {
    console.error("Error loading monthly data:", error);
    res.status(500).json({
      error: "Failed to load monthly data",
    });
  }
});

// POST monthly data endpoint
app.post("/api/monthly-data", (req, res) => {
  try {
    const { period, entries } = req.body;

    // Validate required fields
    if (!period || !entries || !Array.isArray(entries)) {
      return res.status(400).json({
        error: "Period and entries array are required",
      });
    }

    // Prepare data to save
    const dataToSave = {
      period,
      entries,
      savedAt: new Date().toISOString(),
      entriesCount: entries.length,
    };

    // Save to file
    const saved = saveMonthlyData(period, dataToSave);

    if (saved) {
      console.log(`Monthly data saved for period: ${period}`);
      console.log(`Number of entries: ${entries.length}`);

      res.json({
        success: true,
        message: "Monthly data saved successfully",
        period,
        entriesCount: entries.length,
      });
    } else {
      res.status(500).json({
        error: "Failed to save monthly data to storage",
      });
    }
  } catch (error) {
    console.error("Error saving monthly data:", error);
    res.status(500).json({
      error: "Failed to save monthly data",
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Initialize database and start server
async function startServer() {
  try {
    await AppDataSource.initialize();
    console.log("Database connection established");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

startServer();
