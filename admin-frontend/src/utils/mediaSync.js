const getRelationId = (item) => item?.id || null

const getMediaOrder = (item, fallback) => {
  const value = item?.order
  return Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : fallback
}

const getPrimaryItem = (items) => {
  const marked = items.filter((item) => Boolean(item?.isPrimary))
  return marked.find((item) => Boolean(item?.file)) || marked[0] || items[0] || null
}

/**
 * Synchronizes relation rows only. Cloudinary/media records are never deleted here.
 * The backend relation endpoint owns orphan cleanup after a relation is removed.
 */
export async function syncMediaRelations({
  api,
  uploadMedia,
  endpoint,
  relationKey,
  uploadOptions,
  entityId,
  existingMedia = [],
  pendingMedia = [],
  deletedMediaIds = [],
  onProgress,
  primaryMode = 'update',
}) {
  if (!entityId || !endpoint || !relationKey) return { uploaded: [] }

  const existingById = new Map(
    existingMedia
      .map((item) => [getRelationId(item), item])
      .filter(([id]) => Boolean(id)),
  )
  const deletedIds = [...new Set(deletedMediaIds)].filter((id) => existingById.has(id))
  const remainingExisting = existingMedia.filter((item) => !deletedIds.includes(getRelationId(item)))
  const finalItems = [...remainingExisting, ...pendingMedia]
  const primaryItem = getPrimaryItem(finalItems)
  const finalSequence = primaryMode === 'set-primary' && primaryItem
    ? [primaryItem, ...finalItems.filter((item) => item !== primaryItem)]
    : finalItems
  const orderedExisting = finalSequence.filter((item) => existingById.has(getRelationId(item)))
  const orderedPending = finalSequence.filter((item) => !existingById.has(getRelationId(item)))

  for (const [index, relationId] of deletedIds.entries()) {
    onProgress?.(`Suppression du média ${index + 1}/${deletedIds.length}…`)
    await api.delete(`${endpoint}/${relationId}`)
  }

  for (const [index, item] of orderedExisting.entries()) {
    const relationId = getRelationId(item)
    if (!relationId) continue

    const desiredOrder = index
    const desiredPrimary = primaryItem === item
    const currentOrder = getMediaOrder(item, index)
    const currentPrimary = Boolean(item.isPrimary)

    if (currentOrder === desiredOrder && currentPrimary === desiredPrimary) continue

    onProgress?.(`Mise à jour du média ${index + 1}/${remainingExisting.length}…`)
    if (primaryMode === 'set-primary' && desiredPrimary) {
      await api.put(`${endpoint}/${relationId}`, { order: desiredOrder })
      await api.post(`${endpoint}/${relationId}/set-primary`)
    } else if (primaryMode === 'set-primary') {
      await api.put(`${endpoint}/${relationId}`, { order: desiredOrder })
    } else {
      await api.put(`${endpoint}/${relationId}`, {
        order: desiredOrder,
        isPrimary: desiredPrimary,
      })
    }
  }

  const uploaded = []
  for (let index = 0; index < orderedPending.length; index += 1) {
    const item = orderedPending[index]
    if (!item?.file) continue

    const finalIndex = finalSequence.indexOf(item)
    const isPrimary = primaryItem === item
    onProgress?.(`Téléversement du média ${index + 1}/${orderedPending.length}…`)

    const media = await uploadMedia(item.file, {
      ...uploadOptions,
      entityId,
    })

    const relationPayload = {
      [relationKey]: entityId,
      mediaId: media.id,
      order: finalIndex,
    }
    if (primaryMode === 'update') relationPayload.isPrimary = isPrimary
    const response = await api.post(endpoint, relationPayload)
    const relation = response.data?.data?.vehicleMedia
      || response.data?.data?.busMedia
      || response.data?.data?.gallery
      || response.data?.vehicleMedia
      || response.data?.busMedia
      || response.data?.gallery
      || response.data
    uploaded.push(relation || { id: media.id, media, order: finalIndex, isPrimary })

    if (primaryMode === 'set-primary' && isPrimary && relation?.id) {
      await api.post(`${endpoint}/${relation.id}/set-primary`)
    }
  }

  onProgress?.('')
  return { uploaded }
}
