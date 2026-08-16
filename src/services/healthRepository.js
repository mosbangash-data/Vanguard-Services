const prisma = require('../config/prisma');

const checkDatabase = async () => {
  await prisma.$queryRaw`SELECT 1`;
};

module.exports = {
  checkDatabase,
};
