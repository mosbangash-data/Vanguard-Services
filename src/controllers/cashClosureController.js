const cashClosureService = require('../services/cashClosureService');
const run = (work) => async (req, res, next) => {
  try {
    const data = await work(req);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};
module.exports = {
  getDay: run((req) => cashClosureService.getForAgencyDay(req.query.businessDate, req.user)),
  getById: run((req) => cashClosureService.getById(req.params.id, req.user)),
  saveDraft: run((req) => cashClosureService.saveDraft(req.body, req.user)),
  submit: run((req) => cashClosureService.submit(req.params.id, req.user)),
  approve: run((req) => cashClosureService.review(req.params.id, 'APPROVED', null, req.user)),
  reject: run((req) => cashClosureService.review(req.params.id, 'REJECTED', req.body?.reason, req.user)),
  createCorrection: run((req) => cashClosureService.createCorrection(req.params.id, req.body, req.user)),
  approveCorrection: run((req) => cashClosureService.reviewCorrection(req.params.id, req.params.correctionId, 'APPROVED', null, req.user)),
  rejectCorrection: run((req) => cashClosureService.reviewCorrection(req.params.id, req.params.correctionId, 'REJECTED', req.body?.reason, req.user)),
};