const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const env = require('./env');

const adapter = new PrismaPg({ connectionString: env.databaseUrl });

const prisma = globalThis.__prisma || new PrismaClient({
  adapter,
  log: env.nodeEnv === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

globalThis.__prisma = prisma;

module.exports = prisma;
