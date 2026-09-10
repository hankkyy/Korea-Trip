import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { memoryDb, paths } from './sync-fixtures.mjs';
const require = createRequire(import.meta.url);
const { createSyncStore } = require('../cloudfunctions/korea-api/sync-store.js');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/lu-sync-runtime/node_modules/playwright/index.mjs');
const root = resolve(new URL('..', import.meta.url).pathname);
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + new URL(req.url, 'http://local').pathname.replace(/\/$/, '/index.html'));
    if (!path.startsWith(root + '/')) throw new Error('path');
    const content = await readFile(path);
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' })[extname(path)] || 'application/octet-stream');
    res.end(content);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const tripId = 'korea-2026';
const db = memoryDb({
  'kr_todos/a': { id: 'todo-a', title: '测试待办', done: false, tripId },
  'kr_todos/b': { id: 'todo-a', title: '测试待办', done: false, tripId },
  'kr_expenses/a': { clientId: 'expense-a', desc: '测试支出', amount: 100, currency: 'CNY', splitType: 'perPerson', tripId },
  'kr_checklist/a': { id: 'cl-a', text: '测试行李', done: false, tripId }
});
const store = createSyncStore(db, paths);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const viewport = process.env.DESKTOP_VIEWPORT ? { width: 1440, height: 1000 } : { width: 390, height: 844 };
const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
await context.addInitScript(() => {
  const session = { access_token: 'browser-test-token', user: { id: '2097823157655728129', is_anonymous: false } };
  window.cloudbase = { init: () => ({ auth: () => ({
    getSession: async () => ({ data: { session }, error: null }),
    signInWithPassword: async () => ({ data: { session }, error: null }),
    signInAnonymously: async () => ({ data: { session }, error: null }),
    signOut: async () => ({ error: null })
  }) }) };
});
const errors = []; let offline = false;
await context.route('**/*', async route => {
  const request = route.request(); const url = new URL(request.url());
  if (url.hostname === '127.0.0.1') return route.continue();
  const path = url.pathname.replace('/korea-api', '');
  if (!paths[path]) return route.fulfill({ status: 200, contentType: url.pathname.endsWith('.js') ? 'text/javascript' : 'application/json', body: '{}' });
  assert.equal(request.headers().authorization, 'Bearer browser-test-token');
  if (offline) return route.abort('internetdisconnected');
  try {
    const trip = url.searchParams.get('tripId');
    const result = request.method() === 'POST'
      ? await store.write(path, trip, request.postDataJSON()) : await store.read(path, trip);
    if (request.method() === 'POST') await new Promise(r => setTimeout(r, 80));
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
  } catch (error) { return route.fulfill({ status: error.status || 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: error.message }) }); }
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('dialog', dialog => dialog.dismiss());
try {
  await page.goto(`http://127.0.0.1:${server.address().port}/#todos`);
  await page.waitForFunction(() => document.querySelectorAll('#todosList .l-row').length === 1);
  await page.evaluate(() => {
    window.todoCounts = [];
    new MutationObserver(() => window.todoCounts.push(document.querySelectorAll('#todosList .l-row').length)).observe(document.querySelector('#todosList'), { childList: true });
  });
  for (let i = 0; i < 9; i++) await page.locator('#todosList [data-act="toggle"]').click();
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('kr_sync_queue_v2') || '[]').length);
  assert.equal((await store.read('/todos', tripId)).data.length, 1);
  assert.equal((await store.read('/todos', tripId)).data[0].done, true);
  await page.locator('#todosList [data-act="edit"]').click();
  await page.locator('#listTitleInput').fill('编辑后的待办');
  await page.locator('#listSave').click();
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('kr_sync_queue_v2') || '[]').length);
  // Exercise the existing expense handler while polling the shared sync layer.
  await page.evaluate(async () => { expenses[0].amount = 123; await persistExpenses(); renderExpenses(); });
  assert.equal((await store.read('/expenses', tripId)).data.length, 1);
  assert.equal((await store.read('/expenses', tripId)).data[0].amount, 123);
  offline = true;
  await page.locator('#todosList [data-act="toggle"]').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('kr_sync_queue_v2') || '[]').length > 0);
  await page.evaluate(() => syncClient.settled());
  assert.equal(await page.locator('#todosList .l-row').count(), 1);
  const observedTodoCounts = await page.evaluate(() => window.todoCounts);
  // Simulate Safari/localStorage eviction while the device is offline. IndexedDB
  // must restore the unsent edit before any remote read can replace the screen.
  await page.evaluate(() => localStorage.removeItem('kr_sync_queue_v2'));
  await page.reload();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('kr_sync_queue_v2') || '[]').length > 0);
  assert.equal(await page.locator('#todosList .l-row').count(), 1);
  offline = false;
  await page.evaluate(() => Promise.all([flushOfflineQueue(), flushOfflineQueue(), flushOfflineQueue()]));
  await page.waitForTimeout(11000);
  assert.equal(await page.locator('#todosList .l-row').count(), 1);
  assert.equal((await store.read('/todos', tripId)).data[0].done, false);
  assert(observedTodoCounts.every(n => n === 1));
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#todosList .l-text')?.textContent === '编辑后的待办');
  assert.equal(await page.locator('#todosList .l-row').count(), 1);
  console.log('Browser phase: baseline reload complete');
  await page.waitForFunction(() => ['/itinerary', '/checklist', '/bucket-list', '/docs'].every(path => syncClient.revision(path, activeTrip().id) != null));
  console.log('Browser phase: all dataset baselines loaded');

  const tabs = ['home', 'itinerary', 'transport', 'map', 'food', 'essay', 'todos', 'packing', 'docs', 'expenses', 'guide'];
  for (const tab of tabs) {
    await page.evaluate(value => showTab(value, false), tab);
    assert.equal(await page.locator(`#tab-${tab}`).evaluate(el => el.classList.contains('active')), true);
  }

  const itineraryId = 'it-browser-stable';
  await page.evaluate(async id => {
    currentItinerary = [sanitizeItineraryItem({ id, day: 1, time: '09:00', title: '稳定 ID 测试', createdAt: 1, updatedAt: Date.now() })];
    await saveItinerary(currentItinerary);
  }, itineraryId);
  assert.equal((await store.read('/itinerary', tripId)).data[0].id, itineraryId);
  console.log('Browser phase: itinerary stable ID saved');

  await page.evaluate(async () => {
    bucketItems = [{ id: 'bucket-browser', tripId: activeTrip().id, title: '浏览器打卡测试', done: false, createdAt: Date.now(), updatedAt: Date.now() }];
    renderBucket();
    showTab('todos', false);
  });
  await page.locator('#bucketList [data-id="bucket-browser"]').click();
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('kr_sync_queue_v2') || '[]').length);
  assert.equal((await store.read('/bucket-list', tripId)).data[0].done, true);
  console.log('Browser phase: bucket toggle saved');

  await page.evaluate(() => showTab('food', false));
  assert.equal(await page.locator('.food-add-btn[data-act="newfood"]').count(), 2);
  assert.equal(await page.locator('.food-add-card').count(), 0);
  await page.locator('.food-add-btn[data-act="newfood"][data-city="busan"]').click();
  await page.waitForFunction(() => document.querySelector('#foodBusan .food-card.editing'));
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('kr_sync_queue_v2') || '[]').length);
  const foodCard = page.locator('#foodBusan .food-card[data-id]').first();
  const actionHeights = await foodCard.locator('.food-actions .food-btn:visible').evaluateAll(buttons => buttons.map(button => Math.round(button.getBoundingClientRect().height)));
  assert.equal(new Set(actionHeights).size, 1);
  await foodCard.locator('[data-act="title"]').fill('跨设备美食收藏测试');
  if (process.env.SCREENSHOT_PATH) await page.locator('.food-collections').screenshot({ path: process.env.SCREENSHOT_PATH });
  await foodCard.locator('[data-act="title"]').press('Tab');
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('kr_sync_queue_v2') || '[]').length);
  assert((await store.read('/docs', tripId)).data.some(item => item.kind === 'food' && item.title === '跨设备美食收藏测试'));
  await foodCard.locator('[data-act="edit"]').click();
  assert.equal(await foodCard.evaluate(card => card.classList.contains('editing')), false);
  await foodCard.locator('[data-act="edit"]').click();
  await foodCard.locator('[data-act="delete"]').click();
  assert((await store.read('/docs', tripId)).data.some(item => item.kind === 'food'));
  console.log('Browser phase: food saved and delete confirmation checked');

  await page.evaluate(() => showTab('essay', false));
  await page.locator('#essayAddBtn').click();
  await page.locator('#essayTitleInput').fill('加密随笔测试');
  await page.locator('#essayContentInput').fill('这段正文只能存在于密文中');
  await page.locator('#essayPasswordInput').fill('browser-test-password');
  await page.locator('#essaySave').click();
  await page.waitForFunction(() => essayRecords.some(item => item.kind === 'essay') && !JSON.parse(localStorage.getItem('kr_sync_queue_v2') || '[]').length);
  const essay = (await store.read('/docs', tripId)).data.find(item => item.kind === 'essay');
  assert(essay?.payloadEnc && !JSON.stringify(essay).includes('这段正文只能存在于密文中'));
  console.log('Browser phase: encrypted essay saved');

  await page.evaluate(() => showTab('docs', false));
  const firstDoc = page.locator('#docsGrid .doc-card').first();
  await firstDoc.locator('[data-act="edit"]').click();
  await firstDoc.locator('[data-act="title"]').fill('文件标题保存测试');
  await firstDoc.locator('[data-act="edit"]').click();
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('kr_sync_queue_v2') || '[]').length);
  assert((await store.read('/docs', tripId)).data.some(item => item.kind === 'file' && item.title === '文件标题保存测试'));
  await page.evaluate(() => saveInspiration('釜山烤肉攻略 https://www.xiaohongshu.com/explore/browser-test', '釜山烤肉攻略'));
  assert.equal((await store.read('/inspirations', tripId)).data.length, 1);
  assert.equal(await page.locator('#inspirationList .inspiration-item').count(), 1);
  const sharedPage = await context.newPage();
  await sharedPage.goto(`http://127.0.0.1:${server.address().port}/?title=${encodeURIComponent('分享面板自动收集')}&url=${encodeURIComponent('https://www.xiaohongshu.com/explore/share-target-test')}#home`);
  await sharedPage.waitForFunction(() => document.querySelector('#inspirationList')?.textContent.includes('分享面板自动收集'));
  await sharedPage.waitForFunction(() => !JSON.parse(localStorage.getItem('kr_sync_queue_v2') || '[]').length);
  assert.equal((await store.read('/inspirations', tripId)).data.length, 2);
  await sharedPage.close();

  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#docsGrid .doc-card').length > 0);
  assert.equal((await page.evaluate(id => currentItinerary.some(item => item.id === id), itineraryId)), true);
  assert.equal(await page.getByText('跨设备美食收藏测试', { exact: true }).count(), 1);
  assert.equal((await page.evaluate(() => essayRecords.length)), 1);
  assert.deepEqual(errors, []);
  const visitorContext = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await visitorContext.addInitScript(() => {
    const session = { access_token: 'visitor-test-token', user: { id: 'visitor-user', is_anonymous: true } };
    window.cloudbase = { init: () => ({ auth: () => ({
      getSession: async () => ({ data: { session }, error: null }),
      signInWithPassword: async () => ({ data: { session }, error: null }),
      signInAnonymously: async () => ({ data: { session }, error: null }),
      signOut: async () => ({ error: null })
    }) }) };
  });
  await visitorContext.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.hostname === '127.0.0.1') return route.continue();
    const path = url.pathname.replace('/korea-api', '');
    if (!paths[path]) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    if (request.method() === 'POST') return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ success: false, error: '访客只能查看旅行资料，不能修改内容' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(await store.read(path, url.searchParams.get('tripId'))) });
  });
  const visitorPage = await visitorContext.newPage();
  await visitorPage.goto(`http://127.0.0.1:${server.address().port}/#food`);
  assert.equal(await visitorPage.locator('#authGate').isVisible(), true);
  await visitorPage.locator('#visitorSubmit').click();
  await visitorPage.waitForFunction(() => document.body.classList.contains('visitor-mode'));
  await visitorPage.evaluate(() => showTab('food', false));
  assert.equal(await visitorPage.locator('.food-add-btn:visible').count(), 0);
  assert.equal(await visitorPage.locator('#todoAdd:visible').count(), 0);
  assert.equal(await visitorPage.locator('#inspirationCollectBtn:visible').count(), 0);
  await assert.rejects(visitorPage.evaluate(() => apiPost('/todos', { items: [] })));
  await visitorContext.close();
  console.log('Browser phase: visitor sign-in displayed only read controls and client writes were rejected.');
  console.log('Browser passed: 11 tabs, all dynamic data families, stable IDs, encrypted essay, food/doc editing, deletion confirmation, rapid toggles, offline/IndexedDB recovery, polling and reload; no empty/duplicate render or page errors.');
} finally { await browser.close(); server.close(); }
