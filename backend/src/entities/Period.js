const { EntitySchema } = require('typeorm');

module.exports = new EntitySchema({
  name: 'Period',
  tableName: 'periods',
  columns: {
    id: {
      type: 'uuid',
      primary: true,
      generated: 'uuid',
    },
    code: {
      type: 'varchar',
      length: 20,
      unique: true,
      nullable: false,
    },
    year: {
      type: 'int',
      nullable: false,
    },
    month: {
      type: 'int',
      nullable: false,
    },
    status: {
      type: 'enum',
      enum: ['OPEN', 'CLOSED', 'LOCKED'],
      default: 'OPEN',
    },
    opened_at: {
      type: 'timestamptz',
      nullable: true,
    },
    closed_at: {
      type: 'timestamptz',
      nullable: true,
    },
    created_by: {
      type: 'uuid',
      nullable: true,
    },
    closed_by: {
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
  indices: [
    {
      name: 'IDX_PERIOD_YEAR_MONTH',
      unique: true,
      columns: ['year', 'month'],
    },
  ],
  relations: {
    creator: {
      type: 'many-to-one',
      target: 'User',
      joinColumn: { name: 'created_by' },
    },
    closer: {
      type: 'many-to-one',
      target: 'User',
      joinColumn: { name: 'closed_by' },
    },
    receipts: {
      type: 'one-to-many',
      target: 'Receipt',
      inverseSide: 'period',
    },
    consumptions: {
      type: 'one-to-many',
      target: 'Consumption',
      inverseSide: 'period',
    },
    balances: {
      type: 'one-to-many',
      target: 'PeriodItemBalance',
      inverseSide: 'period',
    },
  },
});
