const http = require('http');
const https = require('https');
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({
  env: 'hanoi-d4gj8vd2q1e7a3dc0',
  region: 'ap-shanghai'
});

const db = app.database();
const { createSyncStore } = require('./sync-store');
const { allowRead, visibleItems, protectPrivateWrite } = require('./privacy');
const SYNC_COLLECTIONS = {
  '/itinerary': 'kr_itinerary', '/todos': 'kr_todos', '/checklist': 'kr_checklist',
  '/bucket-list': 'kr_bucketlist', '/expenses': 'kr_expenses', '/docs': 'kr_docs', '/inspirations': 'kr_inspirations', '/trips': 'kr_trips'
};
const syncStore = createSyncStore(db, SYNC_COLLECTIONS);
const fileService = require('./files').createFileService(app);

const PORT = process.env.PORT || 9000;
const DEFAULT_TRIP_ID = 'korea-2026';
const MAX_BODY_BYTES = 6 * 1024 * 1024;
const WEATHER_CITIES = {
  busan: { latitude: 35.1796, longitude: 129.0756 },
  seoul: { latitude: 37.5665, longitude: 126.9780 }
};
const upstreamCache = new Map();

function fetchJson(url, timeoutMs = 4500) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { Accept: 'application/json' } }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => body += chunk);
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`upstream returned ${response.statusCode}`));
          return;
        }
        try { resolve(JSON.parse(body)); } catch { reject(new Error('upstream returned invalid JSON')); }
      });
    });
    request.setTimeout(timeoutMs, () => request.destroy(new Error('upstream timeout')));
    request.on('error', reject);
  });
}

async function fetchCachedJson(key, url, ttlMs) {
  const cached = upstreamCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const value = await fetchJson(url);
  upstreamCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

// 韩国项目使用 kr_ 前缀集合，与河内项目（itinerary/checklist/expenses）互不干扰
const COL = {
  itinerary: 'kr_itinerary',
  checklist: 'kr_checklist',
  expenses: 'kr_expenses',
  bucketList: 'kr_bucketlist',
  todos: 'kr_todos',
  docs: 'kr_docs',
  trips: 'kr_trips'
};

function json(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let tooLarge = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        body = '';
        return;
      }
      if (!tooLarge) body += chunk;
    });
    req.on('end', () => {
      if (tooLarge) {
        reject(Object.assign(new Error('保存内容超过 6MB，请减少附件后重试'), { status: 413 }));
        return;
      }
      try { resolve(JSON.parse(body || '{}')); } catch { reject(Object.assign(new Error('请求内容不是有效 JSON'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function tripIdFromUrl(url) {
  const tripId = String(url.searchParams.get('tripId') || DEFAULT_TRIP_ID).trim() || DEFAULT_TRIP_ID;
  if (tripId.length > 120 || !/^[\w:@.-]+$/u.test(tripId)) throw Object.assign(new Error('旅程 ID 无效'), { status: 400 });
  return tripId;
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
    // CloudBase's HTTP gateway owns CORS headers. Adding another origin here
    // creates an invalid combined header such as "site, *" in browsers.
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    // CloudBase's HTTP gateway may append a trailing slash to POST paths even
    // when the browser requested `/todos`. Normalize both forms so reads and
    // writes always reach the same versioned collection route.
    const route = url.pathname.replace(/\/+$/, '') || '/';
    const tripId = tripIdFromUrl(url);
    if (route === '/files/upload' && req.method === 'POST') {
      return json(res, await fileService.upload(await readBody(req), tripId));
    }
    if (route === '/files/url' && req.method === 'GET') {
      return json(res, await fileService.resolve(url.searchParams.get('fileID'), tripId));
    }
    // Keep weather and exchange-rate requests on the domestic CloudBase origin.
    if (route === '/weather' && req.method === 'GET') {
      const city = url.searchParams.get('city') || 'seoul';
      const coordinates = WEATHER_CITIES[city] || WEATHER_CITIES.seoul;
      const query = new URLSearchParams({
        latitude: String(coordinates.latitude),
        longitude: String(coordinates.longitude),
        current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max',
        hourly: 'temperature_2m,weather_code',
        timezone: 'Asia/Seoul',
        forecast_days: '10'
      });
      return json(res, await fetchCachedJson(`weather:${city}`, `https://api.open-meteo.com/v1/forecast?${query}`, 5 * 60 * 1000));
    }

    if (route === '/fx' && req.method === 'GET') {
      return json(res, await fetchCachedJson('fx:cny', 'https://open.er-api.com/v6/latest/CNY', 60 * 60 * 1000));
    }

    const collectionName = SYNC_COLLECTIONS[route];
    if (collectionName && req.method === 'GET') {
      allowRead(route);
      const result = await syncStore.read(route, tripId);
      return json(res, { ...result, data: visibleItems(route, result.data) });
    }
    if (collectionName && req.method === 'POST') {
      const body = await readBody(req);
      // The old implementation read tripId only from the URL, although the
      // browser sent it in the body: non-Korean saves could overwrite Korea.
      const writeTrip = String(body.tripId || tripId).trim();
      if (writeTrip.length > 120 || !/^[\w:@.-]+$/u.test(writeTrip)) throw Object.assign(new Error('旅程 ID 无效'), { status: 400 });
      if (!Array.isArray(body.items) || body.items.length > 5000) throw Object.assign(new Error('单次保存记录数量无效'), { status: 413 });
      const current = await syncStore.read(route, writeTrip);
      const items = protectPrivateWrite(route, body.items);
      const result = await syncStore.write(route, writeTrip, { ...body, items });
      return json(res, { ...result, data: visibleItems(route, result.data) });
    }
    if (req.method !== 'GET' && /^\/(records|todos|checklist|bucket-list)\//.test(route)) {
      return json(res, { success: false, error: '请刷新页面后再保存，当前版本已升级' }, 426);
    }

    // 404
    json(res, { success: false, error: 'Not found' }, 404);

  } catch (err) {
    json(res, { success: false, error: err.message, conflict: err.status === 409 }, err.status || 500);
  }
});

server.listen(PORT, () => {
  console.log(`korea-api server running on port ${PORT}`);
});
