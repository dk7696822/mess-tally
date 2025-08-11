const express = require("express");
const Joi = require("joi");
const AppDataSource = require("../config/database");
const { authenticateToken, requireEditor, requireViewer } = require("../middleware/auth");

const router = express.Router();

// Validation schemas
const receiptLineSchema = Joi.object({
  itemId: Joi.string().uuid().required(),
  quantity: Joi.number().positive().required(),
  rate: Joi.number().min(0).required(),
  lotNo: Joi.string().max(255).allow("").optional(),
});

const createReceiptSchema = Joi.object({
  periodCode: Joi.string()
    .pattern(/^\d{4}-\d{2}$/)
    .required(),
  refNo: Joi.string().max(255).allow("").optional(),
  notes: Joi.string().allow("").optional(),
  lines: Joi.array().items(receiptLineSchema).min(1).required(),
});

const updateReceiptSchema = Joi.object({
  refNo: Joi.string().max(255).allow("").optional(),
  notes: Joi.string().allow("").optional(),
  lines: Joi.array()
    .items(
      receiptLineSchema.keys({
        lineId: Joi.string().uuid().optional(), // For updating existing lines
      })
    )
    .optional(),
});

const voidReceiptSchema = Joi.object({
  reason: Joi.string().max(500).allow("").optional(),
});

// Get all receipts
router.get("/", authenticateToken, requireViewer, async (req, res) => {
  try {
    const { period, itemId, includeLines } = req.query;
    const receiptRepository = AppDataSource.getRepository("Receipt");

    const queryBuilder = receiptRepository.createQueryBuilder("receipt").leftJoinAndSelect("receipt.period", "period").where("receipt.is_void = :isVoid", { isVoid: false });

    if (period) {
      queryBuilder.andWhere("period.code = :period", { period });
    }

    if (includeLines === "true") {
      queryBuilder.leftJoinAndSelect("receipt.lines", "lines").leftJoinAndSelect("lines.item", "item");

      if (itemId) {
        queryBuilder.andWhere("lines.item_id = :itemId", { itemId });
      }
    }

    queryBuilder.orderBy("receipt.created_at", "DESC");

    const receipts = await queryBuilder.getMany();

    res.json({ receipts });
  } catch (error) {
    console.error("Get receipts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get receipt by ID
router.get("/:id", authenticateToken, requireViewer, async (req, res) => {
  try {
    const { id } = req.params;
    const receiptRepository = AppDataSource.getRepository("Receipt");

    const receipt = await receiptRepository.findOne({
      where: { id },
      relations: ["period", "lines", "lines.item", "voider"],
    });

    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    res.json({ receipt });
  } catch (error) {
    console.error("Get receipt error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create new receipt
router.post("/", authenticateToken, requireEditor, async (req, res) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { error, value } = createReceiptSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { periodCode, refNo, notes, lines } = value;

    // Get period
    const periodRepository = queryRunner.manager.getRepository("Period");
    const period = await periodRepository.findOne({ where: { code: periodCode } });

    if (!period) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({ error: "Period not found" });
    }

    if (period.status !== "OPEN") {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({ error: "Period is not open for new receipts" });
    }

    // Validate all items exist
    const itemRepository = queryRunner.manager.getRepository("Item");
    const itemIds = lines.map((line) => line.itemId);
    const items = await itemRepository.findByIds(itemIds);

    if (items.length !== itemIds.length) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({ error: "One or more items not found" });
    }

    // Create receipt
    const receiptRepository = queryRunner.manager.getRepository("Receipt");
    const receipt = receiptRepository.create({
      period_id: period.id,
      ref_no: refNo,
      notes,
    });

    await receiptRepository.save(receipt);

    // Create receipt lines
    const receiptLineRepository = queryRunner.manager.getRepository("ReceiptLine");
    const receiptLines = [];

    for (const lineData of lines) {
      const amount = Number((lineData.quantity * lineData.rate).toFixed(2));

      const receiptLine = receiptLineRepository.create({
        receipt_id: receipt.id,
        item_id: lineData.itemId,
        quantity: lineData.quantity,
        rate: lineData.rate,
        amount,
        remaining_qty: lineData.quantity, // Initially equals quantity
        lot_no: lineData.lotNo,
      });

      await receiptLineRepository.save(receiptLine);
      receiptLines.push(receiptLine);
    }

    await queryRunner.commitTransaction();

    // Fetch the complete receipt with relations
    const completeReceipt = await receiptRepository.findOne({
      where: { id: receipt.id },
      relations: ["period", "lines", "lines.item"],
    });

    res.status(201).json({
      message: "Receipt created successfully",
      receipt: completeReceipt,
    });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error("Create receipt error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    await queryRunner.release();
  }
});

// Update receipt
router.put("/:id", authenticateToken, requireEditor, async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = updateReceiptSchema.validate(req.body);

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const receiptRepository = AppDataSource.getRepository("Receipt");
    const receipt = await receiptRepository.findOne({
      where: { id },
      relations: ["period", "lines"],
    });

    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    if (receipt.is_void) {
      return res.status(400).json({ error: "Cannot update voided receipt" });
    }

    if (receipt.period.status !== "OPEN") {
      return res.status(400).json({ error: "Cannot update receipt in closed period" });
    }

    // Check if any lines have been used in allocations
    if (value.lines) {
      const receiptLineRepository = AppDataSource.getRepository("ReceiptLine");
      for (const line of receipt.lines) {
        if (line.remaining_qty < line.quantity) {
          return res.status(400).json({
            error: "Cannot modify receipt lines that have been partially consumed",
          });
        }
      }
    }

    // Update basic fields
    if (value.refNo !== undefined) receipt.ref_no = value.refNo;
    if (value.notes !== undefined) receipt.notes = value.notes;

    await receiptRepository.save(receipt);

    // TODO: Implement line updates if needed
    // This is complex as it involves checking allocations

    const updatedReceipt = await receiptRepository.findOne({
      where: { id },
      relations: ["period", "lines", "lines.item"],
    });

    res.json({
      message: "Receipt updated successfully",
      receipt: updatedReceipt,
    });
  } catch (error) {
    console.error("Update receipt error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Void receipt
router.post("/:id/void", authenticateToken, requireEditor, async (req, res) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { id } = req.params;

    // Validate request body
    const { error, value } = voidReceiptSchema.validate(req.body);
    if (error) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({ error: error.details[0].message });
    }

    const { reason } = value;

    const receiptRepository = queryRunner.manager.getRepository("Receipt");
    const receipt = await receiptRepository.findOne({
      where: { id },
      relations: ["lines"],
    });

    if (!receipt) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({ error: "Receipt not found" });
    }

    if (receipt.is_void) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({ error: "Receipt is already voided" });
    }

    // Check if all lines are unused (remaining_qty equals quantity)
    for (const line of receipt.lines) {
      if (line.remaining_qty < line.quantity) {
        await queryRunner.rollbackTransaction();
        return res.status(400).json({
          error: "Cannot void receipt with partially consumed lines",
        });
      }
    }

    // Void the receipt
    receipt.is_void = true;
    receipt.void_reason = reason;
    receipt.voided_at = new Date();
    receipt.voided_by = req.user.id;

    await receiptRepository.save(receipt);
    await queryRunner.commitTransaction();

    res.json({
      message: "Receipt voided successfully",
      receipt,
    });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error("Void receipt error:", error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    await queryRunner.release();
  }
});

module.exports = router;
