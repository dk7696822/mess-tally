const express = require('express');
const Joi = require('joi');
const AppDataSource = require('../config/database');
const { authenticateToken, requireEditor, requireViewer, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const createPeriodSchema = Joi.object({
  code: Joi.string().pattern(/^\d{4}-\d{2}$/).required(), // Format: YYYY-MM
});

// Get all periods
router.get('/', authenticateToken, requireViewer, async (req, res) => {
  try {
    const periodRepository = AppDataSource.getRepository('Period');
    
    const periods = await periodRepository.find({
      order: { year: 'DESC', month: 'DESC' },
      relations: ['creator', 'closer']
    });

    res.json({ periods });
  } catch (error) {
    console.error('Get periods error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get period by ID
router.get('/:id', authenticateToken, requireViewer, async (req, res) => {
  try {
    const { id } = req.params;
    const periodRepository = AppDataSource.getRepository('Period');
    
    const period = await periodRepository.findOne({
      where: { id },
      relations: ['creator', 'closer']
    });
    
    if (!period) {
      return res.status(404).json({ error: 'Period not found' });
    }
    
    res.json({ period });
  } catch (error) {
    console.error('Get period error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new period
router.post('/', authenticateToken, requireEditor, async (req, res) => {
  try {
    const { error, value } = createPeriodSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { code } = value;
    const [year, month] = code.split('-').map(Number);

    const periodRepository = AppDataSource.getRepository('Period');
    
    // Check if period already exists
    const existingPeriod = await periodRepository.findOne({
      where: { year, month }
    });
    
    if (existingPeriod) {
      return res.status(409).json({ error: 'Period already exists' });
    }

    // Check if there's already an open period
    const openPeriod = await periodRepository.findOne({
      where: { status: 'OPEN' }
    });
    
    if (openPeriod) {
      return res.status(409).json({ 
        error: 'Another period is already open. Close it first.',
        openPeriod: openPeriod.code
      });
    }

    const period = periodRepository.create({
      code,
      year,
      month,
      status: 'OPEN',
      opened_at: new Date(),
      created_by: req.user.id
    });

    await periodRepository.save(period);

    res.status(201).json({
      message: 'Period created successfully',
      period
    });
  } catch (error) {
    console.error('Create period error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Close period
router.post('/:id/close', authenticateToken, requireEditor, async (req, res) => {
  try {
    const { id } = req.params;
    const periodRepository = AppDataSource.getRepository('Period');
    
    const period = await periodRepository.findOne({ where: { id } });
    if (!period) {
      return res.status(404).json({ error: 'Period not found' });
    }

    if (period.status !== 'OPEN') {
      return res.status(400).json({ error: 'Period is not open' });
    }

    // TODO: Implement period closing logic
    // 1. Verify no negative remaining_qty
    // 2. Compute period_item_balances
    // 3. Set status to CLOSED

    period.status = 'CLOSED';
    period.closed_at = new Date();
    period.closed_by = req.user.id;

    await periodRepository.save(period);

    res.json({
      message: 'Period closed successfully',
      period
    });
  } catch (error) {
    console.error('Close period error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reopen period (admin only)
router.post('/:id/reopen', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const periodRepository = AppDataSource.getRepository('Period');
    
    const period = await periodRepository.findOne({ where: { id } });
    if (!period) {
      return res.status(404).json({ error: 'Period not found' });
    }

    if (period.status === 'OPEN') {
      return res.status(400).json({ error: 'Period is already open' });
    }

    if (period.status === 'LOCKED') {
      return res.status(400).json({ error: 'Period is locked and cannot be reopened' });
    }

    // Check if there's already an open period
    const openPeriod = await periodRepository.findOne({
      where: { status: 'OPEN' }
    });
    
    if (openPeriod) {
      return res.status(409).json({ 
        error: 'Another period is already open. Close it first.',
        openPeriod: openPeriod.code
      });
    }

    period.status = 'OPEN';
    period.closed_at = null;
    period.closed_by = null;

    await periodRepository.save(period);

    res.json({
      message: 'Period reopened successfully',
      period
    });
  } catch (error) {
    console.error('Reopen period error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get period summary
router.get('/:id/summary', authenticateToken, requireViewer, async (req, res) => {
  try {
    const { id } = req.params;
    
    // TODO: Implement period summary calculation
    // This should return opening/receipts/consumption/closing balances per item
    
    res.json({
      message: 'Period summary calculation not yet implemented',
      periodId: id
    });
  } catch (error) {
    console.error('Get period summary error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
