const healthRepository = require('./healthRepository');

const getServiceHealth = async () => {
  await healthRepository.checkDatabase();

  return {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    database: 'postgresql',
  };
};

module.exports = {
  getServiceHealth,
};
