const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'ConsumptionAllocation',
  tableName: 'consumption_allocations',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid',
    },
    consumption_line_id: {
      type: 'uuid',
      nullable: false,
    },
    receipt_line_id: {
      type: 'uuid',
      nullable: false,
    },
    qty: {
      type: 'decimal',
      precision: 18,
      scale: 3,
      nullable: false,
    },
    rate: {
      type: 'decimal',
      precision: 18,
      scale: 2,
      nullable: false,
    },
    amount: {
      type: 'decimal',
      precision: 18,
      scale: 2,
      nullable: false,
      // Calculated as qty * rate
    },
    created_at: {
      type: 'timestamptz',
      createDate: true,
    },
    updated_at: {
      type: 'timestamptz',
      updateDate: true,
    },
  },
  indices: [
    {
      name: 'IDX_CONSUMPTION_ALLOCATION_LINE',
      columns: ['consumption_line_id'],
    },
    {
      name: 'IDX_CONSUMPTION_ALLOCATION_RECEIPT',
      columns: ['receipt_line_id'],
    },
  ],
  relations: {
    consumption_line: {
      type: 'many-to-one',
      target: 'ConsumptionLine',
      joinColumn: { name: 'consumption_line_id' },
    },
    receipt_line: {
      type: 'many-to-one',
      target: 'ReceiptLine',
      joinColumn: { name: 'receipt_line_id' },
    },
  },
});
