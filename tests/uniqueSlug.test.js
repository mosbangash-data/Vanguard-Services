const test = require('node:test');
const assert = require('node:assert/strict');
const { createWithUniqueSlug, slugify } = require('../src/utils/uniqueSlug');

test('slugify normalizes spaces, accents and special characters', () => {
  assert.equal(slugify('  Mon projet déjà spécial !  '), 'mon-projet-deja-special');
  assert.equal(slugify('Mon projet'), 'mon-projet');
});

test('createWithUniqueSlug allocates successive project-style suffixes', async () => {
  const rows = [];
  const create = (slug) => {
    const row = { slug };
    rows.push(row);
    return row;
  };
  const findMany = async () => rows;

  assert.equal((await createWithUniqueSlug({ value: 'Mon projet', findMany, create })).slug, 'mon-projet');
  assert.equal((await createWithUniqueSlug({ value: 'Mon projet', findMany, create })).slug, 'mon-projet-2');
  assert.equal((await createWithUniqueSlug({ value: 'Mon projet', findMany, create })).slug, 'mon-projet-3');
});

test('createWithUniqueSlug retries a concurrent unique collision', async () => {
  const rows = [];
  let firstAttempt = true;
  const result = await createWithUniqueSlug({
    value: 'Mon projet',
    findMany: async () => rows,
    create: async (slug) => {
      if (firstAttempt) {
        firstAttempt = false;
        rows.push({ slug: 'mon-projet' });
        const error = new Error('Unique constraint failed');
        error.code = 'P2002';
        error.meta = { target: ['slug'] };
        throw error;
      }
      const row = { slug };
      rows.push(row);
      return row;
    },
  });

  assert.equal(result.slug, 'mon-projet-2');
});

test('createWithUniqueSlug can apply the same policy to a unique bus plate identifier', async () => {
  const rows = [{ plateNumber: '1234-AB-01' }];
  const result = await createWithUniqueSlug({
    value: '1234 AB 01',
    field: 'plateNumber',
    normalize: (value) => slugify(value).toUpperCase(),
    findMany: async () => rows,
    create: async (plateNumber) => ({ plateNumber }),
  });

  assert.equal(result.plateNumber, '1234-AB-01-2');
});
