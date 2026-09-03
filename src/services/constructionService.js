const prisma = require('../config/prisma');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('./auditService');
const constructionRepository = require('../repositories/constructionRepository');

const assertConstructionAccess = (currentUser) => {
  if (!currentUser) throw new AppError('Unauthorized', 401);
  if (currentUser.role !== 'SUPER_ADMIN' && currentUser.department?.type !== 'CONSTRUCTION') {
    throw new AppError('Access denied', 403);
  }
};

const assertProjectAccess = async (project, currentUser) => {
  if (currentUser.role !== 'SUPER_ADMIN' && project.department?.type !== currentUser.department.type) {
    throw new AppError('Access denied', 403);
  }
};

const getDepartmentByType = async (type) => {
  const department = await prisma.department.findUnique({ where: { type } });
  if (!department) {
    throw new AppError('Construction department not found', 404);
  }
  return department;
};

const getDepartmentContext = async (currentUser) => {
  if (currentUser.role === 'SUPER_ADMIN') {
    return null;
  }
  return await getDepartmentByType(currentUser.department.type);
};

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');
const parseBudget = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new AppError('budget must be a valid non-negative number', 400);
  }
  return numeric;
};

const buildPagination = (page, limit, total) => ({ page, limit, total });

const listCustomerRequests = async (query = {}, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_CUSTOMER_REQUEST')) throw new AppError('Insufficient permissions', 403);

  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Math.min(Number(query.limit), 100) : 20;
  const skip = (page - 1) * limit;

  const where = {};
  if (query.status) where.status = query.status;
  if (query.assignedToUserId) where.assignedToUserId = query.assignedToUserId;
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.search) {
    const search = normalizeString(query.search);
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { message: { contains: search, mode: 'insensitive' } },
      ];
    }
  }

  if (currentUser.role !== 'SUPER_ADMIN') {
    where.department = { type: currentUser.department.type };
  }

  const { items, total } = await constructionRepository.listCustomerRequests({ where, skip, take: limit });
  return { items, ...buildPagination(page, limit, total) };
};

const getCustomerRequest = async (requestId, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_CUSTOMER_REQUEST')) throw new AppError('Insufficient permissions', 403);

  const request = await constructionRepository.getCustomerRequestById(requestId);
  if (!request) throw new AppError('Customer request not found', 404);
  if (currentUser.role !== 'SUPER_ADMIN' && request.department?.type !== currentUser.department.type) {
    throw new AppError('Access denied', 403);
  }

  return { customerRequest: request };
};

const createCustomerRequest = async (data, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('CREATE_CUSTOMER_REQUEST')) throw new AppError('Insufficient permissions', 403);

  const departmentContext = await getDepartmentContext(currentUser);
  const departmentId = data.departmentId ? String(data.departmentId).trim() : null;

  let finalDepartmentId = departmentId;
  if (departmentContext) {
    if (departmentId && departmentId !== departmentContext.id) {
      throw new AppError('Access to this department is not allowed', 403);
    }
    finalDepartmentId = departmentContext.id;
  }

  if (departmentId && currentUser.role === 'SUPER_ADMIN') {
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) throw new AppError('Department not found', 404);
  }

  const customerRequestPayload = {
    departmentId: finalDepartmentId,
    sourceModule: normalizeString(data.sourceModule) || 'CONSTRUCTION',
    subject: normalizeString(data.subject),
    customerName: normalizeString(data.customerName),
    customerEmail: normalizeString(data.customerEmail) || null,
    customerPhone: normalizeString(data.customerPhone),
    message: normalizeString(data.message),
    status: normalizeString(data.status) || 'NEW',
    assignedToUserId: data.assignedToUserId || null,
  };

  const customerRequest = await constructionRepository.createCustomerRequest(customerRequestPayload);
  await auditService.log('create_customer_request', currentUser.id, { targetCustomerRequestId: customerRequest.id, departmentId: customerRequest.departmentId });

  return { customerRequest };
};

const updateCustomerRequest = async (requestId, data, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('UPDATE_CUSTOMER_REQUEST')) throw new AppError('Insufficient permissions', 403);

  const existing = await constructionRepository.getCustomerRequestById(requestId);
  if (!existing) throw new AppError('Customer request not found', 404);
  if (currentUser.role !== 'SUPER_ADMIN' && existing.department?.type !== currentUser.department.type) {
    throw new AppError('Access denied', 403);
  }

  const updatePayload = {};
  if (data.subject !== undefined) updatePayload.subject = normalizeString(data.subject);
  if (data.customerName !== undefined) updatePayload.customerName = normalizeString(data.customerName);
  if (data.customerPhone !== undefined) updatePayload.customerPhone = normalizeString(data.customerPhone);
  if (data.customerEmail !== undefined) updatePayload.customerEmail = normalizeString(data.customerEmail) || null;
  if (data.message !== undefined) updatePayload.message = normalizeString(data.message);
  if (data.status !== undefined) updatePayload.status = normalizeString(data.status);
  if (data.assignedToUserId !== undefined) updatePayload.assignedToUserId = data.assignedToUserId || null;
  if (data.departmentId !== undefined) {
    const newDepartmentId = data.departmentId ? String(data.departmentId).trim() : null;
    if (currentUser.role !== 'SUPER_ADMIN' && newDepartmentId) {
      const departmentContext = await getDepartmentContext(currentUser);
      if (departmentContext.id !== newDepartmentId) {
        throw new AppError('Access to this department is not allowed', 403);
      }
    }
    if (newDepartmentId) {
      const department = await prisma.department.findUnique({ where: { id: newDepartmentId } });
      if (!department) throw new AppError('Department not found', 404);
    }
    updatePayload.departmentId = newDepartmentId;
  }

  if (data.assignedToUserId !== undefined && data.assignedToUserId) {
    const assignedUser = await prisma.user.findUnique({ where: { id: data.assignedToUserId }, include: { department: true } });
    if (!assignedUser) {
      throw new AppError('Assigned user not found', 404);
    }
    if (assignedUser.department?.type !== 'CONSTRUCTION') {
      throw new AppError('Assigned user must belong to Construction department', 400);
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new AppError('No valid fields provided for update', 400);
  }

  const customerRequest = await constructionRepository.updateCustomerRequest(requestId, updatePayload);
  await auditService.log('update_customer_request', currentUser.id, { targetCustomerRequestId: requestId, changes: updatePayload });

  return { customerRequest };
};

const listQuoteRequests = async (query = {}, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_QUOTE_REQUEST')) throw new AppError('Insufficient permissions', 403);

  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Math.min(Number(query.limit), 100) : 20;
  const skip = (page - 1) * limit;

  const where = {};
  if (query.status) where.status = query.status;
  if (query.assignedToUserId) where.assignedToUserId = query.assignedToUserId;
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.search) {
    const search = normalizeString(query.search);
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
        { customerPhone: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { projectType: { contains: search, mode: 'insensitive' } },
      ];
    }
  }

  if (currentUser.role !== 'SUPER_ADMIN') {
    where.department = { type: currentUser.department.type };
  }

  const { items, total } = await constructionRepository.listQuoteRequests({ where, skip, take: limit });
  return { items, ...buildPagination(page, limit, total) };
};

const getQuoteRequest = async (requestId, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_QUOTE_REQUEST')) throw new AppError('Insufficient permissions', 403);

  const request = await constructionRepository.getQuoteRequestById(requestId);
  if (!request) throw new AppError('Quote request not found', 404);
  if (currentUser.role !== 'SUPER_ADMIN' && request.department?.type !== currentUser.department.type) {
    throw new AppError('Access denied', 403);
  }

  return { quoteRequest: request };
};

const createQuoteRequest = async (data, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('CREATE_QUOTE_REQUEST')) throw new AppError('Insufficient permissions', 403);

  const departmentContext = await getDepartmentContext(currentUser);
  const departmentId = data.departmentId ? String(data.departmentId).trim() : null;

  let finalDepartmentId = departmentId;
  if (departmentContext) {
    if (departmentId && departmentId !== departmentContext.id) {
      throw new AppError('Access to this department is not allowed', 403);
    }
    finalDepartmentId = departmentContext.id;
  }

  if (departmentId && currentUser.role === 'SUPER_ADMIN') {
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) throw new AppError('Department not found', 404);
  }

  const quoteRequestPayload = {
    departmentId: finalDepartmentId,
    customerName: normalizeString(data.customerName),
    customerEmail: normalizeString(data.customerEmail) || null,
    customerPhone: normalizeString(data.customerPhone),
    projectType: normalizeString(data.projectType) || null,
    description: normalizeString(data.description),
    budgetRange: normalizeString(data.budgetRange) || null,
    status: normalizeString(data.status) || 'NEW',
    assignedToUserId: data.assignedToUserId || null,
  };

  const quoteRequest = await constructionRepository.createQuoteRequest(quoteRequestPayload);
  await auditService.log('create_quote_request', currentUser.id, { targetQuoteRequestId: quoteRequest.id, departmentId: quoteRequest.departmentId });
  return { quoteRequest };
};

const updateQuoteRequest = async (requestId, data, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('UPDATE_QUOTE_REQUEST')) throw new AppError('Insufficient permissions', 403);

  const existing = await constructionRepository.getQuoteRequestById(requestId);
  if (!existing) throw new AppError('Quote request not found', 404);
  if (currentUser.role !== 'SUPER_ADMIN' && existing.department?.type !== currentUser.department.type) {
    throw new AppError('Access denied', 403);
  }

  const updatePayload = {};
  if (data.customerName !== undefined) updatePayload.customerName = normalizeString(data.customerName);
  if (data.customerPhone !== undefined) updatePayload.customerPhone = normalizeString(data.customerPhone);
  if (data.customerEmail !== undefined) updatePayload.customerEmail = normalizeString(data.customerEmail) || null;
  if (data.projectType !== undefined) updatePayload.projectType = normalizeString(data.projectType) || null;
  if (data.description !== undefined) updatePayload.description = normalizeString(data.description);
  if (data.budgetRange !== undefined) updatePayload.budgetRange = normalizeString(data.budgetRange) || null;
  if (data.status !== undefined) updatePayload.status = normalizeString(data.status);
  if (data.assignedToUserId !== undefined) updatePayload.assignedToUserId = data.assignedToUserId || null;
  if (data.departmentId !== undefined) {
    const newDepartmentId = data.departmentId ? String(data.departmentId).trim() : null;
    if (currentUser.role !== 'SUPER_ADMIN' && newDepartmentId) {
      const departmentContext = await getDepartmentContext(currentUser);
      if (departmentContext.id !== newDepartmentId) {
        throw new AppError('Access to this department is not allowed', 403);
      }
    }
    if (newDepartmentId) {
      const department = await prisma.department.findUnique({ where: { id: newDepartmentId } });
      if (!department) throw new AppError('Department not found', 404);
    }
    updatePayload.departmentId = newDepartmentId;
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new AppError('No valid fields provided for update', 400);
  }

  const quoteRequest = await constructionRepository.updateQuoteRequest(requestId, updatePayload);
  await auditService.log('update_quote_request', currentUser.id, { targetQuoteRequestId: requestId, changes: updatePayload });

  return { quoteRequest };
};

const generateSlug = (value) => {
  const slug = normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || `project-${Date.now()}`;
};

const listProjects = async (query = {}, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_PROJECT')) throw new AppError('Insufficient permissions', 403);

  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Math.min(Number(query.limit), 100) : 20;
  const skip = (page - 1) * limit;

  const where = {};
  if (query.status) where.status = query.status;
  if (query.publicationStatus) where.publicationStatus = query.publicationStatus;
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.isTemplate !== undefined) {
    where.isTemplate = query.isTemplate === 'true' || query.isTemplate === true;
  }
  if (query.search) {
    const search = normalizeString(query.search);
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
  }

  if (currentUser.role !== 'SUPER_ADMIN') {
    where.department = { type: currentUser.department.type };
  }

  const { items, total } = await constructionRepository.listProjects({ where, skip, take: limit });
  return { items, ...buildPagination(page, limit, total) };
};

const getProject = async (projectId, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_PROJECT')) throw new AppError('Insufficient permissions', 403);

  const project = await constructionRepository.getProjectById(projectId);
  if (!project) throw new AppError('Project not found', 404);
  await assertProjectAccess(project, currentUser);

  return { project };
};

const createProject = async (data, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('CREATE_PROJECT')) throw new AppError('Insufficient permissions', 403);

  const departmentContext = await getDepartmentContext(currentUser);
  const departmentId = data.departmentId ? String(data.departmentId).trim() : null;

  let finalDepartmentId = departmentId;
  if (departmentContext) {
    if (departmentId && departmentId !== departmentContext.id) {
      throw new AppError('Access to this department is not allowed', 403);
    }
    finalDepartmentId = departmentContext.id;
  }

  if (!finalDepartmentId) {
    throw new AppError('departmentId is required', 400);
  }

  const department = await prisma.department.findUnique({ where: { id: finalDepartmentId } });
  if (!department) throw new AppError('Department not found', 404);

  const projectPayload = {
    departmentId: finalDepartmentId,
    title: normalizeString(data.title),
    slug: data.slug ? normalizeString(data.slug) : generateSlug(data.title),
    location: normalizeString(data.location) || null,
    description: normalizeString(data.description) || null,
    budget: parseBudget(data.budget),
    status: normalizeString(data.status) || 'DRAFT',
    publicationStatus: normalizeString(data.publicationStatus) || 'DRAFT',
    isTemplate: data.isTemplate !== undefined ? Boolean(data.isTemplate) : false,
  };

  const project = await constructionRepository.createProject(projectPayload);
  await auditService.log('create_project', currentUser.id, { targetProjectId: project.id, departmentId: project.departmentId });

  return { project };
};

const updateProject = async (projectId, data, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('UPDATE_PROJECT')) throw new AppError('Insufficient permissions', 403);

  const existing = await constructionRepository.getProjectById(projectId);
  if (!existing) throw new AppError('Project not found', 404);
  await assertProjectAccess(existing, currentUser);

  const updatePayload = {};
  if (data.title !== undefined) updatePayload.title = normalizeString(data.title);
  if (data.slug !== undefined) updatePayload.slug = normalizeString(data.slug) || generateSlug(data.title || existing.title);
  if (data.location !== undefined) updatePayload.location = normalizeString(data.location) || null;
  if (data.description !== undefined) updatePayload.description = normalizeString(data.description) || null;
  if (data.budget !== undefined) updatePayload.budget = parseBudget(data.budget);
  if (data.status !== undefined) updatePayload.status = normalizeString(data.status);
  if (data.publicationStatus !== undefined) updatePayload.publicationStatus = normalizeString(data.publicationStatus);
  if (data.isTemplate !== undefined) updatePayload.isTemplate = Boolean(data.isTemplate);
  if (data.departmentId !== undefined) {
    const newDepartmentId = data.departmentId ? String(data.departmentId).trim() : null;
    if (currentUser.role !== 'SUPER_ADMIN' && newDepartmentId) {
      const departmentContext = await getDepartmentContext(currentUser);
      if (departmentContext.id !== newDepartmentId) {
        throw new AppError('Access to this department is not allowed', 403);
      }
    }
    if (newDepartmentId) {
      const department = await prisma.department.findUnique({ where: { id: newDepartmentId } });
      if (!department) throw new AppError('Department not found', 404);
    }
    updatePayload.departmentId = newDepartmentId;
  }

  if (Object.keys(updatePayload).length === 0) {
    throw new AppError('No valid fields provided for update', 400);
  }

  const project = await constructionRepository.updateProject(projectId, updatePayload);
  await auditService.log('update_project', currentUser.id, { targetProjectId: projectId, changes: updatePayload });

  return { project };
};

const deleteProject = async (projectId, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('DELETE_PROJECT')) throw new AppError('Insufficient permissions', 403);

  const existing = await constructionRepository.getProjectById(projectId);
  if (!existing) throw new AppError('Project not found', 404);
  await assertProjectAccess(existing, currentUser);

  const deleted = await constructionRepository.deleteProject(projectId);
  await auditService.log('delete_project', currentUser.id, { targetProjectId: projectId });
  return { project: deleted };
};

// ProjectUpdate service
const listProjectUpdates = async (query = {}, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_PROJECT')) throw new AppError('Insufficient permissions', 403);

  if (currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'SERVICE_ADMIN' && query.projectId) {
    const project = await constructionRepository.getProjectById(query.projectId);
    if (!project) throw new AppError('Project not found', 404);
    await assertProjectAccess(project, currentUser);
  }

  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Math.min(Number(query.limit), 100) : 20;
  const skip = (page - 1) * limit;

  const where = {};
  if (query.projectId) where.projectId = query.projectId;
  if (query.search) {
    const search = normalizeString(query.search);
    if (search) where.OR = [ { title: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } } ];
  }

  if (currentUser.role !== 'SUPER_ADMIN') {
    where.project = { department: { type: currentUser.department.type } };
  }

  const { items, total } = await constructionRepository.listProjectUpdates({ where, skip, take: limit });
  return { items, ...buildPagination(page, limit, total) };
};

const getProjectUpdate = async (updateId, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_PROJECT')) throw new AppError('Insufficient permissions', 403);

  const update = await constructionRepository.getProjectUpdateById(updateId);
  if (!update) throw new AppError('Project update not found', 404);
  await assertProjectAccess(update.project, currentUser);

  return { projectUpdate: update };
};

const createProjectUpdate = async (data, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('CREATE_PROJECT') && !currentUser.permissions.includes('CREATE_PROJECT_UPDATE')) throw new AppError('Insufficient permissions', 403);

  const projectId = data.projectId;
  if (!projectId) throw new AppError('projectId is required', 400);

  const project = await constructionRepository.getProjectById(projectId);
  
  if (!project) throw new AppError('Project not found', 404);
  await assertProjectAccess(project, currentUser);

  const payload = {
    projectId,
    title: normalizeString(data.title),
    description: normalizeString(data.description) || '',
  };

  const created = await constructionRepository.createProjectUpdate(payload);
  await auditService.log('create_project_update', currentUser.id, { targetProjectUpdateId: created.id, projectId: created.projectId });

  return { projectUpdate: created };
};

const updateProjectUpdate = async (updateId, data, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('UPDATE_PROJECT')) throw new AppError('Insufficient permissions', 403);

  const existing = await constructionRepository.getProjectUpdateById(updateId);
  if (!existing) throw new AppError('Project update not found', 404);
  await assertProjectAccess(existing.project, currentUser);

  const updatePayload = {};
  if (data.title !== undefined) updatePayload.title = normalizeString(data.title);
  if (data.description !== undefined) updatePayload.description = normalizeString(data.description);

  if (Object.keys(updatePayload).length === 0) throw new AppError('No valid fields provided for update', 400);

  const updated = await constructionRepository.updateProjectUpdate(updateId, updatePayload);
  await auditService.log('update_project_update', currentUser.id, { targetProjectUpdateId: updateId, changes: updatePayload });
  return { projectUpdate: updated };
};

const deleteProjectUpdate = async (updateId, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('DELETE_PROJECT')) throw new AppError('Insufficient permissions', 403);

  const existing = await constructionRepository.getProjectUpdateById(updateId);
  if (!existing) throw new AppError('Project update not found', 404);
  await assertProjectAccess(existing.project, currentUser);

  const deleted = await constructionRepository.deleteProjectUpdate(updateId);
  await auditService.log('delete_project_update', currentUser.id, { targetProjectUpdateId: updateId });
  return { project: deleted };
};

// ProjectGallery service
const listProjectGallery = async (query = {}, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_PROJECT')) throw new AppError('Insufficient permissions', 403);

  if (currentUser.role !== 'SUPER_ADMIN' && currentUser.role !== 'SERVICE_ADMIN' && query.projectId) {
    const project = await constructionRepository.getProjectById(query.projectId);
    if (!project) throw new AppError('Project not found', 404);
    await assertProjectAccess(project, currentUser);
  }

  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  const limit = Number(query.limit) > 0 ? Math.min(Number(query.limit), 100) : 50;
  const skip = (page - 1) * limit;

  const where = {};
  if (query.projectId) where.projectId = query.projectId;

  if (currentUser.role !== 'SUPER_ADMIN') {
    where.project = { department: { type: currentUser.department.type } };
  }

  const { items, total } = await constructionRepository.listProjectGallery({ where, skip, take: limit });
  return { items, ...buildPagination(page, limit, total) };
};

const getProjectGallery = async (galleryId, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('VIEW_PROJECT')) throw new AppError('Insufficient permissions', 403);

  const gallery = await constructionRepository.getProjectGalleryById(galleryId);
  if (!gallery) throw new AppError('Project media not found', 404);
  await assertProjectAccess(gallery.project, currentUser);

  return { gallery };
};

const createProjectGallery = async (data, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('CREATE_PROJECT')) throw new AppError('Insufficient permissions', 403);

  const projectId = data.projectId;
  if (!projectId) throw new AppError('projectId is required', 400);

  const project = await constructionRepository.getProjectById(projectId);
  if (!project) throw new AppError('Project not found', 404);
  await assertProjectAccess(project, currentUser);

  // verify media exists
  const media = await prisma.media.findUnique({ where: { id: data.mediaId } });
  if (!media) throw new AppError('Media not found', 404);

  const payload = {
    projectId,
    mediaId: data.mediaId,
    caption: data.caption ? normalizeString(data.caption) : null,
    order: Number.isFinite(Number(data.order)) ? Number(data.order) : 0,
  };

  const created = await constructionRepository.createProjectGallery(payload);
  await auditService.log('create_project_media', currentUser.id, { targetProjectId: projectId, targetMediaId: created.mediaId, galleryId: created.id });

  return { gallery: created };
};

const updateProjectGallery = async (galleryId, data, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('UPDATE_PROJECT')) throw new AppError('Insufficient permissions', 403);

  const existing = await constructionRepository.getProjectGalleryById(galleryId);
  if (!existing) throw new AppError('Project media not found', 404);
  await assertProjectAccess(existing.project, currentUser);

  const updatePayload = {};
  if (data.caption !== undefined) updatePayload.caption = data.caption ? normalizeString(data.caption) : null;
  if (data.order !== undefined) updatePayload.order = Number(data.order);

  if (Object.keys(updatePayload).length === 0) throw new AppError('No valid fields provided for update', 400);

  const updated = await constructionRepository.updateProjectGallery(galleryId, updatePayload);
  await auditService.log('update_project_media', currentUser.id, { targetProjectId: updated.projectId, targetMediaId: updated.mediaId, galleryId: updated.id, changes: updatePayload });

  return { gallery: updated };
};

const deleteProjectGallery = async (galleryId, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('DELETE_PROJECT')) throw new AppError('Insufficient permissions', 403);

  const existing = await constructionRepository.getProjectGalleryById(galleryId);
  if (!existing) throw new AppError('Project media not found', 404);
  await assertProjectAccess(existing.project, currentUser);

  const deleted = await constructionRepository.deleteProjectGallery(galleryId);
  await auditService.log('delete_project_media', currentUser.id, { targetProjectId: deleted.projectId, targetMediaId: deleted.mediaId, galleryId: deleted.id });

  return { gallery: deleted };
};

const setPrimaryProjectMedia = async (galleryId, currentUser) => {
  assertConstructionAccess(currentUser);
  if (!currentUser.permissions.includes('UPDATE_PROJECT')) throw new AppError('Insufficient permissions', 403);

  const target = await constructionRepository.getProjectGalleryById(galleryId);
  if (!target) throw new AppError('Project media not found', 404);
  await assertProjectAccess(target.project, currentUser);

  const projectId = target.projectId;

  // Load all gallery items for the project and reassign orders so target becomes 0
  const { items } = await constructionRepository.listProjectGallery({ where: { projectId }, skip: 0, take: 1000 });

  const updates = items.map((g) => {
    if (g.id === galleryId) return prisma.projectGallery.update({ where: { id: g.id }, data: { order: 0 } });
    return prisma.projectGallery.update({ where: { id: g.id }, data: { order: (g.order || 0) + 1 } });
  });

  await prisma.$transaction(updates);
  await auditService.log('set_primary_project_media', currentUser.id, { targetProjectId: projectId, targetMediaId: target.mediaId, galleryId });

  const updatedTarget = await constructionRepository.getProjectGalleryById(galleryId);
  return { gallery: updatedTarget };
};

module.exports = {
  listCustomerRequests,
  getCustomerRequest,
  createCustomerRequest,
  updateCustomerRequest,
  listQuoteRequests,
  getQuoteRequest,
  createQuoteRequest,
  updateQuoteRequest,
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  // ProjectUpdate
  listProjectUpdates,
  getProjectUpdate,
  createProjectUpdate,
  updateProjectUpdate,
  deleteProjectUpdate,
  // ProjectGallery
  listProjectGallery,
  getProjectGallery,
  createProjectGallery,
  updateProjectGallery,
  deleteProjectGallery,
  setPrimaryProjectMedia,
};
