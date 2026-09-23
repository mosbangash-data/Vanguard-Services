-- Keep production role records aligned with the canonical RoleName enum.
INSERT INTO "Role" ("id", "name", "createdAt", "updatedAt")
VALUES
  (md5(random()::text || clock_timestamp()::text), 'SUPER_ADMIN'::"RoleName", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'SERVICE_ADMIN'::"RoleName", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'MANAGER'::"RoleName", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (md5(random()::text || clock_timestamp()::text), 'AGENT'::"RoleName", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;