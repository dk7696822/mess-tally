const express = require("express");
const ExcelJS = require("exceljs");
const AppDataSource = require("../config/database");
const { authenticateToken, requireViewer } = require("../middleware/auth");

const router = express.Router();

// Helper function to calculate period item balances
async function calculatePeriodItemBalances(periodCode) {
  const periodRepository = AppDataSource.getRepository("Period");
  const itemRepository = AppDataSource.getRepository("Item");

  const period = await periodRepository.findOne({ where: { code: periodCode } });
  if (!period) {
    throw new Error("Period not found");
  }

  const items = await itemRepository.find({ where: { is_active: true } });
  const balances = [];

  for (const item of items) {
    // Calculate opening balance (from previous periods)
    const openingQuery = `
      SELECT 
        COALESCE(SUM(rl.remaining_qty), 0) as opening_qty,
        COALESCE(SUM(rl.remaining_qty * rl.rate), 0) as opening_amt
      FROM receipt_lines rl
      JOIN receipts r ON rl.receipt_id = r.id
      JOIN periods p ON r.period_id = p.id
      WHERE rl.item_id = $1 
        AND (p.year < $2 OR (p.year = $2 AND p.month < $3))
        AND r.is_void = false
    `;

    const openingResult = await AppDataSource.query(openingQuery, [item.id, period.year, period.month]);

    const opening_qty = parseFloat(openingResult[0]?.opening_qty || 0);
    const opening_amt = parseFloat(openingResult[0]?.opening_amt || 0);

    // Calculate received in current period
    const receivedQuery = `
      SELECT 
        COALESCE(SUM(rl.quantity), 0) as received_qty,
        COALESCE(SUM(rl.amount), 0) as received_amt
      FROM receipt_lines rl
      JOIN receipts r ON rl.receipt_id = r.id
      WHERE rl.item_id = $1 
        AND r.period_id = $2
        AND r.is_void = false
    `;

    const receivedResult = await AppDataSource.query(receivedQuery, [item.id, period.id]);

    const received_qty = parseFloat(receivedResult[0]?.received_qty || 0);
    const received_amt = parseFloat(receivedResult[0]?.received_amt || 0);

    // Calculate consumed from opening
    const consumedFromOpeningQuery = `
      SELECT 
        COALESCE(SUM(ca.qty), 0) as cons_from_opening_qty,
        COALESCE(SUM(ca.amount), 0) as cons_from_opening_amt
      FROM consumption_allocations ca
      JOIN consumption_lines cl ON ca.consumption_line_id = cl.id
      JOIN consumptions c ON cl.consumption_id = c.id
      JOIN receipt_lines rl ON ca.receipt_line_id = rl.id
      JOIN receipts r ON rl.receipt_id = r.id
      JOIN periods rp ON r.period_id = rp.id
      WHERE cl.item_id = $1 
        AND c.period_id = $2
        AND (rp.year < $3 OR (rp.year = $3 AND rp.month < $4))
        AND c.is_void = false
    `;

    const consumedFromOpeningResult = await AppDataSource.query(consumedFromOpeningQuery, [item.id, period.id, period.year, period.month]);

    const cons_from_opening_qty = parseFloat(consumedFromOpeningResult[0]?.cons_from_opening_qty || 0);
    const cons_from_opening_amt = parseFloat(consumedFromOpeningResult[0]?.cons_from_opening_amt || 0);

    // Calculate consumed from current period
    const consumedFromCurrentQuery = `
      SELECT 
        COALESCE(SUM(ca.qty), 0) as cons_from_current_qty,
        COALESCE(SUM(ca.amount), 0) as cons_from_current_amt
      FROM consumption_allocations ca
      JOIN consumption_lines cl ON ca.consumption_line_id = cl.id
      JOIN consumptions c ON cl.consumption_id = c.id
      JOIN receipt_lines rl ON ca.receipt_line_id = rl.id
      JOIN receipts r ON rl.receipt_id = r.id
      WHERE cl.item_id = $1 
        AND c.period_id = $2
        AND r.period_id = $2
        AND c.is_void = false
    `;

    const consumedFromCurrentResult = await AppDataSource.query(consumedFromCurrentQuery, [item.id, period.id]);

    const cons_from_current_qty = parseFloat(consumedFromCurrentResult[0]?.cons_from_current_qty || 0);
    const cons_from_current_amt = parseFloat(consumedFromCurrentResult[0]?.cons_from_current_amt || 0);

    // Calculate closing balance
    const closing_qty = opening_qty + received_qty - cons_from_opening_qty - cons_from_current_qty;
    const closing_amt = opening_amt + received_amt - cons_from_opening_amt - cons_from_current_amt;

    // Calculate average rates
    const opening_avg_rate = opening_qty > 0 ? opening_amt / opening_qty : 0;
    const received_avg_rate = received_qty > 0 ? received_amt / received_qty : 0;
    const closing_avg_rate = closing_qty > 0 ? closing_amt / closing_qty : 0;

    balances.push({
      itemId: item.id,
      itemName: item.name,
      uom: item.uom,
      opening: {
        qty: Number(opening_qty.toFixed(3)),
        amt: Number(opening_amt.toFixed(2)),
        avgRate: Number(opening_avg_rate.toFixed(2)),
      },
      received: {
        qty: Number(received_qty.toFixed(3)),
        amt: Number(received_amt.toFixed(2)),
        avgRate: Number(received_avg_rate.toFixed(2)),
      },
      consumed: {
        fromOpening: {
          qty: Number(cons_from_opening_qty.toFixed(3)),
          amt: Number(cons_from_opening_amt.toFixed(2)),
          avgRate: cons_from_opening_qty > 0 ? Number((cons_from_opening_amt / cons_from_opening_qty).toFixed(2)) : 0,
        },
        fromCurrent: {
          qty: Number(cons_from_current_qty.toFixed(3)),
          amt: Number(cons_from_current_amt.toFixed(2)),
          avgRate: cons_from_current_qty > 0 ? Number((cons_from_current_amt / cons_from_current_qty).toFixed(2)) : 0,
        },
        total: {
          qty: Number((cons_from_opening_qty + cons_from_current_qty).toFixed(3)),
          amt: Number((cons_from_opening_amt + cons_from_current_amt).toFixed(2)),
          avgRate: cons_from_opening_qty + cons_from_current_qty > 0 ? Number(((cons_from_opening_amt + cons_from_current_amt) / (cons_from_opening_qty + cons_from_current_qty)).toFixed(2)) : 0,
        },
      },
      closing: {
        qty: Number(closing_qty.toFixed(3)),
        amt: Number(closing_amt.toFixed(2)),
        avgRate: Number(closing_avg_rate.toFixed(2)),
      },
    });
  }

  return balances;
}

// Get period item balances
router.get("/reports/period-item-balances", authenticateToken, requireViewer, async (req, res) => {
  try {
    const { period } = req.query;

    if (!period) {
      return res.status(400).json({ error: "Period parameter is required" });
    }

    const balances = await calculatePeriodItemBalances(period);

    res.json({ balances, period });
  } catch (error) {
    console.error("Get period item balances error:", error);

    if (error.message === "Period not found") {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

// Export period to Excel
router.get("/exports/period/:code.xlsx", authenticateToken, requireViewer, async (req, res) => {
  try {
    const { code } = req.params;

    const balances = await calculatePeriodItemBalances(code);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();

    // Summary sheet
    const summarySheet = workbook.addWorksheet("Summary");

    // Headers
    summarySheet.addRow([
      "Item",
      "UOM",
      "Previous Month Qty",
      "Previous Month Rate",
      "Previous Month Amount",
      "Received Qty",
      "Received Rate",
      "Received Amount",
      "Gross Total",
      "Consumed from Previous Qty",
      "Consumed from Previous Rate",
      "Consumed from Previous Amount",
      "Consumed from Current Qty",
      "Consumed from Current Rate",
      "Consumed from Current Amount",
      "Next Month Qty",
      "Next Month Rate",
      "Next Month Amount",
      "Tally Check",
    ]);

    // Data rows
    for (const balance of balances) {
      const grossTotal = balance.opening.amt + balance.received.amt;
      const tallyCheck = grossTotal - (balance.consumed.fromOpening.amt + balance.consumed.fromCurrent.amt + balance.closing.amt);

      summarySheet.addRow([
        balance.itemName,
        balance.uom,
        balance.opening.qty,
        balance.opening.avgRate,
        balance.opening.amt,
        balance.received.qty,
        balance.received.avgRate,
        balance.received.amt,
        grossTotal,
        balance.consumed.fromOpening.qty,
        balance.consumed.fromOpening.avgRate,
        balance.consumed.fromOpening.amt,
        balance.consumed.fromCurrent.qty,
        balance.consumed.fromCurrent.avgRate,
        balance.consumed.fromCurrent.amt,
        balance.closing.qty,
        balance.closing.avgRate,
        balance.closing.amt,
        Number(tallyCheck.toFixed(2)),
      ]);
    }

    // Style the header row
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Set response headers
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="period-${code}.xlsx"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Export period error:", error);

    if (error.message === "Period not found") {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

module.exports = router;
