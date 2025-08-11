const express = require("express");
const Joi = require("joi");
const AppDataSource = require("../config/database");
const { authenticateToken, requireEditor, requireViewer } = require("../middleware/auth");
const { validateUUIDParam, commonSchemas, handleValidationError } = require("../utils/validation");

const router = express.Router();

// Validation schemas
const createItemSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  uom: Joi.string().min(1).max(50).default("kg"),
  is_active: commonSchemas.boolean,
});

const updateItemSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  uom: Joi.string().min(1).max(50).optional(),
  is_active: Joi.boolean().optional(),
});

// Get all items
router.get("/", authenticateToken, requireViewer, async (req, res) => {
  try {
    const { active } = req.query;
    const itemRepository = AppDataSource.getRepository("Item");

    const queryBuilder = itemRepository.createQueryBuilder("item");

    if (active === "true") {
      queryBuilder.where("item.is_active = :active", { active: true });
    }

    queryBuilder.orderBy("item.name", "ASC");

    const items = await queryBuilder.getMany();

    res.json({
      items,
      total: items.length,
    });
  } catch (error) {
    console.error("Get items error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get item by ID
router.get("/:id", authenticateToken, requireViewer, validateUUIDParam(), async (req, res) => {
  try {
    const { id } = req.params;
    const itemRepository = AppDataSource.getRepository("Item");

    const item = await itemRepository.findOne({ where: { id } });

    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    res.json({ item });
  } catch (error) {
    console.error("Get item error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create new item
router.post("/", authenticateToken, requireEditor, async (req, res) => {
  try {
    const { error, value } = createItemSchema.validate(req.body);
    if (error) {
      return handleValidationError(error, res);
    }

    const itemRepository = AppDataSource.getRepository("Item");

    // Check if item with same name already exists
    const existingItem = await itemRepository.findOne({
      where: { name: value.name },
    });

    if (existingItem) {
      return res.status(409).json({ error: "Item with this name already exists" });
    }

    const item = itemRepository.create(value);
    await itemRepository.save(item);

    res.status(201).json({
      message: "Item created successfully",
      item,
    });
  } catch (error) {
    console.error("Create item error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update item
router.put("/:id", authenticateToken, requireEditor, validateUUIDParam(), async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = updateItemSchema.validate(req.body);

    if (error) {
      return handleValidationError(error, res);
    }

    const itemRepository = AppDataSource.getRepository("Item");

    const item = await itemRepository.findOne({ where: { id } });
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    // Check if name is being changed and if new name already exists
    if (value.name && value.name !== item.name) {
      const existingItem = await itemRepository.findOne({
        where: { name: value.name },
      });

      if (existingItem) {
        return res.status(409).json({ error: "Item with this name already exists" });
      }
    }

    // Update item
    Object.assign(item, value);
    await itemRepository.save(item);

    res.json({
      message: "Item updated successfully",
      item,
    });
  } catch (error) {
    console.error("Update item error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Soft delete item (set is_active to false)
router.delete("/:id", authenticateToken, requireEditor, validateUUIDParam(), async (req, res) => {
  try {
    const { id } = req.params;
    const itemRepository = AppDataSource.getRepository("Item");

    const item = await itemRepository.findOne({ where: { id } });
    if (!item) {
      return res.status(404).json({ error: "Item not found" });
    }

    // Check if item has any receipt lines or consumption lines
    const receiptLineRepository = AppDataSource.getRepository("ReceiptLine");
    const consumptionLineRepository = AppDataSource.getRepository("ConsumptionLine");

    const receiptLineCount = await receiptLineRepository.count({
      where: { item_id: id },
    });
    const consumptionLineCount = await consumptionLineRepository.count({
      where: { item_id: id },
    });

    if (receiptLineCount > 0 || consumptionLineCount > 0) {
      // Soft delete - just mark as inactive
      item.is_active = false;
      await itemRepository.save(item);

      res.json({
        message: "Item deactivated successfully (has transaction history)",
        item,
      });
    } else {
      // Hard delete if no transactions
      await itemRepository.remove(item);

      res.json({
        message: "Item deleted successfully",
      });
    }
  } catch (error) {
    console.error("Delete item error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
