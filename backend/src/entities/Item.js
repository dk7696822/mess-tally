const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Item',
  tableName: 'items',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid',
    },
    name: {
      type: 'varchar',
      length: 255,
      unique: true,
      nullable: false,
    },
    uom: {
      type: 'varchar',
      length: 50,
      default: 'kg',
      nullable: false,
    },
    is_active: {
      type: 'boolean',
      default: true,
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
  relations: {
    receipt_lines: {
      type: 'one-to-many',
      target: 'ReceiptLine',
      inverseSide: 'item',
    },
    consumption_lines: {
      type: 'one-to-many',
      target: 'ConsumptionLine',
      inverseSide: 'item',
    },
    period_balances: {
      type: 'one-to-many',
      target: 'PeriodItemBalance',
      inverseSide: 'item',
    },
  },
});
