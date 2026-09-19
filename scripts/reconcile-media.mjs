#!/usr/bin/env node
import prisma from '../src/config/prisma.js';
import mediaService from '../src/services/mediaService.js';

const { deleteMediaIfOrphaned } = mediaService;

const apply = process.argv.includes('--apply');

const orphanedMedia = await prisma.media.findMany({
  where: {
    vehicleMedia: { none: {} },
    busMedia: { none: {} },
    projectGallery: { none: {} },
  },
  select: {
    id: true,
    publicId: true,
    resourceType: true,
    entityType: true,
    entityId: true,
    createdAt: true,
  },
  orderBy: { createdAt: 'asc' },
});

console.log(`Media sans relation: ${orphanedMedia.length}`);
for (const media of orphanedMedia) {
  console.log(JSON.stringify({
    id: media.id,
    publicId: media.publicId,
    resourceType: media.resourceType,
    entityType: media.entityType,
    entityId: media.entityId,
    createdAt: media.createdAt.toISOString(),
  }));
}

if (!apply) {
  console.log('DRY-RUN: aucune suppression effectuée. Utiliser --apply après revue explicite.');
  await prisma.$disconnect();
  process.exit(0);
}

for (const media of orphanedMedia) {
  try {
    await deleteMediaIfOrphaned(media.id);
    console.log(`Supprimé: ${media.id}`);
  } catch (error) {
    console.error(`Échec suppression ${media.id}: ${error.message}`);
  }
}

await prisma.$disconnect();
