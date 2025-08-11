const express = require("express");
const Joi = require("joi");
const AppDataSource = require("../config/database");
const { authenticateToken, requireEditor, requireViewer } = require("../middleware/auth");

const router = express.Router();

// Validation schemas
const consumptionLineSchema = Joi.object({
  itemId: Joi.string().uuid().required(),
  qty: Joi.number().positive().required(),
});

const createConsumptionSchema = Joi.object({
  periodCode: Joi.string()
    .pattern(/^\d{4}-\d{2}$/)
    .required(),
  notes: Joi.string().allow("").optional(),
  lines: Joi.array().items(consumptionLineSchema).min(1).required(),
});

const updateConsumptionSchema = Joi.object({
  notes: Joi.string().allow("").optional(),
  lines: Joi.array()
    .items(
      consumptionLineSchema.keys({
        lineId: Joi.string().uuid().optional(),
      })
    )
    .optional(),
});

const voidConsumptionSchema = Joi.object({
  reason: Joi.string().max(500).allow("").optional(),
});

// FIFO allocation function
async function allocateConsumption(queryRunner, itemId, requestedQty, periodId) {
  const receiptLineRepository = queryRunner.manager.getRepository("ReceiptLine");

  // Get available lots ordered by FIFO (oldest first)
  const availableLots = await receiptLineRepository
    .createQueryBuilder("rl")
    .leftJoinAndSelect("rl.receipt", "r")
    .leftJoinAndSelect("r.period", "p")
    .where("rl.item_id = :itemId", { itemId })
    .andWhere("rl.remaining_qty > 0")
    .andWhere("r.is_void = false")
    .orderBy("p.year", "ASC")
    .addOrderBy("p.month", "ASC")
    .addOrderBy("rl.id", "ASC")
    .getMany();

  let remainingQty = requestedQty;
  const allocations = [];

  for (const lot of availableLots) {
    if (remainingQty <= 0) break;

    const allocateQty = Math.min(remainingQty, lot.remaining_qty);

    allocations.push({
      receipt_line_id: lot.id,
      qty: allocateQty,
      rate: lot.rate,
      amount: Number((allocateQty * lot.rate).toFixed(2)),
    });

    // Update remaining quantity
    lot.remaining_qty = Number((lot.remaining_qty - allocateQty).toFixed(3));
    await receiptLineRepository.save(lot);

    remainingQty = Number((remainingQty - allocateQty).toFixed(3));
  }

  if (remainingQty > 0) {
    throw new Error(`Insufficient stock for item. Required: ${requestedQty}, Available: ${requestedQty - remainingQty}`);
  }

  return allocations;
}

// Get all consumptions
router.get("/", authenticateToken, requireViewer, async (req, res) => {
  try {
    const { period, itemId, includeLines } = req.query;
    const consumptionRepository = AppDataSource.getRepository("Consumption");

    const queryBuilder = consumptionRepository.createQueryBuilder("consumption").leftJoinAndSelect("consumption.period", "period").where("consumption.is_void = :isVoid", { isVoid: false });

    if (period) {
      queryBuilder.andWhere("period.code = :period", { period });
    }

    if (includeLines === "true") {
      queryBuilder
        .leftJoinAndSelect("consumption.lines", "lines")
        .leftJoinAndSelect("lines.item", "item")
        .leftJoinAndSelect("lines.allocations", "allocations")
        .leftJoinAndSelect("allocations.receipt_line", "receipt_line");

      if (itemId) {
        queryBuilder.andWhere("lines.item_id = :itemId", { itemId });
      }
    }

    queryBuilder.orderBy("consumption.created_at", "DESC");

    const consumptions = await queryBuilder.getMany();

    res.json({ consumptions });
  } catch (error) {
    console.error("Get consumptions error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get consumption by ID
router.get("/:id", authenticateToken, requireViewer, async (req, res) => {
  try {
    const { id } = req.params;
    const consumptionRepository = AppDataSource.getRepository("Consumption");

    const consumption = await consumptionRepository.findOne({
      where: { id },
      relations: ["period", "lines", "lines.item", "lines.allocations", "lines.allocations.receipt_line", "voider"],
    });

    if (!consumption) {
      return res.status(404).json({ error: "Consumption not found" });
    }

    res.json({ consumption });
  } catch (error) {
    console.error("Get consumption error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create new consumption
router.post("/", authenticateToken, requireEditor, async (req, res) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { error, value } = createConsumptionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { periodCode, notes, lines } = value;

    // Get period
    const periodRepository = queryRunner.manager.getRepository("Period");
    const period = await periodRepository.findOne({ where: { code: periodCode } });

    if (!period) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({ error: "Period not found" });
    }

    if (period.status !== "OPEN") {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({ error: "Period is not open for new consumptions" });
    }

    // Validate all items exist
    const itemRepository = queryRunner.manager.getRepository("Item");
    const itemIds = lines.map((line) => line.itemId);
    const items = await itemRepository.findByIds(itemIds);

    if (items.length !== itemIds.length) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({ error: "One or more items not found" });
    }

    // Create consumption
    const consumptionRepository = queryRunner.manager.getRepository("Consumption");
    const consumption = consumptionRepository.create({
      period_id: period.id,
      notes,
    });

    await consumptionRepository.save(consumption);

    // Create consumption lines and allocations
    const consumptionLineRepository = queryRunner.manager.getRepository("ConsumptionLine");
    const allocationRepository = queryRunner.manager.getRepository("ConsumptionAllocation");

    for (const lineData of lines) {
      // Create consumption line
      const consumptionLine = consumptionLineRepository.create({
        consumption_id: consumption.id,
        item_id: lineData.itemId,
        entered_qty: lineData.qty,
      });

      await consumptionLineRepository.save(consumptionLine);

      // Perform FIFO allocation
      const allocations = await allocateConsumption(queryRunner, lineData.itemId, lineData.qty, period.id);

      // Save allocations
      for (const allocationData of allocations) {
        const allocation = allocationRepository.create({
          consumption_line_id: consumptionLine.id,
          ...allocationData,
        });

        await allocationRepository.save(allocation);
      }
    }

    await queryRunner.commitTransaction();

    // Fetch the complete consumption with relations
    const completeConsumption = await consumptionRepository.findOne({
      where: { id: consumption.id },
      relations: ["period", "lines", "lines.item", "lines.allocations", "lines.allocations.receipt_line"],
    });

    res.status(201).json({
      message: "Consumption created successfully",
      consumption: completeConsumption,
    });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error("Create consumption error:", error);

    if (error.message.includes("Insufficient stock")) {
      res.status(409).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  } finally {
    await queryRunner.release();
  }
});

// Void consumption
router.post("/:id/void", authenticateToken, requireEditor, async (req, res) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { id } = req.params;

    // Validate request body
    const { error, value } = voidConsumptionSchema.validate(req.body);
    if (error) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({ error: error.details[0].message });
    }

    const { reason } = value;

    const consumptionRepository = queryRunner.manager.getRepository("Consumption");
    const consumption = await consumptionRepository.findOne({
      where: { id },
      relations: ["lines", "lines.allocations"],
    });

    if (!consumption) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({ error: "Consumption not found" });
    }

    if (consumption.is_void) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({ error: "Consumption is already voided" });
    }

    // Reverse all allocations
    const receiptLineRepository = queryRunner.manager.getRepository("ReceiptLine");

    for (const line of consumption.lines) {
      for (const allocation of line.allocations) {
        // Restore quantity to receipt line
        const receiptLine = await receiptLineRepository.findOne({
          where: { id: allocation.receipt_line_id },
        });

        if (receiptLine) {
          receiptLine.remaining_qty = Number((receiptLine.remaining_qty + allocation.qty).toFixed(3));
          await receiptLineRepository.save(receiptLine);
        }
      }
    }

    // Void the consumption
    consumption.is_void = true;
    consumption.void_reason = reason;
    consumption.voided_at = new Date();
    consumption.voided_by = req.user.id;

    await consumptionRepository.save(consumption);
    await queryRunner.commitTransaction();

    res.json({
      message: "Consumption voided successfully",
      consumption,
    });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error("Void consumption error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    await queryRunner.release();
  }
});

module.exports = router;
