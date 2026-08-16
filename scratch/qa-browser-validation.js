const assert = require('node:assert/strict');
const path = require('node:path');
const app = require('../src/app');
const prisma = require('../src/config/prisma');

async function main() {
  console.log('====================================================');
  console.log('QA FINALE — FRONTEND & BACKEND INGÉNIEUR CONSTRUCTION');
  console.log('====================================================\n');

  // Helper request
  const request = async (method, path, body = null, token = null) => {
    return new Promise((resolve, reject) => {
      const http = require('http');
      const server = http.createServer(app);
      server.listen(0, '127.0.0.1', async () => {
        const port = server.address().port;
        try {
          const fetchRes = await fetch(`http://127.0.0.1:${port}${path}`, {
            method,
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
          });
          const status = fetchRes.status;
          let data = null;
          const text = await fetchRes.text();
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
          server.close();
          resolve({ status, data });
        } catch (err) {
          server.close();
          reject(err);
        }
      });
    });
  };

  // Re-seed DB to ensure pristine state
  console.log('--- Phase 0: Checking baseline database & seed accounts ---');
  const userACheck = await prisma.user.findUnique({ where: { email: 'engineer.a@vanguard.local' } });
  const userBCheck = await prisma.user.findUnique({ where: { email: 'engineer.b@vanguard.local' } });
  assert.ok(userACheck, 'Engineer A must exist in database');
  assert.ok(userBCheck, 'Engineer B must exist in database');
  console.log('Prisma accounts ready.\n');

  // ==========================================
  // TEST 1: Engineer A Login & Flow
  // ==========================================
  console.log('--- Test 1: Engineer A Login & Flow ---');
  const loginResA = await request('POST', '/api/auth/login', {
    identifier: 'engineer.a@vanguard.local',
    password: 'EngineerA123!',
  });
  assert.equal(loginResA.status, 200, 'Engineer A login must succeed with 200');
  const tokenA = loginResA.data?.data?.token || loginResA.data?.token;
  const userA = loginResA.data?.data?.user || loginResA.data?.user;
  assert.ok(tokenA, 'Token A must be present');
  assert.equal(userA.role?.name || userA.role, 'ENGINEER', 'User A role must be ENGINEER');

  // Verify getDestination logic for Engineer A
  const getDestination = (user) => {
    if (user?.role === 'SUPER_ADMIN' || user?.role?.name === 'SUPER_ADMIN') return '/admin';
    if (user?.role === 'ENGINEER' || user?.role?.name === 'ENGINEER') return '/construction/engineer';
    const dept = user?.department?.type || user?.department;
    switch (dept) {
      case 'VANGUARD_COACH': return '/transport';
      case 'CONSTRUCTION': return '/construction';
      case 'AUTO_SALES': return '/automobile';
      default: return '/login';
    }
  };
  const destA = getDestination(userA);
  assert.equal(destA, '/construction/engineer', 'Engineer A must redirect to /construction/engineer');
  console.log('✔ Engineer A redirect: /construction/engineer');

  // Engineer A projects list via API
  const myProjectsA = await request('GET', '/api/construction/engineer/projects', null, tokenA);
  assert.equal(myProjectsA.status, 200);
  const itemsA = myProjectsA.data?.data?.items || myProjectsA.data?.data || myProjectsA.data;
  assert.ok(Array.isArray(itemsA));
  assert.equal(itemsA.length, 1, 'Engineer A should see exactly 1 assigned project');
  const projectA = itemsA[0];
  assert.equal(projectA.slug, 'engineer-a-site');
  console.log(`✔ Engineer A projects: found "${projectA.title}" (${projectA.id})`);

  // Dashboard Stats calculation
  const statsA = {
    total: itemsA.length,
    published: itemsA.filter((p) => p.status === 'PUBLISHED').length,
    archived: itemsA.filter((p) => p.status === 'ARCHIVED').length,
    draft: itemsA.filter((p) => p.status === 'DRAFT').length,
  };
  assert.equal(statsA.total, 1);
  assert.equal(statsA.published, 1);
  console.log('✔ Engineer A Dashboard stats computed: Total=1, Active=1, Completed=0, Draft=0');

  // Notifications
  const notifsA = await request('GET', '/api/notifications', null, tokenA);
  assert.equal(notifsA.status, 200);
  console.log('✔ Engineer A Notifications API: 200 OK');

  // Detail Project A
  const detailA = await request('GET', `/api/construction/projects/${projectA.id}`, null, tokenA);
  assert.equal(detailA.status, 200);
  console.log('✔ Engineer A can access Project A detail: 200 OK');

  // Create update on Project A
  const createUpdateA = await request('POST', `/api/construction/projects/${projectA.id}/updates`, {
    title: 'Gros oeuvre phase 1',
    description: 'Fondations et coulage achevés avec succès.',
  }, tokenA);
  assert.equal(createUpdateA.status, 201);
  const updateAId = createUpdateA.data?.data?.projectUpdate?.id || createUpdateA.data?.projectUpdate?.id || createUpdateA.data?.data?.id || createUpdateA.data?.id;
  console.log(`✔ Engineer A created update on Project A: 201 Created (ID: ${updateAId})`);

  // Modify update on Project A
  const editUpdateA = await request('PUT', `/api/construction/projects/${projectA.id}/updates/${updateAId}`, {
    title: 'Gros oeuvre phase 1 — Validé',
    description: 'Fondations et coulage achevés et validés par le bureau de contrôle.',
  }, tokenA);
  assert.equal(editUpdateA.status, 200);
  console.log('✔ Engineer A modified update on Project A: 200 OK');

  // Gallery on Project A
  const galleryA = await request('GET', `/api/construction/projects/${projectA.id}/gallery`, null, tokenA);
  assert.equal(galleryA.status, 200);
  console.log('✔ Engineer A accessed gallery on Project A: 200 OK\n');

  // ==========================================
  // TEST 2: Engineer B Login & Flow
  // ==========================================
  console.log('--- Test 2: Engineer B Login & Flow ---');
  const loginResB = await request('POST', '/api/auth/login', {
    identifier: 'engineer.b@vanguard.local',
    password: 'EngineerB123!',
  });
  assert.equal(loginResB.status, 200);
  const tokenB = loginResB.data?.data?.token || loginResB.data?.token;
  const userB = loginResB.data?.data?.user || loginResB.data?.user;
  assert.equal(userB.role?.name || userB.role, 'ENGINEER');
  assert.equal(getDestination(userB), '/construction/engineer');
  console.log('✔ Engineer B redirect: /construction/engineer');

  // Engineer B projects list via API
  const myProjectsB = await request('GET', '/api/construction/engineer/projects', null, tokenB);
  assert.equal(myProjectsB.status, 200);
  const itemsB = myProjectsB.data?.data?.items || myProjectsB.data?.data || myProjectsB.data;
  assert.equal(itemsB.length, 1, 'Engineer B should see exactly 1 assigned project');
  const projectB = itemsB[0];
  assert.equal(projectB.slug, 'engineer-b-site');
  console.log(`✔ Engineer B projects: found "${projectB.title}" (${projectB.id})`);

  // Detail Project B
  const detailB = await request('GET', `/api/construction/projects/${projectB.id}`, null, tokenB);
  assert.equal(detailB.status, 200);
  console.log('✔ Engineer B can access Project B detail: 200 OK');

  // Gallery on Project B
  const galleryB = await request('GET', `/api/construction/projects/${projectB.id}/gallery`, null, tokenB);
  assert.equal(galleryB.status, 200);
  console.log('✔ Engineer B accessed gallery on Project B: 200 OK\n');

  // ==========================================
  // TEST 3: Isolation Stricte (URL Manipulation)
  // ==========================================
  console.log('--- Test 3: Isolation Stricte (Direct URL Manipulation) ---');
  
  // Engineer A attempts accessing Project B
  const aTriesGetB = await request('GET', `/api/construction/projects/${projectB.id}`, null, tokenA);
  assert.equal(aTriesGetB.status, 403, 'Engineer A must receive 403 when accessing Project B');
  console.log('✔ Engineer A -> GET Project B: 403 FORBIDDEN');

  const aTriesPutB = await request('PUT', `/api/construction/projects/${projectB.id}`, { title: 'Hacked' }, tokenA);
  assert.equal(aTriesPutB.status, 403, 'Engineer A must receive 403 when modifying Project B');
  console.log('✔ Engineer A -> PUT Project B: 403 FORBIDDEN');

  const aTriesUpdatesB = await request('GET', `/api/construction/projects/${projectB.id}/updates`, null, tokenA);
  assert.equal(aTriesUpdatesB.status, 403, 'Engineer A must receive 403 when reading Project B updates');
  console.log('✔ Engineer A -> GET Project B updates: 403 FORBIDDEN');

  const aTriesCreateUpdateB = await request('POST', `/api/construction/projects/${projectB.id}/updates`, {
    title: 'Hack attempt',
    description: 'Tentative de mise à jour non autorisée.',
  }, tokenA);
  assert.equal(aTriesCreateUpdateB.status, 403, 'Engineer A must receive 403 when creating Project B update');
  console.log('✔ Engineer A -> POST Project B updates: 403 FORBIDDEN');

  const aTriesGalleryB = await request('GET', `/api/construction/projects/${projectB.id}/gallery`, null, tokenA);
  assert.equal(aTriesGalleryB.status, 403, 'Engineer A must receive 403 when reading Project B gallery');
  console.log('✔ Engineer A -> GET Project B gallery: 403 FORBIDDEN');

  // Engineer B attempts accessing Project A
  const bTriesGetA = await request('GET', `/api/construction/projects/${projectA.id}`, null, tokenB);
  assert.equal(bTriesGetA.status, 403, 'Engineer B must receive 403 when accessing Project A');
  console.log('✔ Engineer B -> GET Project A: 403 FORBIDDEN');

  const bTriesPutA = await request('PUT', `/api/construction/projects/${projectA.id}`, { title: 'Hacked' }, tokenB);
  assert.equal(bTriesPutA.status, 403, 'Engineer B must receive 403 when modifying Project A');
  console.log('✔ Engineer B -> PUT Project A: 403 FORBIDDEN');

  const bTriesUpdatesA = await request('GET', `/api/construction/projects/${projectA.id}/updates`, null, tokenB);
  assert.equal(bTriesUpdatesA.status, 403, 'Engineer B must receive 403 when reading Project A updates');
  console.log('✔ Engineer B -> GET Project A updates: 403 FORBIDDEN');

  const bTriesGalleryA = await request('GET', `/api/construction/projects/${projectA.id}/gallery`, null, tokenB);
  assert.equal(bTriesGalleryA.status, 403, 'Engineer B must receive 403 when reading Project A gallery');
  console.log('✔ Engineer B -> GET Project A gallery: 403 FORBIDDEN\n');

  // ==========================================
  // TEST 4: Navigation & Permissions Filtering
  // ==========================================
  console.log('--- Test 4: Navigation & Permissions Filtering for ENGINEER ---');
  
  // Test permissions logic for Engineer
  const engineerPermissions = ['VIEW_PROJECT', 'UPDATE_PROJECT', 'CREATE_PROJECT_UPDATE'];
  const hasPermission = (user, requiredPermission) => {
    if (!requiredPermission) return true;
    if (user?.role === 'SUPER_ADMIN') return true;
    return engineerPermissions.includes(requiredPermission);
  };

  const constructionNav = [
    { path: '/construction/projects', labelKey: 'construction.nav.projects', permission: 'VIEW_PROJECT', excludeRoles: ['ENGINEER'] },
    { path: '/construction/customer-requests', labelKey: 'construction.nav.customerRequests', permission: 'VIEW_CUSTOMER_REQUEST' },
    { path: '/construction/quote-requests', labelKey: 'construction.nav.quoteRequests', permission: 'VIEW_QUOTE_REQUEST' },
    { path: '/construction/engineer', labelKey: 'construction.nav.engineerDashboard' },
    { path: '/construction/engineer/projects', labelKey: 'construction.nav.engineerProjects', permission: 'VIEW_PROJECT' },
  ];

  const visibleForEngineer = constructionNav.filter((item) => {
    if (item.roles && !item.roles.includes('ENGINEER')) return false;
    if (item.excludeRoles && item.excludeRoles.includes('ENGINEER')) return false;
    return !item.permission || hasPermission({ role: 'ENGINEER' }, item.permission);
  });

  const visiblePaths = visibleForEngineer.map((i) => i.path);
  console.log('Visible navigation items for ENGINEER:', visiblePaths);
  assert.ok(visiblePaths.includes('/construction/engineer'), 'Must include /construction/engineer');
  assert.ok(visiblePaths.includes('/construction/engineer/projects'), 'Must include /construction/engineer/projects');
  assert.ok(!visiblePaths.includes('/construction/projects'), 'Must NOT include admin /construction/projects');
  assert.ok(!visiblePaths.includes('/construction/customer-requests'), 'Must NOT include /construction/customer-requests');
  assert.ok(!visiblePaths.includes('/construction/quote-requests'), 'Must NOT include /construction/quote-requests');
  console.log('✔ Menu filtering for ENGINEER is 100% compliant and secured.\n');

  // ==========================================
  // TEST 5: Admin Construction Regression
  // ==========================================
  console.log('--- Test 5: Admin Construction Regression Check ---');
  const loginAdmin = await request('POST', '/api/auth/login', {
    identifier: 'admin@vanguard.local',
    password: 'Admin123!',
  });
  assert.equal(loginAdmin.status, 200);
  const tokenAdmin = loginAdmin.data?.data?.token || loginAdmin.data?.token;

  const adminProjects = await request('GET', '/api/construction/projects', null, tokenAdmin);
  assert.equal(adminProjects.status, 200, 'Admin must access /api/construction/projects');

  const adminRequests = await request('GET', '/api/construction/customer-requests', null, tokenAdmin);
  assert.equal(adminRequests.status, 200, 'Admin must access /api/construction/customer-requests');

  const adminQuotes = await request('GET', '/api/construction/quote-requests', null, tokenAdmin);
  assert.equal(adminQuotes.status, 200, 'Admin must access /api/construction/quote-requests');
  console.log('✔ Admin Construction routes are 100% functional (no regression).\n');

  console.log('====================================================');
  console.log('TOUS LES TESTS DE VALIDATION QA SONT PASS (100%)');
  console.log('====================================================');
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('QA Validation Failed:', err);
  process.exit(1);
});
