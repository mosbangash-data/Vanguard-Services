const { AppError } = require('../middleware/errorHandler');

const createMedia = async (data, currentUser) => {
  void data;
  void currentUser;
  throw new AppError('Direct Media creation is disabled. Upload a validated file through /api/upload.', 410);
};

module.exports = { createMedia };
