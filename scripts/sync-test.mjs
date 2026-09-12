import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { memoryDb, paths } from './sync-fixtures.mjs';
const require = createRequire(import.meta.url);
const { createSyncStore } = require('../cloudfunctions/korea-api/sync-store.js');
const { createSyncClient } = require('../assets/sync-client.js');
const { allowRead, visibleItems, protectPrivateWrite } = require('../cloudfunctions/korea-api/privacy.js');
function storage() { const data = new Map(); return { getItem: key => data.get(key) || null, setItem: (key, value) => data.set(key, value), keys: () => data.keys() }; }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
export function fetchFor(store, hook = async () => {}) {
  return async (input, init = {}) => {
    const url = new URL(input); const body = init.body && JSON.parse(init.body);
    await hook(body, url);
    try {
      const result = body ? await store.write(url.pathname, url.searchParams.get('tripId'), body) : await store.read(url.pathname, url.searchParams.get('tripId'));
      return { ok: true, json: async () => result };
    } catch (error) { return { ok: false, status: error.status || 500, json: async () => ({ success: false, error: error.message }) }; }
  };
}
const createClient = (fetcher, disk = storage()) => createSyncClient({ storage: disk, fetcher, baseUrl: 'https://sync.test' });
test('inline scripts parse', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]);
});
test('migration reads all pages, deduplicates logical IDs, preserves same-name distinct expenses', async () => {
  const seed = {};
  for (let i = 0; i < 250; i++) seed[`kr_todos/${i}`] = { id: `todo-${i % 50}`, tripId: 'korea', title: 'same', updatedAt: i };
  seed['kr_expenses/a'] = { clientId: 'a', tripId: 'korea', desc: 'food', amount: 10 };
  seed['kr_expenses/b'] = { clientId: 'b', tripId: 'korea', desc: 'food', amount: 10 };
  const store = createSyncStore(memoryDb(seed), paths);
  assert.equal((await store.read('/todos', 'korea')).data.length, 50);
  assert.equal((await store.read('/expenses', 'korea')).data.length, 2);
});
test('atomic publication, retries, stale writes, legitimate empty list and trip isolation', async () => {
  const store = createSyncStore(memoryDb(), paths);
  await store.read('/todos', 'korea');
  const body = { protocol: 2, baseRevision: 1, mutationId: 'one', items: [{ id: 'a', title: 'one' }] };
  const writes = await Promise.all(Array.from({ length: 8 }, () => store.write('/todos', 'korea', body)));
  assert(writes.every(result => result.revision === 2));
  assert.equal((await store.read('/todos', 'korea')).data.length, 1);
  assert.equal((await store.write('/todos', 'korea', { ...body, mutationId: 'stale' })).revision, 2);
  await store.write('/todos', 'korea', { ...body, baseRevision: 2, mutationId: 'empty', items: [] });
  assert.deepEqual((await store.read('/todos', 'korea')).data, []);
  const duplicate = await store.write('/todos', 'korea', body);
  assert.equal(duplicate.revision, 3);
  assert.deepEqual(duplicate.data, []);
  assert.deepEqual((await store.read('/todos', 'hong-kong')).data, []);
  await assert.rejects(store.write('/todos', 'korea', { items: [] }), { status: 426 });
});
test('rapid edits coalesce before upload and concurrent flushes retain the newest edit', async () => {
  const store = createSyncStore(memoryDb(), paths); const gate = deferred(); let posts = 0;
  const client = createClient(fetchFor(store, async body => { if (body && ++posts === 1) await gate.promise; }));
  await client.read('/todos', 'korea');
  const first = client.write('/todos', 'korea', [{ id: 'a', done: false }]);
  const second = client.write('/todos', 'korea', [{ id: 'a', done: true }]);
  const flushes = Array.from({ length: 8 }, () => client.flush());
  assert.equal(await client.read('/todos', 'korea'), null);
  gate.resolve(); await Promise.all([first, second, ...flushes]);
  assert.equal(posts, 1);
  assert.equal(client.pending('/todos', 'korea'), undefined);
  assert.equal((await store.read('/todos', 'korea')).data[0].done, true);
});
test('lost response followed by reload/new edit retries original mutation without duplication', async () => {
  const store = createSyncStore(memoryDb(), paths); const disk = storage(); let lost = true;
  const fetcher = fetchFor(store);
  const firstClient = createClient(async (url, init) => {
    const response = await fetcher(url, init);
    if (init.body && lost) { lost = false; throw new Error('response lost'); }
    return response;
  }, disk);
  await firstClient.read('/expenses', 'korea');
  await firstClient.write('/expenses', 'korea', [{ clientId: 'a', amount: 1 }]);
  const secondClient = createClient(fetcher, disk);
  const recovered = await secondClient.write('/expenses', 'korea', [{ clientId: 'a', amount: 2 }]);
  assert.equal(recovered.data[0].amount, 2);
  assert.equal(secondClient.pending('/expenses', 'korea'), undefined);
  const saved = await store.read('/expenses', 'korea');
  assert.equal(saved.data.length, 1); assert.equal(saved.data[0].amount, 2);
});
test('read started before edit cannot overwrite saved edit', async () => {
  const store = createSyncStore(memoryDb(), paths); const gate = deferred(); let delay = false;
  const fetcher = fetchFor(store);
  const client = createClient(async (url, init) => {
    const response = await fetcher(url, init);
    if (!init.body && delay) await gate.promise;
    return response;
  });
  await client.read('/todos', 'korea'); delay = true;
  const stale = client.read('/todos', 'korea');
  await client.write('/todos', 'korea', [{ id: 'a', done: true }]);
  gate.resolve(); assert.equal(await stale, null);
});
test('two devices automatically merge changes to different records', async () => {
  const store = createSyncStore(memoryDb(), paths); const fetcher = fetchFor(store);
  const a = createClient(fetcher), b = createClient(fetcher);
  await Promise.all([a.read('/expenses', 'korea'), b.read('/expenses', 'korea')]);
  await a.write('/expenses', 'korea', [{ clientId: 'a', amount: 1 }]);
  const merged = await b.write('/expenses', 'korea', [{ clientId: 'b', amount: 2 }]);
  assert.equal(merged.conflict, false);
  assert.deepEqual(new Set(merged.data.map(item => item.clientId)), new Set(['a', 'b']));
  assert.equal(b.pending('/expenses', 'korea'), undefined);
  const nextItems = merged.data.map(item => item.clientId === 'b' ? { ...item, amount: 3 } : item);
  await b.write('/expenses', 'korea', nextItems);
  assert.deepEqual(new Set((await store.read('/expenses', 'korea')).data.map(item => item.clientId)), new Set(['a', 'b']));
  assert.equal((await store.read('/expenses', 'korea')).data.find(item => item.clientId === 'b').amount, 3);
});
test('two devices automatically resolve a genuine same-record conflict', async () => {
  const store = createSyncStore(memoryDb({ 'kr_expenses/a': { clientId: 'a', amount: 1, tripId: 'korea' } }), paths); const fetcher = fetchFor(store);
  const a = createClient(fetcher), b = createClient(fetcher);
  await Promise.all([a.read('/expenses', 'korea'), b.read('/expenses', 'korea')]);
  await a.write('/expenses', 'korea', [{ clientId: 'a', amount: 2 }]);
  const result = await b.write('/expenses', 'korea', [{ clientId: 'a', amount: 3 }]);
  assert.equal(result.conflict, false);
  assert.equal(b.pending('/expenses', 'korea'), undefined);
  assert.equal((await store.read('/expenses', 'korea')).data[0].amount, 3);
});
test('same-origin tabs keep independent baselines and merge different records', async () => {
  const store = createSyncStore(memoryDb(), paths); const fetcher = fetchFor(store); const disk = storage();
  const a = createClient(fetcher, disk), b = createClient(fetcher, disk);
  await Promise.all([a.read('/todos', 'korea'), b.read('/todos', 'korea')]);
  await a.write('/todos', 'korea', [{ id: 'a', done: true }]);
  assert.equal((await b.write('/todos', 'korea', [{ id: 'b', done: true }])).conflict, false);
  assert.deepEqual(new Set((await store.read('/todos', 'korea')).data.map(item => item.id)), new Set(['a', 'b']));
});
test('corrupt local sync state is quarantined instead of preventing startup', async () => {
  const disk = storage();
  disk.setItem('kr_sync_queue_v2', '{broken');
  const store = createSyncStore(memoryDb(), paths);
  const client = createClient(fetchFor(store), disk);
  assert.deepEqual(await client.read('/todos', 'korea'), []);
  assert.equal([...disk.keys()].some(key => key.startsWith('kr_sync_queue_v2_corrupt_')), true);
});
test('all visitors receive the same data and writes become shared', () => {
  assert.doesNotThrow(() => allowRead('/itinerary'));
  assert.doesNotThrow(() => allowRead('/docs'));
  const records = [
    { clientId: 'shared', visibility: 'shared' },
    { clientId: 'old-private', visibility: 'private', ownerId: 'old-user' }
  ];
  assert.deepEqual(visibleItems('/expenses', records).map(item => item.clientId), ['shared', 'old-private']);
  const saved = protectPrivateWrite('/expenses', records);
  assert.deepEqual(saved, [
    { clientId: 'shared', visibility: 'shared' },
    { clientId: 'old-private', visibility: 'shared' }
  ]);
});
test('a refresh not displayed must not advance the edit baseline', async () => {
  const store = createSyncStore(memoryDb(), paths), fetcher = fetchFor(store);
  const a = createClient(fetcher), b = createClient(fetcher);
  await a.read('/todos', 'korea'); await b.read('/todos', 'korea');
  await a.write('/todos', 'korea', [{ id: 'a', done: true }]);
  assert.equal(await b.read('/todos', 'korea', () => false), null);
  await b.write('/todos', 'korea', [{ id: 'b', done: true }]);
  assert.equal((await store.read('/todos', 'korea')).data.length, 2);
});
test('edits queued during merged response retain remote additions', async () => {
  const store = createSyncStore(memoryDb(), paths), fetcher = fetchFor(store), gate = deferred(), started = deferred();
  const a = createClient(fetcher);
  let delay = true;
  const b = createClient(async (url, init) => {
    const response = await fetcher(url, init);
    if (init.body && delay) { delay = false; started.resolve(); await gate.promise; }
    return response;
  });
  await a.read('/todos', 'korea'); await b.read('/todos', 'korea');
  await a.write('/todos', 'korea', [{ id: 'a', done: true }]);
  const first = b.write('/todos', 'korea', [{ id: 'b', done: false }]);
  await started.promise;
  const second = b.write('/todos', 'korea', [{ id: 'b', done: true }]);
  await b.settled(); gate.resolve(); await Promise.all([first, second]);
  const items = (await store.read('/todos', 'korea')).data;
  assert.equal(items.length, 2); assert.equal(items.find(item => item.id === 'b').done, true);
});
test('shared-origin offline queues survive writes from both tabs', async () => {
  const store = createSyncStore(memoryDb(), paths), disk = storage(), fetcher = fetchFor(store);
  let online = true;
  const make = () => createSyncClient({ storage: disk, fetcher, baseUrl: 'https://sync.test', online: () => online });
  const a = make(), b = make();
  await a.read('/todos', 'korea'); await b.read('/docs', 'korea'); online = false;
  await a.write('/todos', 'korea', [{ id: 'a' }]); await b.write('/docs', 'korea', [{ id: 'b' }]);
  assert.equal(a.queue().length, 2); online = true; await a.flush();
  assert.equal((await store.read('/todos', 'korea')).data.length, 1);
  assert.equal((await store.read('/docs', 'korea')).data.length, 1);
});
test('storage failure never reports a durable successful save', async () => {
  const store = createSyncStore(memoryDb(), paths);
  const client = createClient(fetchFor(store), { getItem: () => null, setItem: () => { throw new Error('quota'); } });
  await client.read('/todos', 'korea');
  await assert.rejects(client.write('/todos', 'korea', [{ id: 'a' }]), /存储不可用/);
  assert.equal(client.queue().length, 1);
  assert.deepEqual((await store.read('/todos', 'korea')).data, []);
});
test('public files preserve stable upload IDs and reject cross-trip paths', async () => {
  const { createFileService, ROOT } = require('../cloudfunctions/korea-api/files.js');
  const saved = new Map();
  const files = createFileService({
    uploadFile: async ({ cloudPath, fileContent }) => { saved.set(cloudPath, fileContent); return { fileID: ROOT + cloudPath }; },
    getTempFileURL: async ({ fileList }) => ({ fileList: fileList.map(item => ({ fileID: item.fileID, tempFileURL: 'https://signed.test/file', code: 'SUCCESS' })) })
  });
  const body = { mime: 'application/pdf', base64: Buffer.from('%PDF-1.4 test').toString('base64') };
  const uploaded = await files.upload(body, 'korea-2026');
  assert.equal(uploaded.fileID, (await files.upload(body, 'korea-2026')).fileID);
  assert.equal(saved.size, 1);
  assert.equal((await files.resolve(uploaded.fileID, 'korea-2026')).success, true);
  await assert.rejects(files.resolve(uploaded.fileID, 'hong-kong'), { status: 403 });
  await assert.rejects(files.upload({ ...body, mime: 'text/html' }, 'korea-2026'), { status: 400 });
  await assert.rejects(files.resolve(ROOT + 'private/shared/korea-2026/../secret.pdf', 'korea-2026'), { status: 403 });
});
