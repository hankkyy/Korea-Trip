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
  'kr_checklist/a': { id: 'cl-a', text: '测试行李', done: false, tripId },
  'kr_docs/a': { id: 'doc-a', kind: 'file', title: '测试文件', note: '浏览器回归', tripId }
});
const store = createSyncStore(db, paths);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const viewport = process.env.DESKTOP_VIEWPORT ? { width: 1440, height: 1000 } : { width: 390, height: 844 };
const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
const errors = []; let offline = false;
await context.route('**/*', async route => {
  const request = route.request(); const url = new URL(request.url());
  if (url.hostname === '127.0.0.1') return route.continue();
  const path = url.pathname.replace('/korea-api', '');
  if (path === '/files/url') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, url: `https://private.example.test/download?file=${encodeURIComponent(url.searchParams.get('fileID'))}`, expiresAt: Date.now() + 840000 }) });
  if (!paths[path]) return route.fulfill({ status: 200, contentType: url.pathname.endsWith('.js') ? 'text/javascript' : 'application/json', body: '{}' });
  assert.equal(request.headers().authorization, undefined);
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
page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
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
  assert.equal(await foodCard.locator('.food-actions .food-btn:visible').count(), 3);
  const actionHeights = await foodCard.locator('.food-actions .food-btn:visible').evaluateAll(buttons => buttons.map(button => Math.round(button.getBoundingClientRect().height)));
  assert.equal(new Set(actionHeights).size, 1);
  await foodCard.locator('[data-act="title"]').fill('跨设备美食收藏测试');
  if (process.env.SCREENSHOT_PATH) await page.locator('.food-collections').screenshot({ path: process.env.SCREENSHOT_PATH });
  await foodCard.locator('[data-act="title"]').press('Tab');
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('kr_sync_queue_v2') || '[]').length);
  assert((await store.read('/docs', tripId)).data.some(item => item.kind === 'food' && item.title === '跨设备美食收藏测试'));
  await foodCard.locator('[data-act="edit"]').click();
  assert.equal(await foodCard.evaluate(card => card.classList.contains('editing')), false);
  assert.equal(await foodCard.locator('.food-actions .food-btn:visible').count(), 1);
  assert.equal(await foodCard.locator('[data-act="delete"]:visible').count(), 0);
  assert.equal(await foodCard.locator('[data-act="photo"]:visible').count(), 0);
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
  assert.equal(await page.evaluate(() => docAttachmentUrl({ attachmentUrl: '/assets/docs/visa/携程英文版机票行程单.pdf' })), 'cloud://hanoi-d4gj8vd2q1e7a3dc0.6861-hanoi-d4gj8vd2q1e7a3dc0-1448781892/private/korea/visa/携程英文版机票行程单.pdf');
  await page.evaluate(() => openDocViewer({ title: '旧文件私有链接迁移', attachmentUrl: '/assets/docs/visa/携程英文版机票行程单.pdf', attachmentType: 'pdf' }));
  await page.waitForFunction(() => document.querySelector('#docViewerFrame')?.src.includes('private.example.test/download'));
  assert.match(await page.locator('#docViewerFrame').getAttribute('src'), /private\.example\.test\/download/);
  await page.evaluate(() => closeDocViewer());
  const firstDoc = page.locator('#docsGrid .doc-card').first();
  await firstDoc.locator('[data-act="edit"]').click();
  await firstDoc.locator('[data-act="title"]').fill('文件标题保存测试');
  await firstDoc.locator('[data-act="edit"]').click();
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('kr_sync_queue_v2') || '[]').length);
  assert((await store.read('/docs', tripId)).data.some(item => item.kind === 'file' && item.title === '文件标题保存测试'));
  assert.equal(await page.evaluate(() => inspirationTitleFromText('Hi Zihao,\n看看【首尔弘大烤肉必吃清单】\nhttps://www.xiaohongshu.com/explore/title-test')), '首尔弘大烤肉必吃清单');
  await page.evaluate(() => showTab('home', false));
  await page.locator('#inspirationCollectBtn').click();
  await page.waitForFunction(() => document.querySelector('#inspirationSheet')?.classList.contains('open'));
  assert.equal(await page.locator('#inspirationCoverDraft').count(), 0);
  assert.equal(await page.locator('.inspiration-capture').count(), 0);
  await page.locator('#inspirationTitleInput').fill('釜山烤肉攻略');
  await page.locator('#inspirationUrlInput').fill('https://www.xiaohongshu.com/explore/browser-test');
  await page.locator('#inspirationSaveBtn').click();
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('kr_sync_queue_v2') || '[]').length);
  assert.equal((await store.read('/inspirations', tripId)).data.length, 1);
  assert.equal(await page.locator('#inspirationList .inspiration-item').count(), 1);
  assert.equal(await page.locator('#inspirationList .inspiration-item').getByText('小红书 ↗').count(), 0);
  await page.locator('[data-idea-edit]').click();
  await page.locator('#inspirationTitleInput').fill('釜山烤肉晚餐备选');
  await page.locator('#inspirationCategoryInput').selectOption('food');
  await page.locator('#inspirationPlaceInput').fill('釜山 · 西面');
  await page.locator('#inspirationNoteInput').fill('留给 12/29 晚餐。');
  await page.locator('#inspirationSaveBtn').click();
  await page.waitForFunction(() => !JSON.parse(localStorage.getItem('kr_sync_queue_v2') || '[]').length);
  const editedIdea = (await store.read('/inspirations', tripId)).data.find(item => item.title === '釜山烤肉晚餐备选');
  assert.equal(editedIdea.place, '釜山 · 西面');
  assert.equal(editedIdea.note, '留给 12/29 晚餐。');
  const sharedPage = await context.newPage();
  await sharedPage.goto(`http://127.0.0.1:${server.address().port}/?title=${encodeURIComponent('分享面板自动收集')}&url=${encodeURIComponent('https://www.xiaohongshu.com/explore/share-target-test')}#home`);
  await sharedPage.waitForFunction(() => document.querySelector('#inspirationSheet')?.classList.contains('open'));
  assert.equal(await sharedPage.locator('#inspirationTitleInput').inputValue(), '分享面板自动收集');
  await sharedPage.locator('#inspirationSaveBtn').click();
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
  assert.equal(await page.locator('#authGate').count(), 0);
  assert.equal(await page.evaluate(() => accessRole), 'owner');
  await page.evaluate(() => showTab('food', false));
  assert((await page.locator('.food-add-btn:visible').count()) > 0);
  assert.equal(await page.locator('#todoAdd').count(), 1);
  assert.equal(await page.locator('#inspirationCollectBtn').count(), 1);
  console.log('Browser phase: public shared workspace opened without an account or authorization header.');
  console.log('Browser passed: 11 tabs, all dynamic data families, stable IDs, encrypted essay, food/doc editing, deletion confirmation, rapid toggles, offline/IndexedDB recovery, polling and reload; no empty/duplicate render or page errors.');
} finally { await browser.close(); server.close(); }
