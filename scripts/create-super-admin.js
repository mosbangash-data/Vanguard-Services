require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { bootstrapSuperAdmin, getBootstrapConfig } = require('../src/bootstrap/productionBootstrap');

const { databaseUrl, email } = getBootstrapConfig();

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  await bootstrapSuperAdmin(prisma);

  console.log(`Super Admin bootstrap completed for ${email}.`);
}

main()
  .catch((error) => {
    const message = error.message.startsWith('Missing required environment variables:')
      || error.message === 'DATABASE_URL must not be empty'
      || error.message === 'SUPER_ADMIN_EMAIL must not be empty'
      || error.message === 'SUPER_ADMIN_PASSWORD must not be empty'
      ? error.message
      : 'Database operation could not be completed.';
    console.error(`Super Admin bootstrap failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
