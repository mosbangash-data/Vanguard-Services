import test from 'node:test'
import assert from 'node:assert/strict'
import { getMediaUrl, normalizeMedia } from './media.js'

test('uses the Cloudinary URL instead of a media filename', () => {
  const media = normalizeMedia({
    id: 'm1',
    fileName: 'Toyota.jpg',
    originalName: 'Toyota.jpg',
    url: 'https://res.cloudinary.com/demo/image/upload/v1/toyota.jpg',
  })

  assert.equal(getMediaUrl(media), 'https://res.cloudinary.com/demo/image/upload/v1/toyota.jpg')
  assert.notEqual(getMediaUrl({ id: 'm1', fileName: 'Toyota.jpg', originalName: 'Toyota.jpg' }), 'Toyota.jpg')
  assert.equal(getMediaUrl({ id: 'm1', fileName: 'Toyota.jpg', originalName: 'Toyota.jpg' }), '')
  assert.equal(getMediaUrl({ id: 'm1', url: 'Toyota.jpg' }), '')
})

test('prefers secureUrl, secure_url, then url', () => {
  assert.equal(
    getMediaUrl({ secureUrl: 'https://res.cloudinary.com/demo/image/upload/secure.jpg', url: 'https://res.cloudinary.com/demo/image/upload/url.jpg' }),
    'https://res.cloudinary.com/demo/image/upload/secure.jpg',
  )
  assert.equal(
    getMediaUrl({ secure_url: 'https://res.cloudinary.com/demo/image/upload/secure-legacy.jpg', url: 'https://res.cloudinary.com/demo/image/upload/url.jpg' }),
    'https://res.cloudinary.com/demo/image/upload/secure-legacy.jpg',
  )
})