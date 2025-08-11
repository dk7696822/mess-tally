const { MigrationInterface, QueryRunner } = require("typeorm");

module.exports = class InitialSchema1703000000000 {
  name = "InitialSchema1703000000000";

  async up(queryRunner) {
    // Create enum for user roles first
    await queryRunner.query(`CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor', 'viewer')`);

    // Drop existing users table if it exists with old structure
    await queryRunner.query(`DROP TABLE IF EXISTS "users" CASCADE`);

    // Create users table with new structure
    await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(255) NOT NULL,
                "email" character varying(255) NOT NULL,
                "password_hash" character varying(255) NOT NULL,
                "role" "public"."enum_users_role" NOT NULL DEFAULT 'viewer',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_users_email" UNIQUE ("email"),
                CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
            )
        `);

    // Create items table
    await queryRunner.query(`
            CREATE TABLE "items" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "name" character varying(255) NOT NULL,
                "uom" character varying(50) NOT NULL DEFAULT 'kg',
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_items_name" UNIQUE ("name"),
                CONSTRAINT "PK_items_id" PRIMARY KEY ("id")
            )
        `);

    // Create periods table
    await queryRunner.query(`
            CREATE TYPE "public"."enum_periods_status" AS ENUM('OPEN', 'CLOSED', 'LOCKED')
        `);

    await queryRunner.query(`
            CREATE TABLE "periods" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "code" character varying(20) NOT NULL,
                "year" integer NOT NULL,
                "month" integer NOT NULL,
                "status" "public"."enum_periods_status" NOT NULL DEFAULT 'OPEN',
                "opened_at" TIMESTAMP WITH TIME ZONE,
                "closed_at" TIMESTAMP WITH TIME ZONE,
                "created_by" uuid,
                "closed_by" uuid,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_periods_code" UNIQUE ("code"),
                CONSTRAINT "UQ_periods_year_month" UNIQUE ("year", "month"),
                CONSTRAINT "PK_periods_id" PRIMARY KEY ("id")
            )
        `);

    // Create receipts table
    await queryRunner.query(`
            CREATE TABLE "receipts" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "period_id" uuid NOT NULL,
                "ref_no" character varying(255),
                "notes" text,
                "is_void" boolean NOT NULL DEFAULT false,
                "void_reason" text,
                "voided_at" TIMESTAMP WITH TIME ZONE,
                "voided_by" uuid,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_receipts_id" PRIMARY KEY ("id")
            )
        `);

    // Create receipt_lines table
    await queryRunner.query(`
            CREATE TABLE "receipt_lines" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "receipt_id" uuid NOT NULL,
                "item_id" uuid NOT NULL,
                "quantity" numeric(18,3) NOT NULL,
                "rate" numeric(18,2) NOT NULL,
                "amount" numeric(18,2) NOT NULL,
                "remaining_qty" numeric(18,3) NOT NULL,
                "lot_no" character varying(255),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_receipt_lines_id" PRIMARY KEY ("id"),
                CONSTRAINT "CHK_receipt_lines_quantity" CHECK ("quantity" >= 0),
                CONSTRAINT "CHK_receipt_lines_rate" CHECK ("rate" >= 0)
            )
        `);

    // Create consumptions table
    await queryRunner.query(`
            CREATE TABLE "consumptions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "period_id" uuid NOT NULL,
                "notes" text,
                "is_void" boolean NOT NULL DEFAULT false,
                "void_reason" text,
                "voided_at" TIMESTAMP WITH TIME ZONE,
                "voided_by" uuid,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_consumptions_id" PRIMARY KEY ("id")
            )
        `);

    // Create consumption_lines table
    await queryRunner.query(`
            CREATE TABLE "consumption_lines" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "consumption_id" uuid NOT NULL,
                "item_id" uuid NOT NULL,
                "entered_qty" numeric(18,3) NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_consumption_lines_id" PRIMARY KEY ("id"),
                CONSTRAINT "CHK_consumption_lines_entered_qty" CHECK ("entered_qty" >= 0)
            )
        `);

    // Create consumption_allocations table
    await queryRunner.query(`
            CREATE TABLE "consumption_allocations" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "consumption_line_id" uuid NOT NULL,
                "receipt_line_id" uuid NOT NULL,
                "qty" numeric(18,3) NOT NULL,
                "rate" numeric(18,2) NOT NULL,
                "amount" numeric(18,2) NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_consumption_allocations_id" PRIMARY KEY ("id"),
                CONSTRAINT "CHK_consumption_allocations_qty" CHECK ("qty" > 0)
            )
        `);

    // Create period_item_balances table
    await queryRunner.query(`
            CREATE TABLE "period_item_balances" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "period_id" uuid NOT NULL,
                "item_id" uuid NOT NULL,
                "opening_qty" numeric(18,3) NOT NULL DEFAULT 0,
                "opening_amt" numeric(18,2) NOT NULL DEFAULT 0,
                "received_qty" numeric(18,3) NOT NULL DEFAULT 0,
                "received_amt" numeric(18,2) NOT NULL DEFAULT 0,
                "cons_from_opening_qty" numeric(18,3) NOT NULL DEFAULT 0,
                "cons_from_opening_amt" numeric(18,2) NOT NULL DEFAULT 0,
                "cons_from_current_qty" numeric(18,3) NOT NULL DEFAULT 0,
                "cons_from_current_amt" numeric(18,2) NOT NULL DEFAULT 0,
                "closing_qty" numeric(18,3) NOT NULL DEFAULT 0,
                "closing_amt" numeric(18,2) NOT NULL DEFAULT 0,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_period_item_balances_period_item" UNIQUE ("period_id", "item_id"),
                CONSTRAINT "PK_period_item_balances_id" PRIMARY KEY ("id")
            )
        `);

    // Add foreign key constraints
    await queryRunner.query(`ALTER TABLE "periods" ADD CONSTRAINT "FK_periods_created_by" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "periods" ADD CONSTRAINT "FK_periods_closed_by" FOREIGN KEY ("closed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "receipts" ADD CONSTRAINT "FK_receipts_period_id" FOREIGN KEY ("period_id") REFERENCES "periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "receipts" ADD CONSTRAINT "FK_receipts_voided_by" FOREIGN KEY ("voided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "receipt_lines" ADD CONSTRAINT "FK_receipt_lines_receipt_id" FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "receipt_lines" ADD CONSTRAINT "FK_receipt_lines_item_id" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "consumptions" ADD CONSTRAINT "FK_consumptions_period_id" FOREIGN KEY ("period_id") REFERENCES "periods"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE "consumptions" ADD CONSTRAINT "FK_consumptions_voided_by" FOREIGN KEY ("voided_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    await queryRunner.query(
      `ALTER TABLE "consumption_lines" ADD CONSTRAINT "FK_consumption_lines_consumption_id" FOREIGN KEY ("consumption_id") REFERENCES "consumptions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(`ALTER TABLE "consumption_lines" ADD CONSTRAINT "FK_consumption_lines_item_id" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    await queryRunner.query(
      `ALTER TABLE "consumption_allocations" ADD CONSTRAINT "FK_consumption_allocations_consumption_line_id" FOREIGN KEY ("consumption_line_id") REFERENCES "consumption_lines"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "consumption_allocations" ADD CONSTRAINT "FK_consumption_allocations_receipt_line_id" FOREIGN KEY ("receipt_line_id") REFERENCES "receipt_lines"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "period_item_balances" ADD CONSTRAINT "FK_period_item_balances_period_id" FOREIGN KEY ("period_id") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "period_item_balances" ADD CONSTRAINT "FK_period_item_balances_item_id" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );

    // Create indexes
    await queryRunner.query(`CREATE INDEX "IDX_receipt_line_item_remaining" ON "receipt_lines" ("item_id", "remaining_qty", "id")`);
    await queryRunner.query(`CREATE INDEX "IDX_receipt_line_remaining_qty" ON "receipt_lines" ("remaining_qty") WHERE "remaining_qty" > 0`);
    await queryRunner.query(`CREATE INDEX "IDX_consumption_allocation_line" ON "consumption_allocations" ("consumption_line_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_consumption_allocation_receipt" ON "consumption_allocations" ("receipt_line_id")`);
  }

  async down(queryRunner) {
    // Drop all tables in reverse order
    await queryRunner.query(`DROP TABLE "period_item_balances"`);
    await queryRunner.query(`DROP TABLE "consumption_allocations"`);
    await queryRunner.query(`DROP TABLE "consumption_lines"`);
    await queryRunner.query(`DROP TABLE "consumptions"`);
    await queryRunner.query(`DROP TABLE "receipt_lines"`);
    await queryRunner.query(`DROP TABLE "receipts"`);
    await queryRunner.query(`DROP TABLE "periods"`);
    await queryRunner.query(`DROP TABLE "items"`);
    await queryRunner.query(`DROP TABLE "users"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE "public"."enum_periods_status"`);
    await queryRunner.query(`DROP TYPE "public"."enum_users_role"`);
  }
};
