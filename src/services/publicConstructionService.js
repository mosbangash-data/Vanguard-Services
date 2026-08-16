const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizePage = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

const normalizeLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  if (parsed < 1) return 1;
  return Math.min(parsed, 50);
};

const getConstructionDepartment = async () => {
  const department = await prisma.department.findUnique({ where: { type: 'CONSTRUCTION' } });
  if (!department) throw new AppError('Construction department not found', 404);
  return department;
};

const listPublicProjects = async (query = {}) => {
  const department = await getConstructionDepartment();

  const page = normalizePage(query.page);
  const limit = normalizeLimit(query.limit);
  const skip = (page - 1) * limit;

  const where = {
    departmentId: department.id,
    status: 'PUBLISHED',
    publicationStatus: 'PUBLISHED',
  };

  const [items, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        gallery: {
          include: { media: true },
          orderBy: { order: 'asc' },
        },
      },
    }),
    prisma.project.count({ where }),
  ]);

  // Ne retourner que les champs publics
  const publicProjects = items.map((project) => ({
    id: project.id,
    title: project.title,
    slug: project.slug,
    location: project.location,
    description: project.description,
    budget: project.budget,
    createdAt: project.createdAt,
    gallery: project.gallery.map((g) => ({
      id: g.id,
      caption: g.caption,
      order: g.order,
      media: {
        url: g.media?.url,
        mimeType: g.media?.mimeType,
      },
    })),
  }));

  return { items: publicProjects, page, limit, total };
};

const getPublicProject = async (projectId) => {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      gallery: {
        include: { media: true },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!project) throw new AppError('Project not found', 404);
  if (project.status !== 'PUBLISHED' || project.publicationStatus !== 'PUBLISHED') {
    throw new AppError('Project not found', 404);
  }

  return {
    project: {
      id: project.id,
      title: project.title,
      slug: project.slug,
      location: project.location,
      description: project.description,
      budget: project.budget,
      createdAt: project.createdAt,
      gallery: project.gallery.map((g) => ({
        id: g.id,
        caption: g.caption,
        order: g.order,
        media: {
          url: g.media?.url,
          mimeType: g.media?.mimeType,
        },
      })),
    },
  };
};

const createPublicCustomerRequest = async (data) => {
  const { subject, customerName, customerPhone, customerEmail, message } = data;

  if (!subject || !customerName || !customerPhone || !message) {
    throw new AppError('subject, customerName, customerPhone and message are required', 400);
  }

  const department = await getConstructionDepartment();

  // Le backend fixe les valeurs internes — le client ne peut pas les choisir
  const customerRequest = await prisma.customerRequest.create({
    data: {
      departmentId: department.id,
      sourceModule: 'CONSTRUCTION',
      subject: normalizeString(subject),
      customerName: normalizeString(customerName),
      customerPhone: normalizeString(customerPhone),
      customerEmail: customerEmail ? normalizeString(customerEmail) : null,
      message: normalizeString(message),
      status: 'NEW',
      assignedToUserId: null,
    },
  });

  return {
    customerRequest: {
      id: customerRequest.id,
      subject: customerRequest.subject,
      status: customerRequest.status,
      createdAt: customerRequest.createdAt,
    },
  };
};

const createPublicQuoteRequest = async (data) => {
  const { customerName, customerPhone, customerEmail, projectType, description, budgetRange } = data;

  if (!customerName || !customerPhone || !description) {
    throw new AppError('customerName, customerPhone and description are required', 400);
  }

  const department = await getConstructionDepartment();

  // Le backend fixe les valeurs internes — le client ne peut pas les choisir
  const quoteRequest = await prisma.quoteRequest.create({
    data: {
      departmentId: department.id,
      customerName: normalizeString(customerName),
      customerPhone: normalizeString(customerPhone),
      customerEmail: customerEmail ? normalizeString(customerEmail) : null,
      projectType: projectType ? normalizeString(projectType) : null,
      description: normalizeString(description),
      budgetRange: budgetRange ? normalizeString(budgetRange) : null,
      status: 'NEW',
      assignedToUserId: null,
    },
  });

  return {
    quoteRequest: {
      id: quoteRequest.id,
      status: quoteRequest.status,
      createdAt: quoteRequest.createdAt,
    },
  };
};

module.exports = {
  listPublicProjects,
  getPublicProject,
  createPublicCustomerRequest,
  createPublicQuoteRequest,
};