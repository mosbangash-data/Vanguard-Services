#!/usr/bin/env node
import prisma from '../src/config/prisma.js';

const isCloudinaryUrl = (value) => typeof value === 'string' && /^https:\/\/res\.cloudinary\.com\//i.test(value.trim());
const isAbsoluteUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value.trim());

const media = await prisma.media.findMany({
  select: {
    id: true,
    url: true,
    publicId: true,
    fileName: true,
    originalName: true,
    entityType: true,
    entityId: true,
    vehicleMedia: { select: { id: true } },
    busMedia: { select: { id: true } },
    projectGallery: { select: { id: true } },
  },
  orderBy: { createdAt: 'asc' },
});

const report = {
  valid: [],
  withoutCloudinaryUrl: [],
  localUrl: [],
  orphaned: [],
};

for (const item of media) {
  const relationCount = item.vehicleMedia.length + item.busMedia.length + item.projectGallery.length;
  const summary = {
    id: item.id,
    url: item.url,
    publicId: item.publicId,
    fileName: item.fileName,
    originalName: item.originalName,
    entityType: item.entityType,
    entityId: item.entityId,
  };

  if (relationCount === 0) report.orphaned.push(summary);
  if (isCloudinaryUrl(item.url)) {
    report.valid.push(summary);
  } else {
    report.withoutCloudinaryUrl.push(summary);
    if (item.url && !isAbsoluteUrl(item.url)) report.localUrl.push(summary);
  }
}

const printSection = (title, items) => {
  console.log(`\n${title} (${items.length})`);
  for (const item of items) console.log(JSON.stringify(item));
};

printSection('MEDIA VALIDES', report.valid);
printSection('MEDIA SANS URL CLOUDINARY', report.withoutCloudinaryUrl);
printSection('MEDIA AVEC URL LOCALE', report.localUrl);
printSection('MEDIA ORPHELINS', report.orphaned);
console.log('\nAucune donnée n’a été modifiée.');

await prisma.$disconnect();