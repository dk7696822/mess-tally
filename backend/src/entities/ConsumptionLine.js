const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'ConsumptionLine',
  tableName: 'consumption_lines',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid',
    },
    consumption_id: {
      type: 'uuid',
      nullable: false,
    },
    item_id: {
      type: 'uuid',
      nullable: false,
    },
    entered_qty: {
      type: 'decimal',
      precision: 18,
      scale: 3,
      nullable: false,
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
    consumption: {
      type: 'many-to-one',
      target: 'Consumption',
      joinColumn: { name: 'consumption_id' },
    },
    item: {
      type: 'many-to-one',
      target: 'Item',
      joinColumn: { name: 'item_id' },
    },
    allocations: {
      type: 'one-to-many',
      target: 'ConsumptionAllocation',
      inverseSide: 'consumption_line',
      cascade: true,
    },
  },
});
