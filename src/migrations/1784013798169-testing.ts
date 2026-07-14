import { MigrationInterface, QueryRunner } from "typeorm";

export class Testing1784013798169 implements MigrationInterface {
    name = 'Testing1784013798169'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "role" ("id" SERIAL NOT NULL, "code" character varying NOT NULL, "description" character varying NOT NULL, "status" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ee999bb389d7ac0fd967172c41" ON "role"  ("code") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_ee999bb389d7ac0fd967172c41"`);
        await queryRunner.query(`DROP TABLE "role"`);
    }

}
