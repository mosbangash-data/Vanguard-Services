CREATE INDEX "Media_entityType_entityId_idx" ON "Media"("entityType", "entityId");
CREATE INDEX "Media_department_idx" ON "Media"("department");
CREATE INDEX "Media_publicId_idx" ON "Media"("publicId");
CREATE INDEX "Media_uploadedById_idx" ON "Media"("uploadedById");