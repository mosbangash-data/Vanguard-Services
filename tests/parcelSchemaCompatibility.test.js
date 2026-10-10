const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const schema = fs.readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8');
const parcelModel = schema.match(/model Parcel \{([\s\S]*?)\n\}/)?.[1] || '';

test('Prisma Parcel model does not require the absent description column', () => {
  assert.ok(parcelModel);
  assert.doesNotMatch(parcelModel, /^\s*description\s/m);
});

test('initial Parcel migration never created a description column', () => {
  const initialMigration = fs.readFileSync(path.join(root, 'prisma/migrations/20260805215326_init/migration.sql'), 'utf8');
  const parcelTable = initialMigration.match(/CREATE TABLE "Parcel" \(([\s\S]*?)\n\);/)?.[1] || '';
  assert.ok(parcelTable);
  assert.doesNotMatch(parcelTable, /"description"/);
});
