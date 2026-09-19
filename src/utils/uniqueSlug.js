const DEFAULT_MAX_ATTEMPTS = 10;

const slugify = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'resource';

const isUniqueConstraintError = (error, field) => error?.code === 'P2002'
  && (!field || (Array.isArray(error.meta?.target) && error.meta.target.includes(field)) || error.meta?.target === field);

const createWithUniqueSlug = async ({ findMany, create, value, field = 'slug', normalize = slugify, maxAttempts = DEFAULT_MAX_ATTEMPTS }) => {
  const base = normalize(value);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const existing = await findMany(base);
    const occupied = new Set(existing.map((item) => item[field]).filter(Boolean).map(normalize));
    let candidate = base;
    let suffix = 2;
    while (occupied.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }

    try {
      return await create(candidate);
    } catch (error) {
      if (!isUniqueConstraintError(error, field) || attempt === maxAttempts - 1) throw error;
    }
  }

  throw new Error(`Unable to allocate unique ${field}`);
};

module.exports = { slugify, createWithUniqueSlug, isUniqueConstraintError };