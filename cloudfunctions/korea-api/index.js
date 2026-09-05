const http = require('http');
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({
  env: 'hanoi-d4gj8vd2q1e7a3dc0',
  region: 'ap-shanghai'
});

const db = app.database();

const PORT = process.env.PORT || 9000;
const DEFAULT_TRIP_ID = 'korea-2026';

// 韩国项目使用 kr_ 前缀集合，与河内项目（itinerary/checklist/expenses）互不干扰
const COL = {
  itinerary: 'kr_itinerary',
  checklist: 'kr_checklist',
  expenses: 'kr_expenses',
  bucketList: 'kr_bucketlist',
  todos: 'kr_todos',
  docs: 'kr_docs'
};

function json(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

function tripIdFromUrl(url) {
  return String(url.searchParams.get('tripId') || DEFAULT_TRIP_ID).trim() || DEFAULT_TRIP_ID;
}

function belongsToTrip(item, tripId) {
  return (item.tripId || DEFAULT_TRIP_ID) === tripId;
}

function scopedItems(items, tripId) {
  return items.filter((item) => belongsToTrip(item, tripId));
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = url.pathname;
  const tripId = tripIdFromUrl(url);

  try {
    // GET /itinerary
    if (route === '/itinerary' && req.method === 'GET') {
      const result = await db.collection(COL.itinerary)
        .orderBy('day', 'asc')
        .orderBy('sortOrder', 'asc')
        .limit(100)
        .get();
      return json(res, { success: true, data: scopedItems(result.data, tripId) });
    }

    // POST /itinerary (batch save: replace all)
    if (route === '/itinerary' && req.method === 'POST') {
      const { items } = await readBody(req);
      if (!Array.isArray(items)) {
        return json(res, { success: false, error: 'items must be an array' }, 400);
      }

      const existing = await db.collection(COL.itinerary).get();
      const removeTasks = scopedItems(existing.data, tripId).map(doc => db.collection(COL.itinerary).doc(doc._id).remove());
      await Promise.all(removeTasks);

      if (items.length > 0) {
        const addTasks = items.map(item => db.collection(COL.itinerary).add({ ...item, tripId, updatedAt: Date.now() }));
        await Promise.all(addTasks);
      }

      return json(res, { success: true, count: items.length });
    }

    // GET /bucket-list
    if (route === '/bucket-list' && req.method === 'GET') {
      const result = await db.collection(COL.bucketList)
        .orderBy('id', 'asc')
        .limit(50)
        .get();
      return json(res, { success: true, data: scopedItems(result.data, tripId) });
    }

    // POST /bucket-list/:docId
    let match = route.match(/^\/bucket-list\/(.+)$/);
    if (match && req.method === 'POST') {
      const docId = match[1];
      const { done } = await readBody(req);
      const result = await db.collection(COL.bucketList).doc(docId).update({ done });
      return json(res, { success: true, updated: result.updated });
    }

    // GET /todos（预订待办）
    if (route === '/todos' && req.method === 'GET') {
      const result = await db.collection(COL.todos)
        .orderBy('sortOrder', 'asc')
        .limit(50)
        .get();
      return json(res, { success: true, data: scopedItems(result.data, tripId) });
    }

    // POST /todos (batch save: replace all)
    if (route === '/todos' && req.method === 'POST') {
      const { items } = await readBody(req);
      if (!Array.isArray(items)) {
        return json(res, { success: false, error: 'items must be an array' }, 400);
      }

      const existing = await db.collection(COL.todos).get();
      const removeTasks = scopedItems(existing.data, tripId).map(doc => db.collection(COL.todos).doc(doc._id).remove());
      await Promise.all(removeTasks);

      if (items.length > 0) {
        const addTasks = items.map((item, idx) => db.collection(COL.todos).add({
          id: item.id || `todo-${idx + 1}`,
          tripId,
          sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : idx + 1,
          emoji: item.emoji || '📋',
          title: item.title || '新待办',
          note: item.note || '',
          done: Boolean(item.done),
          updatedAt: Date.now()
        }));
        await Promise.all(addTasks);
      }

      return json(res, { success: true, count: items.length });
    }

    // POST /todos/:docId
    match = route.match(/^\/todos\/(.+)$/);
    if (match && req.method === 'POST') {
      const docId = match[1];
      const { done } = await readBody(req);
      const result = await db.collection(COL.todos).doc(docId).update({ done });
      return json(res, { success: true, updated: result.updated });
    }

    // GET /checklist
    if (route === '/checklist' && req.method === 'GET') {
      const result = await db.collection(COL.checklist)
        .orderBy('sortOrder', 'asc')
        .limit(30)
        .get();
      return json(res, { success: true, data: scopedItems(result.data, tripId) });
    }

    // POST /checklist (batch save: replace all)
    if (route === '/checklist' && req.method === 'POST') {
      const { items } = await readBody(req);
      if (!Array.isArray(items)) {
        return json(res, { success: false, error: 'items must be an array' }, 400);
      }

      const existing = await db.collection(COL.checklist).get();
      const removeTasks = scopedItems(existing.data, tripId).map(doc => db.collection(COL.checklist).doc(doc._id).remove());
      await Promise.all(removeTasks);

      if (items.length > 0) {
        const addTasks = items.map((item, idx) => db.collection(COL.checklist).add({
          id: item.id || `cl-${idx + 1}`,
          tripId,
          sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : idx + 1,
          text: item.text || '新行李',
          note: item.note || '',
          done: Boolean(item.done),
          updatedAt: Date.now()
        }));
        await Promise.all(addTasks);
      }

      return json(res, { success: true, count: items.length });
    }

    // POST /checklist/:docId
    match = route.match(/^\/checklist\/(.+)$/);
    if (match && req.method === 'POST') {
      const docId = match[1];
      const { done } = await readBody(req);
      const result = await db.collection(COL.checklist).doc(docId).update({ done });
      return json(res, { success: true, updated: result.updated });
    }

    // GET /docs（文件资料：状态、备注、压缩照片）
    if (route === '/docs' && req.method === 'GET') {
      const result = await db.collection(COL.docs)
        .orderBy('sortOrder', 'asc')
        .limit(200)
        .get();
      return json(res, { success: true, data: scopedItems(result.data, tripId) });
    }

    // POST /docs (batch save: replace all)
    if (route === '/docs' && req.method === 'POST') {
      const { items } = await readBody(req);
      if (!Array.isArray(items)) {
        return json(res, { success: false, error: 'items must be an array' }, 400);
      }

      const existing = await db.collection(COL.docs).get();
      const removeTasks = scopedItems(existing.data, tripId).map(doc => db.collection(COL.docs).doc(doc._id).remove());
      await Promise.all(removeTasks);

      if (items.length > 0) {
        const addTasks = items.map((item, idx) => db.collection(COL.docs).add({
          ...item,
          tripId,
          sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : idx + 1,
          updatedAt: Date.now()
        }));
        await Promise.all(addTasks);
      }

      return json(res, { success: true, count: items.length });
    }

    // GET /expenses
    if (route === '/expenses' && req.method === 'GET') {
      const result = await db.collection(COL.expenses)
        .orderBy('createdAt', 'asc')
        .limit(200)
        .get();
      return json(res, { success: true, data: scopedItems(result.data, tripId) });
    }

    // POST /expenses (batch save: replace all)
    if (route === '/expenses' && req.method === 'POST') {
      const { items } = await readBody(req);

      // Replace only the current trip, preserving other trips in the shared collection.
      const existing = await db.collection(COL.expenses).get();
      const removeTasks = scopedItems(existing.data, tripId).map(doc =>
        db.collection(COL.expenses).doc(doc._id).remove()
      );
      await Promise.all(removeTasks);

      // Insert new ones
      if (items && items.length > 0) {
        const addTasks = items.map(item =>
          db.collection(COL.expenses).add({ ...item, tripId, createdAt: Date.now() })
        );
        await Promise.all(addTasks);
      }

      return json(res, { success: true, count: items ? items.length : 0 });
    }

    // 单条同步接口：为逐步替换批量保存保留稳定的 tripId 和乐观版本检查。
    const recordMatch = route.match(/^\/records\/(itinerary|todos|checklist|bucket-list|expenses|docs)\/([^/]+)$/);
    if (recordMatch && (req.method === 'POST' || req.method === 'DELETE')) {
      const collectionName = {
        itinerary: COL.itinerary,
        todos: COL.todos,
        checklist: COL.checklist,
        'bucket-list': COL.bucketList,
        expenses: COL.expenses,
        docs: COL.docs
      }[recordMatch[1]];
      const docId = decodeURIComponent(recordMatch[2]);
      const ref = db.collection(collectionName).doc(docId);
      const current = await ref.get();
      const existing = current.data;
      if (!existing || !belongsToTrip(existing, tripId)) return json(res, { success: false, error: 'record not found' }, 404);

      if (req.method === 'DELETE') {
        await ref.remove();
        return json(res, { success: true, deleted: docId });
      }

      const body = await readBody(req);
      if (body.baseUpdatedAt != null && Number(body.baseUpdatedAt) !== Number(existing.updatedAt || 0)) {
        return json(res, { success: false, conflict: true, error: 'record changed on another device', data: existing }, 409);
      }
      const updates = { ...(body.data || body) };
      delete updates.tripId;
      delete updates._id;
      delete updates.baseUpdatedAt;
      updates.updatedAt = Date.now();
      await ref.update(updates);
      return json(res, { success: true, data: { ...existing, ...updates } });
    }

    // 404
    json(res, { success: false, error: 'Not found' }, 404);

  } catch (err) {
    json(res, { success: false, error: err.message }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`korea-api server running on port ${PORT}`);
});
