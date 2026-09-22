import { normalizeMedia } from './media'

const getRelationId = (item) => {
  if (!item) return null
  return item.relationId || item.id || null
}

const getMediaOrder = (item, fallback = 0) => {
  const value = item?.order
  return Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : fallback
}

/**
 * Determines exactly one primary item from the list.
 * Rules:
 * - If an existing or pending item is marked as primary, select it.
 * - If none is marked, default to the first available item.
 */
export function resolvePrimaryItem(items = []) {
  if (!Array.isArray(items) || items.length === 0) return null
  const marked = items.filter((item) => Boolean(item?.isPrimary))
  if (marked.length > 0) {
    return marked[0]
  }
  return items[0] || null
}

/**
 * Synchronizes relation rows for an entity (Vehicle, Bus, etc.).
 * The backend manages orphan media cleanup when a relation is removed.
 *
 * Real Backend Contract:
 * - Delete relation: DELETE ${endpoint}/:id
 * - Update relation: PUT ${endpoint}/:id with { order, isPrimary, caption }
 *   (Setting isPrimary: true automatically unsets other relations' isPrimary in the DB)
 * - Create relation: POST ${endpoint} with { [relationKey]: entityId, mediaId, order, isPrimary, caption }
 *   (Setting isPrimary: true automatically unsets other relations' isPrimary in the DB)
 */
export async function syncMediaRelations({
  api,
  uploadMedia,
  endpoint,
  relationKey,
  uploadOptions = {},
  entityId,
  existingMedia = [],
  pendingMedia = [],
  deletedMediaIds = [],
  onProgress,
}) {
  if (!entityId || !endpoint || !relationKey) {
    return { uploaded: [] }
  }

  // 1. Resolve deleted relations with resilient ID lookup (handles relationId or mediaId)
  const existingById = new Map()
  for (const item of existingMedia) {
    const relId = getRelationId(item)
    if (relId) existingById.set(relId, item)
    if (item?.mediaId) existingById.set(item.mediaId, item)
    if (item?.media?.id) existingById.set(item.media.id, item)
  }

  const resolvedDeletedIds = []
  for (const delId of new Set(deletedMediaIds)) {
    const matchedItem = existingById.get(delId)
    const relId = getRelationId(matchedItem) || delId
    if (relId && !resolvedDeletedIds.includes(relId)) {
      resolvedDeletedIds.push(relId)
    }
  }

  const remainingExisting = existingMedia.filter((item) => {
    const relId = getRelationId(item)
    return !resolvedDeletedIds.includes(relId)
  })

  // 2. Determine final combined sequence and primary item
  const finalItems = [...remainingExisting, ...pendingMedia]
  const primaryItem = resolvePrimaryItem(finalItems)

  // 3. Delete removed relations
  for (const [index, relationId] of resolvedDeletedIds.entries()) {
    onProgress?.(`Suppression du média ${index + 1}/${resolvedDeletedIds.length}…`)
    await api.delete(`${endpoint}/${relationId}`)
  }

  // 4. Update remaining existing relations (order, primary state)
  // First update non-primary items to false if their order changed, then update the primary item last
  // to guarantee that the primary is accurately registered in the database.
  const existingUpdates = []
  for (let index = 0; index < remainingExisting.length; index += 1) {
    const item = remainingExisting[index]
    const relationId = getRelationId(item)
    if (!relationId) continue

    const finalIndex = finalItems.indexOf(item)
    const desiredOrder = finalIndex >= 0 ? finalIndex : index
    const desiredPrimary = primaryItem === item
    const currentOrder = getMediaOrder(item, index)
    const currentPrimary = Boolean(item.isPrimary)

    if (currentOrder !== desiredOrder || currentPrimary !== desiredPrimary) {
      existingUpdates.push({
        relationId,
        order: desiredOrder,
        isPrimary: desiredPrimary,
        item,
      })
    }
  }

  // Sort updates: false primaries first, then true primary so unsetPrimary runs cleanly
  existingUpdates.sort((a, b) => Number(a.isPrimary) - Number(b.isPrimary))

  for (const [idx, upd] of existingUpdates.entries()) {
    onProgress?.(`Mise à jour du média ${idx + 1}/${existingUpdates.length}…`)
    await api.put(`${endpoint}/${upd.relationId}`, {
      order: upd.order,
      isPrimary: upd.isPrimary,
    })
  }

  // 5. Upload pending files and create relations
  const uploaded = []
  for (let index = 0; index < pendingMedia.length; index += 1) {
    const item = pendingMedia[index]
    if (!item?.file) continue

    const finalIndex = finalItems.indexOf(item)
    const desiredOrder = finalIndex >= 0 ? finalIndex : remainingExisting.length + index
    const isPrimary = primaryItem === item

    onProgress?.(`Téléversement du fichier ${index + 1}/${pendingMedia.length}…`)

    const uploadedMedia = await uploadMedia(item.file, {
      ...uploadOptions,
      entityId,
    })

    const relationPayload = {
      [relationKey]: entityId,
      mediaId: uploadedMedia.id,
      order: desiredOrder,
      isPrimary,
    }

    onProgress?.(`Association du média ${index + 1}/${pendingMedia.length}…`)
    const response = await api.post(endpoint, relationPayload)

    const relation =
      response.data?.data?.vehicleMedia ||
      response.data?.data?.busMedia ||
      response.data?.data?.gallery ||
      response.data?.vehicleMedia ||
      response.data?.busMedia ||
      response.data?.gallery ||
      response.data?.data ||
      response.data

    uploaded.push(relation || { id: uploadedMedia.id, media: uploadedMedia, order: desiredOrder, isPrimary })
  }

  onProgress?.('')
  return { uploaded, success: true }
}
