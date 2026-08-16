const healthService = require('../services/healthService');

const getHealth = async (req, res, next) => {
  try {
    const health = await healthService.getServiceHealth();

    return res.status(200).json({
      success: true,
      message: 'API operational',
      data: health,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getHealth,
};
