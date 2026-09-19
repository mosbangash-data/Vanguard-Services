const http = require('http');
const app = require('./app');
const prisma = require('./config/prisma');
const { runProductionBootstrap } = require('./bootstrap/productionBootstrap');

const PORT = Number(process.env.PORT || 3000);

const server = http.createServer(app);

async function startServer() {
  try {
    await prisma.$connect();
    console.log('Prisma connected to PostgreSQL successfully.');

    if (process.env.NODE_ENV === 'production') {
      await runProductionBootstrap(prisma);
      console.log('Database migrations applied.');
      console.log('Super Admin bootstrap completed.');
    }

    server.listen(PORT, () => {
      console.log(`Vanguard Services backend listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server or connect to PostgreSQL:', error);
    process.exit(1);
  }
}

startServer();

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
});
