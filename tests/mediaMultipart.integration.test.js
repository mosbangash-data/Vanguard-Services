const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('http');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'multipart-test-jwt';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'multipart-test-session';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/multipart_test';
const fullApp = require('../src/app');
const { parseMultipart } = require('../src/middleware/uploadMiddleware');

const jpeg = () => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const png = () => Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const gif = () => Buffer.from('GIF89a');
const webp = () => Buffer.from('RIFFxxxxWEBP');

let server;
let baseUrl;
let fullServer;
let fullBaseUrl;

const sendMultipart = async (files) => {
  const form = new FormData();
  for (const file of files) {
    form.append('file', new Blob([file.bytes], { type: file.type }), file.name);
  }
  const response = await fetch(`${baseUrl}/upload`, { method: 'POST', body: form });
  return { status: response.status, body: await response.json() };
};

test.before(async () => {
  const app = express();
  app.post('/upload', parseMultipart, (req, res) => res.status(201).json({ count: req.files.length }));
  app.use((error, req, res, next) => {
    void req;
    void next;
    res.status(error.statusCode || 500).json({ message: error.message });
  });
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  fullServer = http.createServer(fullApp);
  await new Promise((resolve) => fullServer.listen(0, '127.0.0.1', resolve));
  fullBaseUrl = `http://127.0.0.1:${fullServer.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  await new Promise((resolve, reject) => fullServer.close((error) => (error ? reject(error) : resolve())));
});

test('multipart upload rejects unauthenticated users before processing the file', async () => {
  const form = new FormData();
  form.append('file', new Blob([jpeg()], { type: 'image/jpeg' }), 'valid.jpg');
  const response = await fetch(`${fullBaseUrl}/api/upload`, { method: 'POST', body: form });
  assert.equal(response.status, 401);
});

test('multipart accepts valid JPEG, PNG, WEBP and GIF files', async () => {
  const response = await sendMultipart([
    { name: 'valid.jpg', type: 'image/jpeg', bytes: jpeg() },
    { name: 'valid.png', type: 'image/png', bytes: png() },
    { name: 'valid.webp', type: 'image/webp', bytes: webp() },
    { name: 'valid.gif', type: 'image/gif', bytes: gif() },
  ]);
  assert.equal(response.status, 201);
  assert.equal(response.body.count, 4);
});

test('multipart rejects falsified MIME, extension and binary signature', async () => {
  const cases = [
    [{ name: 'fake.jpg', type: 'image/png', bytes: jpeg() }, /extension/i],
    [{ name: 'fake.txt', type: 'image/jpeg', bytes: jpeg() }, /extension/i],
    [{ name: 'fake.jpg', type: 'image/jpeg', bytes: Buffer.from('not jpeg') }, /content/i],
  ];
  for (const [file, expectedMessage] of cases) {
    const response = await sendMultipart([file]);
    assert.equal(response.status, 400 + (expectedMessage.source === 'content' ? 22 : 0));
    assert.match(response.body.message, expectedMessage);
  }
});

test('multipart rejects files over 10MB and batches over 12 files', async () => {
  const oversized = await sendMultipart([{ name: 'large.jpg', type: 'image/jpeg', bytes: Buffer.concat([jpeg(), Buffer.alloc(10 * 1024 * 1024)]) }]);
  assert.equal(oversized.status, 413);

  const tooMany = await sendMultipart(Array.from({ length: 13 }, (_, index) => ({
    name: `file-${index}.jpg`,
    type: 'image/jpeg',
    bytes: jpeg(),
  })));
  assert.equal(tooMany.status, 400);
});
