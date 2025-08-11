const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'ReceiptLine',
  tableName: 'receipt_lines',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid',
    },
    receipt_id: {
      type: 'uuid',
      nullable: false,
    },
    item_id: {
      type: 'uuid',
      nullable: false,
    },
    quantity: {
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
      // Will be calculated as quantity * rate
    },
    remaining_qty: {
      type: 'decimal',
      precision: 18,
      scale: 3,
      nullable: false,
      // Initially equals quantity
    },
    lot_no: {
      type: 'varchar',
      length: 255,
      nullable: true,
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
      name: 'IDX_RECEIPT_LINE_ITEM_REMAINING',
      columns: ['item_id', 'remaining_qty', 'id'],
    },
    {
      name: 'IDX_RECEIPT_LINE_REMAINING_QTY',
      columns: ['remaining_qty'],
      where: 'remaining_qty > 0',
    },
  ],
  relations: {
    receipt: {
      type: 'many-to-one',
      target: 'Receipt',
      joinColumn: { name: 'receipt_id' },
    },
    item: {
      type: 'many-to-one',
      target: 'Item',
      joinColumn: { name: 'item_id' },
    },
    allocations: {
      type: 'one-to-many',
      target: 'ConsumptionAllocation',
      inverseSide: 'receipt_line',
    },
  },
});
