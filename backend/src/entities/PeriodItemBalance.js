const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'PeriodItemBalance',
  tableName: 'period_item_balances',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid',
    },
    period_id: {
      type: 'uuid',
      nullable: false,
    },
    item_id: {
      type: 'uuid',
      nullable: false,
    },
    opening_qty: {
      type: 'decimal',
      precision: 18,
      scale: 3,
      nullable: false,
      default: 0,
    },
    opening_amt: {
      type: 'decimal',
      precision: 18,
      scale: 2,
      nullable: false,
      default: 0,
    },
    received_qty: {
      type: 'decimal',
      precision: 18,
      scale: 3,
      nullable: false,
      default: 0,
    },
    received_amt: {
      type: 'decimal',
      precision: 18,
      scale: 2,
      nullable: false,
      default: 0,
    },
    cons_from_opening_qty: {
      type: 'decimal',
      precision: 18,
      scale: 3,
      nullable: false,
      default: 0,
    },
    cons_from_opening_amt: {
      type: 'decimal',
      precision: 18,
      scale: 2,
      nullable: false,
      default: 0,
    },
    cons_from_current_qty: {
      type: 'decimal',
      precision: 18,
      scale: 3,
      nullable: false,
      default: 0,
    },
    cons_from_current_amt: {
      type: 'decimal',
      precision: 18,
      scale: 2,
      nullable: false,
      default: 0,
    },
    closing_qty: {
      type: 'decimal',
      precision: 18,
      scale: 3,
      nullable: false,
      default: 0,
    },
    closing_amt: {
      type: 'decimal',
      precision: 18,
      scale: 2,
      nullable: false,
      default: 0,
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
      name: 'IDX_PERIOD_ITEM_BALANCE_UNIQUE',
      unique: true,
      columns: ['period_id', 'item_id'],
    },
  ],
  relations: {
    period: {
      type: 'many-to-one',
      target: 'Period',
      joinColumn: { name: 'period_id' },
    },
    item: {
      type: 'many-to-one',
      target: 'Item',
      joinColumn: { name: 'item_id' },
    },
  },
});
