import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRoleTable1784257312030 implements MigrationInterface {
  name = 'CreateRoleTable1784257312030';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
    await queryRunner.query(`DELETE * FROM "role"`);
  }
}
