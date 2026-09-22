const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

const startTestServer = () => new Promise((resolve, reject) => {
  const server = app.listen(0, () => resolve(server));
  server.on('error', reject);
});

test('CSP allows Cloudinary image origins for frontend responses', async () => {
  const server = await startTestServer();
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/automobile/vehicles`);
    const csp = response.headers.get('content-security-policy');

    assert.ok(csp, 'Content-Security-Policy header is missing');
    assert.match(csp, /img-src\s+['\"]?self['\"]?\s+data:\s+blob:\s+https:\/\/res\.cloudinary\.com/i, {
      message: 'Cloudinary image source is not allowed by CSP',
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
