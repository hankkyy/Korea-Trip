const http = require('http');
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({
  env: 'hanoi-d4gj8vd2q1e7a3dc0',
  region: 'ap-shanghai'
});

const db = app.database();

const PORT = process.env.PORT || 9000;

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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = url.pathname;

  try {
    // GET /itinerary
    if (route === '/itinerary' && req.method === 'GET') {
      const result = await db.collection(COL.itinerary)
        .orderBy('day', 'asc')
        .orderBy('sortOrder', 'asc')
        .limit(100)
        .get();
      return json(res, { success: true, data: result.data });
    }

    // POST /itinerary (batch save: replace all)
    if (route === '/itinerary' && req.method === 'POST') {
      const { items } = await readBody(req);
      if (!Array.isArray(items)) {
        return json(res, { success: false, error: 'items must be an array' }, 400);
      }

      const existing = await db.collection(COL.itinerary).get();
      const removeTasks = existing.data.map(doc => db.collection(COL.itinerary).doc(doc._id).remove());
      await Promise.all(removeTasks);

      if (items.length > 0) {
        const addTasks = items.map(item => db.collection(COL.itinerary).add({ ...item, updatedAt: Date.now() }));
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
      return json(res, { success: true, data: result.data });
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
      return json(res, { success: true, data: result.data });
    }

    // POST /todos (batch save: replace all)
    if (route === '/todos' && req.method === 'POST') {
      const { items } = await readBody(req);
      if (!Array.isArray(items)) {
        return json(res, { success: false, error: 'items must be an array' }, 400);
      }

      const existing = await db.collection(COL.todos).get();
      const removeTasks = existing.data.map(doc => db.collection(COL.todos).doc(doc._id).remove());
      await Promise.all(removeTasks);

      if (items.length > 0) {
        const addTasks = items.map((item, idx) => db.collection(COL.todos).add({
          id: item.id || `todo-${idx + 1}`,
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
      return json(res, { success: true, data: result.data });
    }

    // POST /checklist (batch save: replace all)
    if (route === '/checklist' && req.method === 'POST') {
      const { items } = await readBody(req);
      if (!Array.isArray(items)) {
        return json(res, { success: false, error: 'items must be an array' }, 400);
      }

      const existing = await db.collection(COL.checklist).get();
      const removeTasks = existing.data.map(doc => db.collection(COL.checklist).doc(doc._id).remove());
      await Promise.all(removeTasks);

      if (items.length > 0) {
        const addTasks = items.map((item, idx) => db.collection(COL.checklist).add({
          id: item.id || `cl-${idx + 1}`,
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
        .limit(50)
        .get();
      return json(res, { success: true, data: result.data });
    }

    // POST /docs (batch save: replace all)
    if (route === '/docs' && req.method === 'POST') {
      const { items } = await readBody(req);
      if (!Array.isArray(items)) {
        return json(res, { success: false, error: 'items must be an array' }, 400);
      }

      const existing = await db.collection(COL.docs).get();
      const removeTasks = existing.data.map(doc => db.collection(COL.docs).doc(doc._id).remove());
      await Promise.all(removeTasks);

      if (items.length > 0) {
        const addTasks = items.map((item, idx) => db.collection(COL.docs).add({
          ...item,
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
      return json(res, { success: true, data: result.data });
    }

    // POST /expenses (batch save: replace all)
    if (route === '/expenses' && req.method === 'POST') {
      const { items } = await readBody(req);

      // Remove all existing
      const existing = await db.collection(COL.expenses).get();
      const removeTasks = existing.data.map(doc =>
        db.collection(COL.expenses).doc(doc._id).remove()
      );
      await Promise.all(removeTasks);

      // Insert new ones
      if (items && items.length > 0) {
        const addTasks = items.map(item =>
          db.collection(COL.expenses).add({ ...item, createdAt: Date.now() })
        );
        await Promise.all(addTasks);
      }

      return json(res, { success: true, count: items ? items.length : 0 });
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
