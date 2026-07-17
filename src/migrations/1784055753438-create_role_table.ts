import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRoleTable1784055753438 implements MigrationInterface {
  name = 'CreateRoleTable1784055753438';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "role" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "code" character varying NOT NULL, "type" character varying NOT NULL, "description" character varying NOT NULL, "status" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_ee999bb389d7ac0fd967172c41" ON "role"  ("code") `,
    );
    await queryRunner.query(
      `INSERT INTO "role" ("name", "code", "type", "description") VALUES ('Admin', 'CLI_ADM', 'client', 'Client System Administrator')`,
    );
    await queryRunner.query(
      `INSERT INTO "role" ("name", "code", "type", "description") VALUES ('LGA Administrator', 'CLI_LGA', 'client', 'Client LGA Administrator')`,
    );
    await queryRunner.query(
      `INSERT INTO "role" ("name", "code", "type", "description") VALUES ('Ward Administrator', 'CLI_WRD', 'client', 'Client Ward Administrator')`,
    );
    await queryRunner.query(
      `INSERT INTO "role" ("name", "code", "type", "description") VALUES ('Polling Unit Administrator', 'CLI_PUA', 'client', 'Client Polling Unit Administrator')`,
    );
    await queryRunner.query(
      `INSERT INTO "role" ("name", "code", "type", "description") VALUES ('Aspirant', 'CLI_ASP', 'client', 'Client First User')`,
    );
    await queryRunner.query(
      `INSERT INTO "role" ("name", "code", "type", "description") VALUES ('Super Admin', 'SYS_SADM', 'system', 'System Super Administrator')`,
    );
    await queryRunner.query(
      `INSERT INTO "role" ("name", "code", "type", "description") VALUES ('System Admin', 'SYS_ADM', 'system', 'System Administrator')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ee999bb389d7ac0fd967172c41"`,
    );
    await queryRunner.query(`DROP TABLE "role"`);
  }
}
