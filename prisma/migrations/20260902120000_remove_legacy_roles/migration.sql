-- Migrate legacy users to the canonical department-scoped SERVICE_ADMIN role.
DO $$
DECLARE
  service_admin_id TEXT;
  construction_department_id TEXT;
  auto_sales_department_id TEXT;
BEGIN
  SELECT "id" INTO service_admin_id FROM "Role" WHERE "name"::text = 'SERVICE_ADMIN';
  IF service_admin_id IS NULL THEN
    RAISE EXCEPTION 'SERVICE_ADMIN role must exist before legacy role migration';
  END IF;

  SELECT "id" INTO construction_department_id FROM "Department" WHERE "type"::text = 'CONSTRUCTION';
  SELECT "id" INTO auto_sales_department_id FROM "Department" WHERE "type"::text = 'AUTO_SALES';

  IF construction_department_id IS NULL OR auto_sales_department_id IS NULL THEN
    RAISE EXCEPTION 'CONSTRUCTION and AUTO_SALES departments must exist before legacy role migration';
  END IF;

  INSERT INTO "RolePermission" ("id", "roleId", "permissionId")
  SELECT md5(random()::text || clock_timestamp()::text), service_admin_id, permissions."permissionId"
  FROM (
    SELECT DISTINCT rp."permissionId"
    FROM "RolePermission" AS rp
    JOIN "Role" AS legacy_role ON legacy_role."id" = rp."roleId"
    WHERE legacy_role."name"::text IN ('ENGINEER', 'SALES_AGENT', 'CONSTRUCTION')
  ) AS permissions
  WHERE NOT EXISTS (
      SELECT 1
      FROM "RolePermission" AS existing
      WHERE existing."roleId" = service_admin_id
        AND existing."permissionId" = permissions."permissionId"
    );

  UPDATE "User" AS u
  SET "roleId" = service_admin_id,
      "departmentId" = CASE
        WHEN r."name"::text = 'SALES_AGENT' THEN auto_sales_department_id
        WHEN r."name"::text IN ('ENGINEER', 'CONSTRUCTION') THEN construction_department_id
        ELSE u."departmentId"
      END
  FROM "Role" AS r
  WHERE u."roleId" = r."id"
    AND r."name"::text IN ('ENGINEER', 'SALES_AGENT', 'CONSTRUCTION');
END $$;

-- Remove permissions and role records only after all users have been reassigned.
DELETE FROM "RolePermission"
WHERE "roleId" IN (
  SELECT "id" FROM "Role" WHERE "name"::text IN ('ENGINEER', 'SALES_AGENT', 'CONSTRUCTION')
);
DELETE FROM "Role"
WHERE "name"::text IN ('ENGINEER', 'SALES_AGENT', 'CONSTRUCTION');

-- PostgreSQL enum values cannot be removed in place, so replace the enum with
-- the canonical four-value definition without editing historical migrations.
ALTER TABLE "Role" ALTER COLUMN "name" TYPE TEXT USING "name"::text;
ALTER TYPE "RoleName" RENAME TO "RoleName_legacy";
CREATE TYPE "RoleName" AS ENUM ('SUPER_ADMIN', 'SERVICE_ADMIN', 'MANAGER', 'AGENT');
ALTER TABLE "Role" ALTER COLUMN "name" TYPE "RoleName" USING "name"::text::"RoleName";
DROP TYPE "RoleName_legacy";
