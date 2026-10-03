import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MEDIA_VARIANTS,
  getMediaList,
  getMediaUrl,
  getPrimaryMedia,
  hasCloudinaryTransformation,
  normalizeMedia,
  normalizeMediaList,
} from '../src/utils/media.js'

const cloudinaryUrl = 'https://res.cloudinary.com/demo/image/upload/v123/example.jpg'

test('builds responsive Cloudinary variants from absolute URLs', () => {
  assert.equal(
    getMediaUrl(cloudinaryUrl, { variant: 'card' }),
    'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,w_640,h_400/v123/example.jpg',
  )
  assert.equal(MEDIA_VARIANTS.fullscreen.width, 2400)
  assert.equal(getMediaUrl('/media/example.jpg', { variant: 'card' }), '/media/example.jpg')
})

test('preserves already transformed Cloudinary URLs and local paths', () => {
  const transformed = 'https://res.cloudinary.com/demo/image/upload/c_crop,w_500/v123/example.jpg'
  assert.equal(hasCloudinaryTransformation(transformed), true)
  assert.equal(getMediaUrl(transformed, { variant: 'thumbnail' }), transformed)
  assert.equal(getMediaUrl('/uploads/example.jpg'), '/uploads/example.jpg')
})

test('rejects bare filenames, javascript URLs, null data, and incomplete media', () => {
  assert.equal(getMediaUrl('image.jpg'), '')
  assert.equal(getMediaUrl('javascript:alert(1)'), '')
  assert.equal(normalizeMedia(null), null)
  assert.equal(normalizeMedia(undefined), null)
  assert.deepEqual(getMediaList(null), [])
  assert.deepEqual(getMediaList(undefined), [])
  assert.deepEqual(getMediaList([]), [])
  assert.deepEqual(getMediaList([{}, null, { url: 'javascript:alert(1)' }]), [])
  assert.deepEqual(normalizeMediaList({}), [])
})

test('normalizes nested image and video relations without exposing filenames', () => {
  const image = normalizeMedia({ id: 'vehicle-relation', isPrimary: true, order: 2, caption: 'Side view', media: { id: 'image-id', url: cloudinaryUrl, mimeType: 'image/jpeg', fileName: 'private.jpg' } })
  assert.equal(image.id, 'vehicle-relation')
  assert.equal(image.type, 'image')
  assert.equal(image.alt, 'Side view')
  assert.equal(image.isPrimary, true)
  assert.equal(image.order, 2)
  assert.equal(image.fileName, 'private.jpg')
  assert.equal(getMediaUrl(image), cloudinaryUrl)

  const video = normalizeMedia({ url: 'https://res.cloudinary.com/demo/video/upload/demo.mp4', mimeType: 'video/mp4' })
  assert.equal(video.type, 'video')
})

test('sorts primary first, then by supplied order, while keeping stable ties', () => {
  const items = [
    { id: 'late', url: '/late.jpg', order: 4 },
    { id: 'primary', url: '/primary.jpg', isPrimary: true, order: 9 },
    { id: 'early-a', url: '/early-a.jpg', order: 1 },
    { id: 'early-b', url: '/early-b.jpg', order: 1 },
  ]
  assert.deepEqual(getMediaList(items).map((item) => item.id), ['primary', 'early-a', 'early-b', 'late'])
  assert.equal(getPrimaryMedia(items).id, 'primary')
})
