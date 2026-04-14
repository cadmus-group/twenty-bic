import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCrmCallLogEntity1775782000000 implements MigrationInterface {
  name = 'AddCrmCallLogEntity1775782000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'crmcalllog_outcome_enum' AND n.nspname = 'core'
        ) THEN
          CREATE TYPE "core"."crmcalllog_outcome_enum" AS ENUM (
            'ANSWERED',
            'NO_ANSWER',
            'BUSY',
            'FAILED',
            'CANCELED'
          );
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE t.typname = 'crmcalllog_historyeventtype_enum' AND n.nspname = 'core'
        ) THEN
          CREATE TYPE "core"."crmcalllog_historyeventtype_enum" AS ENUM (
            'REGISTRATION',
            'INITIAL_CONTACT',
            'MEETING_SCHEDULING',
            'PRESENTATION',
            'PACKAGE_SALE',
            'GENERAL_CALL'
          );
        END IF;
      END
      $$;
    `);

    // Fork migration 1775000000000 may have created core.crmcalllog (all lower) while this
    // migration uses "crmCallLog" — different OIDs. DROP only the quoted name leaves the old
    // table and breaks indexes. Remove every core relation that normalizes to crm call log.
    await queryRunner.query(`
      DO $$
      DECLARE
        relation record;
      BEGIN
        FOR relation IN
          SELECT c.oid::regclass AS qualified_name
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'core'
            AND c.relkind = 'r'
            AND (
              lower(c.relname) = 'crmcalllog'
              OR lower(c.relname) = 'crm_call_log'
            )
        LOOP
          EXECUTE format('DROP TABLE IF EXISTS %s CASCADE', relation.qualified_name);
        END LOOP;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE TABLE "core"."crmCallLog" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "workspaceId" uuid NOT NULL,
        "workspaceMemberId" uuid,
        "businessNipt" text,
        "phoneNumber" text,
        "outcome" "core"."crmcalllog_outcome_enum" NOT NULL,
        "historyEventType" "core"."crmcalllog_historyeventtype_enum" NOT NULL,
        "durationInSeconds" integer,
        "notes" text,
        "calledAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "deletedAt" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_CRM_CALL_LOG_ID" PRIMARY KEY ("id"),
        CONSTRAINT "FK_CRM_CALL_LOG_WORKSPACE_ID" FOREIGN KEY ("workspaceId") REFERENCES "core"."workspace"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_CRM_CALL_LOG_WORKSPACE_MEMBER_ID" FOREIGN KEY ("workspaceMemberId") REFERENCES "core"."userWorkspace"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_CRM_CALL_LOG_WORKSPACE_ID_CALLED_AT" ON "core"."crmCallLog" ("workspaceId", "calledAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_CRM_CALL_LOG_WORKSPACE_ID_WORKSPACE_MEMBER_ID" ON "core"."crmCallLog" ("workspaceId", "workspaceMemberId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_CRM_CALL_LOG_WORKSPACE_ID_BUSINESS_NIPT" ON "core"."crmCallLog" ("workspaceId", "businessNipt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_CRM_CALL_LOG_WORKSPACE_ID_BUSINESS_NIPT"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_CRM_CALL_LOG_WORKSPACE_ID_WORKSPACE_MEMBER_ID"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "core"."IDX_CRM_CALL_LOG_WORKSPACE_ID_CALLED_AT"`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "core"."crmCallLog"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "core"."crmcalllog_historyeventtype_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "core"."crmcalllog_outcome_enum"`,
    );
  }
}
