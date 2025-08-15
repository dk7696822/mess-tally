const express = require("express");
const Joi = require("joi");
const AppDataSource = require("../config/database");
const { authenticateToken, requireEditor, requireViewer } = require("../middleware/auth");

const router = express.Router();

// Validation schemas
const monthlyDataSchema = Joi.object({
  period: Joi.string()
    .pattern(/^\d{4}-\d{2}$/)
    .required(), // Format: YYYY-MM
  entries: Joi.array()
    .items(
      Joi.object({
        id: Joi.alternatives().try(Joi.string(), Joi.number()).optional(), // Allow frontend IDs but ignore them
        itemName: Joi.string().min(1).max(255).required(),
        unit: Joi.string().valid("kg", "litre", "pieces", "packets", "grams", "ml").required(),
        previousMonth: Joi.array()
          .items(
            Joi.object({
              qty: Joi.string().allow(""),
              rate: Joi.string().allow(""),
              amount: Joi.string().allow(""),
            })
          )
          .required(),
        receivedThisMonth: Joi.array()
          .items(
            Joi.object({
              qty: Joi.string().allow(""),
              rate: Joi.string().allow(""),
              amount: Joi.string().allow(""),
            })
          )
          .required(),
        consumedThisMonth: Joi.array()
          .items(
            Joi.object({
              qty: Joi.string().allow(""),
              rate: Joi.string().allow(""),
              amount: Joi.string().allow(""),
            })
          )
          .required(),
        nextMonthBalance: Joi.array()
          .items(
            Joi.object({
              qty: Joi.string().allow(""),
              rate: Joi.string().allow(""),
              amount: Joi.string().allow(""),
            })
          )
          .required(),
      })
    )
    .required(),
});

// GET monthly data for a specific period
router.get("/:period", authenticateToken, requireViewer, async (req, res) => {
  try {
    const { period } = req.params;

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return res.status(400).json({
        error: "Invalid period format. Expected YYYY-MM",
      });
    }

    const [year, month] = period.split("-").map(Number);

    // Get or create period
    const periodRepository = AppDataSource.getRepository("Period");
    let periodEntity = await periodRepository.findOne({
      where: { year, month },
    });

    if (!periodEntity) {
      // Return empty data for non-existent periods
      return res.json({
        success: true,
        period,
        entries: [],
        message: "No data found for this period",
      });
    }

    // Get items with their balances for this period
    const itemRepository = AppDataSource.getRepository("Item");
    const balanceRepository = AppDataSource.getRepository("PeriodItemBalance");
    const receiptLineRepository = AppDataSource.getRepository("ReceiptLine");
    const consumptionLineRepository = AppDataSource.getRepository("ConsumptionLine");

    const items = await itemRepository.find({
      where: { is_active: true },
      order: { name: "ASC" },
    });

    const entries = [];

    for (const item of items) {
      // Get period item balance
      const balance = await balanceRepository.findOne({
        where: { period_id: periodEntity.id, item_id: item.id },
      });

      if (!balance) continue; // Skip items without data for this period

      // Get receipts for this period and item
      const receipts = await receiptLineRepository.find({
        where: { item_id: item.id },
        relations: ["receipt"],
      });

      const periodReceipts = receipts.filter((r) => r.receipt && r.receipt.period_id === periodEntity.id);

      // Get consumptions for this period and item
      const consumptions = await consumptionLineRepository.find({
        where: { item_id: item.id },
        relations: ["consumption"],
      });

      const periodConsumptions = consumptions.filter((c) => c.consumption && c.consumption.period_id === periodEntity.id);

      // Build entry data
      const entry = {
        id: item.id,
        itemName: item.name,
        unit: item.uom,
        previousMonth: [
          {
            qty: balance.opening_qty?.toString() || "",
            rate: balance.opening_qty && balance.opening_amt && balance.opening_qty > 0 ? (balance.opening_amt / balance.opening_qty).toFixed(2) : "",
            amount: balance.opening_amt?.toString() || "",
          },
        ],
        receivedThisMonth: periodReceipts.map((r) => ({
          qty: r.quantity?.toString() || "",
          rate: r.rate?.toString() || "",
          amount: r.amount?.toString() || "",
        })),
        consumedThisMonth: periodConsumptions.map((c) => {
          const qty = parseFloat(c.entered_qty) || 0;
          // Calculate weighted average rate from available receipts for this period
          let totalReceiptQty = 0;
          let totalReceiptAmount = 0;

          periodReceipts.forEach((r) => {
            const rQty = parseFloat(r.quantity) || 0;
            const rAmount = parseFloat(r.amount) || 0;
            totalReceiptQty += rQty;
            totalReceiptAmount += rAmount;
          });

          // Add opening balance to the calculation
          const openingQty = parseFloat(balance.opening_qty) || 0;
          const openingAmt = parseFloat(balance.opening_amt) || 0;
          totalReceiptQty += openingQty;
          totalReceiptAmount += openingAmt;

          const avgRate = totalReceiptQty > 0 ? totalReceiptAmount / totalReceiptQty : 0;
          const amount = qty * avgRate;

          return {
            qty: qty.toString(),
            rate: avgRate > 0 ? avgRate.toFixed(2) : "",
            amount: amount > 0 ? amount.toFixed(2) : "",
          };
        }),
        nextMonthBalance: [
          {
            qty: balance.closing_qty?.toString() || "",
            rate: balance.closing_qty && balance.closing_amt && balance.closing_qty > 0 ? (balance.closing_amt / balance.closing_qty).toFixed(2) : "",
            amount: balance.closing_amt?.toString() || "",
          },
        ],
      };

      // Ensure arrays have at least one empty entry if no data
      if (entry.receivedThisMonth.length === 0) {
        entry.receivedThisMonth = [{ qty: "", rate: "", amount: "" }];
      }
      if (entry.consumedThisMonth.length === 0) {
        entry.consumedThisMonth = [{ qty: "", rate: "", amount: "" }];
      }

      entries.push(entry);
    }

    res.json({
      success: true,
      period,
      entries,
      savedAt: periodEntity.updated_at,
    });
  } catch (error) {
    console.error("Error loading monthly data:", error);
    res.status(500).json({
      error: "Failed to load monthly data",
    });
  }
});

// POST monthly data for a specific period
router.post("/", authenticateToken, requireEditor, async (req, res) => {
  try {
    const { error, value } = monthlyDataSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: error.details[0].message,
      });
    }

    const { period, entries } = value;
    const [year, month] = period.split("-").map(Number);

    // Start transaction
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get or create period
      const periodRepository = queryRunner.manager.getRepository("Period");
      let periodEntity = await periodRepository.findOne({
        where: { year, month },
      });

      if (!periodEntity) {
        periodEntity = periodRepository.create({
          year,
          month,
          code: period,
          created_by: req.user.id,
        });
        await periodRepository.save(periodEntity);
      }

      const itemRepository = queryRunner.manager.getRepository("Item");
      const balanceRepository = queryRunner.manager.getRepository("PeriodItemBalance");
      const receiptRepository = queryRunner.manager.getRepository("Receipt");
      const receiptLineRepository = queryRunner.manager.getRepository("ReceiptLine");
      const consumptionRepository = queryRunner.manager.getRepository("Consumption");
      const consumptionLineRepository = queryRunner.manager.getRepository("ConsumptionLine");

      for (const entry of entries) {
        if (!entry.itemName.trim()) continue; // Skip empty items

        // Get or create item
        let item = await itemRepository.findOne({
          where: { name: entry.itemName },
        });

        if (!item) {
          item = itemRepository.create({
            name: entry.itemName,
            uom: entry.unit,
          });
          await itemRepository.save(item);
        }

        // Handle period item balance
        let balance = await balanceRepository.findOne({
          where: { period_id: periodEntity.id, item_id: item.id },
        });

        if (!balance) {
          balance = balanceRepository.create({
            period_id: periodEntity.id,
            item_id: item.id,
          });
        }

        // Update balance with previous month and next month data
        if (entry.previousMonth[0]) {
          const prev = entry.previousMonth[0];
          balance.opening_qty = parseFloat(prev.qty) || 0;
          balance.opening_amt = parseFloat(prev.amount) || 0;
        }

        if (entry.nextMonthBalance[0]) {
          const next = entry.nextMonthBalance[0];
          balance.closing_qty = parseFloat(next.qty) || 0;
          balance.closing_amt = parseFloat(next.amount) || 0;
        }

        await balanceRepository.save(balance);

        // Handle receipts - clear existing and recreate
        const existingReceipts = await receiptLineRepository.find({
          where: { item_id: item.id },
          relations: ["receipt"],
        });

        for (const receiptLine of existingReceipts) {
          if (receiptLine.receipt && receiptLine.receipt.period_id === periodEntity.id) {
            await receiptLineRepository.remove(receiptLine);
          }
        }

        // Create new receipts
        for (const received of entry.receivedThisMonth) {
          if (received.qty || received.rate || received.amount) {
            let receipt = await receiptRepository.findOne({
              where: { period_id: periodEntity.id },
            });

            if (!receipt) {
              receipt = receiptRepository.create({
                period_id: periodEntity.id,
              });
              await receiptRepository.save(receipt);
            }

            const receiptLine = receiptLineRepository.create({
              receipt_id: receipt.id,
              item_id: item.id,
              quantity: parseFloat(received.qty) || 0,
              rate: parseFloat(received.rate) || 0,
              amount: parseFloat(received.amount) || 0,
              remaining_qty: parseFloat(received.qty) || 0, // Initially equals quantity
            });
            await receiptLineRepository.save(receiptLine);
          }
        }

        // Handle consumptions - clear existing and recreate
        const existingConsumptions = await consumptionLineRepository.find({
          where: { item_id: item.id },
          relations: ["consumption"],
        });

        for (const consumptionLine of existingConsumptions) {
          if (consumptionLine.consumption && consumptionLine.consumption.period_id === periodEntity.id) {
            await consumptionLineRepository.remove(consumptionLine);
          }
        }

        // Create new consumptions
        for (const consumed of entry.consumedThisMonth) {
          if (consumed.qty || consumed.rate || consumed.amount) {
            let consumption = await consumptionRepository.findOne({
              where: { period_id: periodEntity.id },
            });

            if (!consumption) {
              consumption = consumptionRepository.create({
                period_id: periodEntity.id,
              });
              await consumptionRepository.save(consumption);
            }

            const consumptionLine = consumptionLineRepository.create({
              consumption_id: consumption.id,
              item_id: item.id,
              entered_qty: parseFloat(consumed.qty) || 0,
            });
            await consumptionLineRepository.save(consumptionLine);
          }
        }
      }

      await queryRunner.commitTransaction();

      res.json({
        success: true,
        message: "Monthly data saved successfully",
        period,
        entriesCount: entries.length,
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  } catch (error) {
    console.error("Error saving monthly data:", error);
    res.status(500).json({
      error: "Failed to save monthly data",
    });
  }
});

module.exports = router;
