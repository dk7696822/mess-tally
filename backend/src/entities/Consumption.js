const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Consumption',
  tableName: 'consumptions',
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
    notes: {
      type: 'text',
      nullable: true,
    },
    is_void: {
      type: 'boolean',
      default: false,
    },
    void_reason: {
      type: 'text',
      nullable: true,
    },
    voided_at: {
      type: 'timestamptz',
      nullable: true,
    },
    voided_by: {
      type: 'uuid',
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
  relations: {
    period: {
      type: 'many-to-one',
      target: 'Period',
      joinColumn: { name: 'period_id' },
    },
    voider: {
      type: 'many-to-one',
      target: 'User',
      joinColumn: { name: 'voided_by' },
    },
    lines: {
      type: 'one-to-many',
      target: 'ConsumptionLine',
      inverseSide: 'consumption',
      cascade: true,
    },
  },
});
