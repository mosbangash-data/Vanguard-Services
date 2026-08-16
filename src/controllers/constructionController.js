const constructionService = require('../services/constructionService');

const listCustomerRequests = async (req, res, next) => {
  try {
    const result = await constructionService.listCustomerRequests(req.query, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getCustomerRequest = async (req, res, next) => {
  try {
    const result = await constructionService.getCustomerRequest(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const createCustomerRequest = async (req, res, next) => {
  try {
    const result = await constructionService.createCustomerRequest(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const updateCustomerRequest = async (req, res, next) => {
  try {
    const result = await constructionService.updateCustomerRequest(req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const listQuoteRequests = async (req, res, next) => {
  try {
    const result = await constructionService.listQuoteRequests(req.query, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getQuoteRequest = async (req, res, next) => {
  try {
    const result = await constructionService.getQuoteRequest(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const createQuoteRequest = async (req, res, next) => {
  try {
    const result = await constructionService.createQuoteRequest(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const updateQuoteRequest = async (req, res, next) => {
  try {
    const result = await constructionService.updateQuoteRequest(req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const listProjects = async (req, res, next) => {
  try {
    const result = await constructionService.listProjects(req.query, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const listEngineerProjects = async (req, res, next) => {
  try {
    const result = await constructionService.listEngineerProjects(req.query, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getProject = async (req, res, next) => {
  try {
    const result = await constructionService.getProject(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const createProject = async (req, res, next) => {
  try {
    const result = await constructionService.createProject(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const result = await constructionService.updateProject(req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    const result = await constructionService.deleteProject(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// ProjectUpdate handlers
const listProjectUpdates = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const result = await constructionService.listProjectUpdates({ ...req.query, projectId }, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getProjectUpdate = async (req, res, next) => {
  try {
    const result = await constructionService.getProjectUpdate(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const createProjectUpdate = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const result = await constructionService.createProjectUpdate({ ...req.body, projectId }, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const updateProjectUpdate = async (req, res, next) => {
  try {
    const result = await constructionService.updateProjectUpdate(req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const deleteProjectUpdate = async (req, res, next) => {
  try {
    const result = await constructionService.deleteProjectUpdate(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

// ProjectGallery handlers
const listProjectGallery = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const result = await constructionService.listProjectGallery({ ...req.query, projectId }, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getProjectGallery = async (req, res, next) => {
  try {
    const result = await constructionService.getProjectGallery(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const createProjectGallery = async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    const result = await constructionService.createProjectGallery({ ...req.body, projectId }, req.user);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const updateProjectGallery = async (req, res, next) => {
  try {
    const result = await constructionService.updateProjectGallery(req.params.id, req.body, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const deleteProjectGallery = async (req, res, next) => {
  try {
    const result = await constructionService.deleteProjectGallery(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const setPrimaryProjectGallery = async (req, res, next) => {
  try {
    const result = await constructionService.setPrimaryProjectMedia(req.params.id, req.user);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
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
  listEngineerProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
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
  setPrimaryProjectGallery,
};
