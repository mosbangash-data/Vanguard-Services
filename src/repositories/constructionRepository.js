const prisma = require('../config/prisma');

const listCustomerRequests = async ({ where = {}, skip = 0, take = 20, orderBy = { createdAt: 'desc' } } = {}) => {
  const [items, total] = await Promise.all([
    prisma.customerRequest.findMany({ where, skip, take, orderBy, include: { department: true, assignedTo: true } }),
    prisma.customerRequest.count({ where }),
  ]);
  return { items, total };
};

const getCustomerRequestById = async (id) => prisma.customerRequest.findUnique({ where: { id }, include: { department: true, assignedTo: true } });

const createCustomerRequest = async (data) => prisma.customerRequest.create({ data, include: { department: true, assignedTo: true } });

const updateCustomerRequest = async (id, data) => prisma.customerRequest.update({ where: { id }, data, include: { department: true, assignedTo: true } });

const listQuoteRequests = async ({ where = {}, skip = 0, take = 20, orderBy = { createdAt: 'desc' } } = {}) => {
  const [items, total] = await Promise.all([
    prisma.quoteRequest.findMany({ where, skip, take, orderBy, include: { department: true, assignedTo: true } }),
    prisma.quoteRequest.count({ where }),
  ]);
  return { items, total };
};

const getQuoteRequestById = async (id) => prisma.quoteRequest.findUnique({ where: { id }, include: { department: true, assignedTo: true } });

const createQuoteRequest = async (data) => prisma.quoteRequest.create({ data, include: { department: true, assignedTo: true } });

const updateQuoteRequest = async (id, data) => prisma.quoteRequest.update({ where: { id }, data, include: { department: true, assignedTo: true } });

const listProjects = async ({ where = {}, skip = 0, take = 20, orderBy = { createdAt: 'desc' } } = {}) => {
  const [items, total] = await Promise.all([
    prisma.project.findMany({ where, skip, take, orderBy, include: { department: true } }),
    prisma.project.count({ where }),
  ]);
  return { items, total };
};

const getProjectById = async (id) => prisma.project.findUnique({ where: { id }, include: { department: true } });

const createProject = async (data) => prisma.project.create({ data, include: { department: true } });

const updateProject = async (id, data) => prisma.project.update({ where: { id }, data, include: { department: true } });

const deleteProject = async (id) => prisma.project.delete({ where: { id } });

const isProjectAssignedToUser = async (projectId, userId) => Boolean(await prisma.projectAssignment.findUnique({
  where: { projectId_userId: { projectId, userId } },
  select: { id: true },
}));

const createProjectAssignment = async (projectId, userId) => prisma.projectAssignment.upsert({
  where: { projectId_userId: { projectId, userId } },
  update: {},
  create: { projectId, userId },
});

// ProjectUpdate repository methods
const listProjectUpdates = async ({ where = {}, skip = 0, take = 20, orderBy = { createdAt: 'desc' } } = {}) => {
  const [items, total] = await Promise.all([
    prisma.projectUpdate.findMany({ where, skip, take, orderBy, include: { project: { include: { department: true } } } }),
    prisma.projectUpdate.count({ where }),
  ]);
  return { items, total };
};

const getProjectUpdateById = async (id) => prisma.projectUpdate.findUnique({ where: { id }, include: { project: { include: { department: true } } } });

const createProjectUpdate = async (data) => prisma.projectUpdate.create({ data, include: { project: { include: { department: true } } } });

const updateProjectUpdate = async (id, data) => prisma.projectUpdate.update({ where: { id }, data, include: { project: { include: { department: true } } } });

const deleteProjectUpdate = async (id) => prisma.projectUpdate.delete({ where: { id } });

// ProjectGallery repository methods
const listProjectGallery = async ({ where = {}, skip = 0, take = 20, orderBy = { order: 'asc' } } = {}) => {
  const [items, total] = await Promise.all([
    prisma.projectGallery.findMany({ where, skip, take, orderBy, include: { media: true, project: { include: { department: true } } } }),
    prisma.projectGallery.count({ where }),
  ]);
  return { items, total };
};

const getProjectGalleryById = async (id) => prisma.projectGallery.findUnique({ where: { id }, include: { media: true, project: { include: { department: true } } } });

const createProjectGallery = async (data) => prisma.projectGallery.create({ data, include: { media: true, project: { include: { department: true } } } });

const updateProjectGallery = async (id, data) => prisma.projectGallery.update({ where: { id }, data, include: { media: true, project: { include: { department: true } } } });

const deleteProjectGallery = async (id) => prisma.projectGallery.delete({ where: { id } });

const countProjectGallery = async (where = {}) => prisma.projectGallery.count({ where });
const countProjectUpdates = async (where = {}) => prisma.projectUpdate.count({ where });

module.exports = {
  listCustomerRequests,
  getCustomerRequestById,
  createCustomerRequest,
  updateCustomerRequest,
  listQuoteRequests,
  getQuoteRequestById,
  createQuoteRequest,
  updateQuoteRequest,
  listProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  isProjectAssignedToUser,
  createProjectAssignment,
  listProjectUpdates,
  getProjectUpdateById,
  createProjectUpdate,
  updateProjectUpdate,
  deleteProjectUpdate,
  // ProjectGallery
  listProjectGallery,
  getProjectGalleryById,
  createProjectGallery,
  updateProjectGallery,
  deleteProjectGallery,
};
