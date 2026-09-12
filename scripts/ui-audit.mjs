import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { memoryDb, paths } from './sync-fixtures.mjs';

const require = createRequire(import.meta.url);
const { createSyncStore } = require('../cloudfunctions/korea-api/sync-store.js');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/lu-sync-runtime/node_modules/playwright/index.mjs');
const root = resolve(new URL('..', import.meta.url).pathname);
const output = resolve(process.env.UI_AUDIT_DIR || 'artifacts/ui-audit');
await mkdir(output, { recursive: true });

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://local').pathname.replace(/\/$/, '/index.html');
    const path = resolve(root, '.' + pathname);
    if (!path.startsWith(root + '/')) throw new Error('outside root');
    const content = await readFile(path);
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' })[extname(path)] || 'application/octet-stream');
    res.end(content);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolveServer => server.listen(0, '127.0.0.1', resolveServer));

const tripId = 'korea-2026';
const store = createSyncStore(memoryDb({
  'kr_todos/a': { id: 'todo-a', title: '确认交通卡余额', note: '出发前一天提醒', done: false, tripId },
  'kr_checklist/a': { id: 'packing-a', text: '护照与银行卡', note: '放随身包', done: false, tripId },
  'kr_expenses/a': { clientId: 'expense-a', desc: 'KTX 车票', amount: 59800, currency: 'KRW', splitType: 'perPerson', people: ['可乐', '金鹿'], category: '交通', visibility: 'shared', tripId },
  'kr_inspirations/a': { id: 'idea-a', title: '小红书旅行灵感', category: 'todo', sourceUrl: 'https://www.xiaohongshu.com/explore/ui-audit', tripId, createdAt: 1 },
  'kr_docs/a': { id: 'food-a', kind: 'food', title: '南浦洞猪肉汤饭', city: 'busan', place: '釜山', note: '午餐备选', tripId },
  'kr_docs/b': { id: 'doc-a', kind: 'file', title: '旅行凭证示例', note: '站内预览', tripId }
}), paths);

function nameFor(value) { return String(value).replace(/[^a-z0-9_-]/gi, '-'); }
async function auditPage(page, name) {
  const issues = await page.evaluate(() => {
    const visible = element => {
      const style = getComputedStyle(element); const box = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
    };
    const problems = [];
    document.querySelectorAll('button, [role="button"]').forEach(button => {
      if (!visible(button)) return;
      const box = button.getBoundingClientRect();
      const label = (button.innerText || button.getAttribute('aria-label') || button.getAttribute('title') || '').trim();
      if (!label) problems.push(`empty control: ${button.outerHTML.slice(0, 100)}`);
      if (!button.closest('#bnav') && (box.left < -1 || box.right > innerWidth + 1)) problems.push(`horizontal overflow: ${label}`);
      if (box.width < 30 || box.height < 30) problems.push(`undersized control ${Math.round(box.width)}x${Math.round(box.height)}: ${label}`);
      if (button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1) problems.push(`clipped control label: ${label}`);
    });
    document.querySelectorAll('input, select, textarea').forEach(field => {
      if (!visible(field)) return;
      const box = field.getBoundingClientRect();
      if (box.height < 40) problems.push(`undersized field ${Math.round(box.height)}px: #${field.id || field.className}`);
      if (box.left < -1 || box.right > innerWidth + 1) problems.push(`field overflows horizontally: #${field.id || field.className}`);
    });
    if (document.scrollingElement.scrollWidth > innerWidth + 1) problems.push(`page overflows horizontally: ${document.scrollingElement.scrollWidth}px`);
    document.querySelectorAll('.seg, .food-actions, .list-sheet-actions, .it-actions, .trip-picker-actions, .doc-actions, .l-actions, .tl-tools, .inspiration-sheet-actions, #bnav').forEach(group => {
      const controls = [...group.children].filter(visible);
      controls.forEach((first, index) => controls.slice(index + 1).forEach(second => {
        const a = first.getBoundingClientRect(); const b = second.getBoundingClientRect();
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapX > 2 && overlapY > 2) problems.push(`overlapping sibling controls in .${group.className || group.id}`);
      }));
    });
    document.querySelectorAll('[role="dialog"].open, .panel.active').forEach(container => {
      if (!visible(container) || container.scrollWidth <= container.clientWidth + 1) return;
      problems.push(`container overflows horizontally: #${container.id}`);
    });
    return problems;
  });
  assert.deepEqual(issues, [], `${name}: ${issues.join('; ')}`);
  await page.screenshot({ path: resolve(output, `${nameFor(name)}.png`), fullPage: false, animations: 'disabled' });
}

async function runViewport(label, viewport) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.addInitScript(() => {
    const session = { access_token: 'ui-audit-token', user: { id: '2097823157655728129', is_anonymous: false } };
    window.cloudbase = { init: () => ({ auth: () => ({
      getSession: async () => ({ data: { session }, error: null }),
      signInWithPassword: async () => ({ data: { session }, error: null }),
      signInAnonymously: async () => ({ data: { session }, error: null }),
      signOut: async () => ({ error: null })
    }) }) };
  });
  await context.route('**/*', async route => {
    const request = route.request(); const url = new URL(request.url());
    if (url.hostname === '127.0.0.1') return route.continue();
    const path = url.pathname.replace('/korea-api', '');
    if (path === '/files/url') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, url: `https://private.example.test/download?file=${encodeURIComponent(url.searchParams.get('fileID'))}`, expiresAt: Date.now() + 840000 }) });
    if (!paths[path]) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    try {
      const data = request.method() === 'POST'
        ? await store.write(path, url.searchParams.get('tripId'), request.postDataJSON())
        : await store.read(path, url.searchParams.get('tripId'));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    } catch (error) { return route.fulfill({ status: error.status || 500, contentType: 'application/json', body: JSON.stringify({ error: error.message }) }); }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  try {
    await page.goto(`http://127.0.0.1:${server.address().port}/#home`);
    await page.waitForFunction(() => document.querySelector('#tab-home.active') && typeof showTab === 'function');
    await page.waitForTimeout(350);
    const tabs = ['home', 'itinerary', 'transport', 'map', 'food', 'essay', 'todos', 'packing', 'guide', 'docs', 'expenses'];
    for (const tab of tabs) {
      await page.evaluate(tabName => showTab(tabName, false), tab);
      await page.waitForTimeout(80);
      await auditPage(page, `${label}-${tab}`);
    }
    await page.evaluate(() => { showTab('home', false); document.documentElement.classList.add('standalone-mode'); });
    await page.waitForTimeout(80);
    await auditPage(page, `${label}-standalone-home`);
    await page.evaluate(() => document.documentElement.classList.remove('standalone-mode'));
    const windows = [
      ['expense-new', () => openSheet()],
      ['expense-edit', () => editExpense('expense-a')],
      ['itinerary-editor', () => openItSheet(1)],
      ['itinerary-row', () => openItSheet(1, null, true)],
      ['list-editor', () => openListSheet('todos', 'todo-a')],
      ['essay-editor', () => openEssaySheet()],
      ['trip-picker', () => openTripPicker()],
      ['trip-settings', () => openTripSettings(activeTrip())],
      ['image-viewer', () => openImageViewer('assets/photos/busan-watercolor.webp', '釜山图片预览')],
      ['document-viewer', () => openDocViewer({ title: '图片文件预览', attachmentUrl: 'assets/photos/busan-watercolor.webp', attachmentType: 'image/webp' })],
      ['food-editor', () => { showTab('food', false); document.querySelector('.food-add-btn[data-city="busan"]').click(); }],
      ['inspiration-editor', () => { showTab('home', false); openInspirationSheet({ sourceText: '首尔弘大烤肉攻略 https://www.xiaohongshu.com/explore/ui-audit', sourceUrl: 'https://www.xiaohongshu.com/explore/ui-audit' }); }]
    ];
    for (const [windowName, open] of windows) {
      await page.evaluate(open);
      await page.waitForTimeout(360);
      await auditPage(page, `${label}-${windowName}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(60);
      assert.equal(await page.locator('[role="dialog"].open').count(), 0, `${label}-${windowName}: Escape left a dialog open`);
    }
    assert.deepEqual(errors, [], `${label}: page errors: ${errors.join('; ')}`);
  } finally { await browser.close(); }
}

try {
  await runViewport('small-mobile', { width: 320, height: 667 });
  await runViewport('tablet', { width: 768, height: 1024 });
  await runViewport('mobile', { width: 390, height: 844 });
  await runViewport('desktop', { width: 1440, height: 1000 });
  console.log(`UI audit passed: 96 tab and dialog states captured in ${output}`);
} finally { server.close(); }
