const prisma = require('../config/prisma');

const userRelations = {
  include: {
    role: {
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    },
    department: true,
  },
};

const findByIdentifier = async (identifier) => {
  const normalizedIdentifier = typeof identifier === 'string' ? identifier.trim() : '';
  if (!normalizedIdentifier) {
    return null;
  }

  return prisma.user.findFirst({
    where: {
      OR: [{ email: normalizedIdentifier.toLowerCase() }, { phone: normalizedIdentifier }],
    },
    ...userRelations,
  });
};

const findById = async (id) => prisma.user.findUnique({ where: { id }, ...userRelations });

const findByEmail = async (email) => {
  if (!email || typeof email !== 'string') {
    return null;
  }

  return prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
};

const createUser = async (data) => prisma.user.create({ data, ...userRelations });

const updateUserById = async (id, data) => prisma.user.update({ where: { id }, data, ...userRelations });

const findMany = async (options) => prisma.user.findMany(options);

const count = async (where) => prisma.user.count({ where });

module.exports = {
  findByIdentifier,
  findById,
  findByEmail,
  createUser,
  updateUserById,
  findMany,
  count,
};
