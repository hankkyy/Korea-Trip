(function (root) {
  'use strict';
  function createSyncClient({ storage, fetcher, baseUrl, onStatus = () => {}, online = () => true }) {
    const queueKey = 'kr_sync_queue_v2';
    const stateKey = 'kr_sync_revisions_v2';
    let flushing = null;
    const writeResults = new Map();
    const epochs = new Map();
    const knownRevisions = new Map();
    const memory = new Map();
    let durableWrites = Promise.resolve();
    const owner = root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const key = (path, tripId) => `${path}::${path === '/trips' ? 'global' : tripId}`;
    const dbPromise = root.indexedDB ? new Promise((resolve, reject) => {
      const request = root.indexedDB.open('lu-travel-sync', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('state');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(() => null) : Promise.resolve(null);
    async function durableGet(name) {
      const db = await dbPromise;
      if (!db) return null;
      return new Promise(resolve => {
        const request = db.transaction('state').objectStore('state').get(name);
        request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
        request.onerror = () => resolve(null);
      });
    }
    async function durablePut(name, raw) {
      const db = await dbPromise;
      if (!db) return;
      await new Promise(resolve => {
        const transaction = db.transaction('state', 'readwrite');
        transaction.objectStore('state').put(raw, name);
        transaction.oncomplete = transaction.onerror = transaction.onabort = () => resolve();
      });
    }
    const load = (name, fallback) => {
      const raw = memory.has(name) ? memory.get(name) : storage.getItem(name);
      if (!raw) return fallback;
      try { return JSON.parse(raw); }
      catch {
        try { storage.setItem(`${name}_corrupt_${Date.now()}`, raw); } catch {}
        return fallback;
      }
    };
    const save = (name, data) => {
      const raw = JSON.stringify(data);
      memory.set(name, raw);
      try { storage.setItem(name, raw); } catch {}
      durableWrites = durableWrites.then(() => durablePut(name, raw));
      return durableWrites;
    };
    const queue = () => {
      const value = load(queueKey, []);
      return Array.isArray(value) ? value : [];
    };
    if (!storage.getItem('kr_sync_legacy_imported_v2')) {
      const legacyValue = load('kr_offline_write_queue', []);
      const legacy = Array.isArray(legacyValue) ? legacyValue : [];
      const existing = queue();
      for (const item of legacy) {
        if (!Array.isArray(item.body?.items) || existing.some(entry => entry.key === key(item.path, item.tripId))) continue;
        existing.push({ id: `legacy-${item.id}`, key: key(item.path, item.tripId), path: item.path, tripId: item.tripId, items: item.body.items });
      }
      save(queueKey, existing);
      storage.setItem('kr_sync_legacy_imported_v2', '1');
    }
    const ready = (async () => {
      for (const name of [queueKey, stateKey]) {
        let localRaw = null;
        try {
          localRaw = memory.get(name) || storage.getItem(name);
          if (localRaw) JSON.parse(localRaw);
        } catch { localRaw = null; }
        const raw = localRaw || await durableGet(name);
        if (!raw) continue;
        memory.set(name, raw);
        if (!localRaw) try { storage.setItem(name, raw); } catch {}
      }
    })();
    const pending = (path, tripId) => queue().filter(item => item.key === key(path, tripId)).at(-1);
    // A different tab can update localStorage while this tab still displays an
    // older list. Only revisions actually read/saved by this tab are baselines.
    const revision = (path, tripId) => knownRevisions.get(key(path, tripId));
    function setRevision(itemKey, value, displayed = true) {
      const states = load(stateKey, {}); states[itemKey] = value; save(stateKey, states);
      if (displayed) knownRevisions.set(itemKey, value);
    }
    async function request(path, tripId, body) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetcher(`${baseUrl}${path}?tripId=${encodeURIComponent(tripId)}`, {
          method: body ? 'POST' : 'GET', cache: 'no-store', signal: controller.signal,
          ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw Object.assign(new Error(result.error || '同步暂不可用'), { status: response.status });
        return result;
      } finally { clearTimeout(timer); }
    }
    async function read(path, tripId) {
      await ready;
      const itemKey = key(path, tripId);
      const epoch = epochs.get(itemKey) || 0;
      if (pending(path, tripId)) return null;
      const result = await request(path, tripId);
      if (result.protocol !== 2 || !Number.isInteger(result.revision) || !Array.isArray(result.data)) throw new Error('同步服务正在更新');
      // A read begun before an edit must never replace that edit, even after its save finishes.
      if (pending(path, tripId) || epoch !== (epochs.get(itemKey) || 0)) return null;
      const prior = revision(path, tripId);
      if (prior != null && result.revision < prior) return null;
      setRevision(itemKey, result.revision);
      return result.data;
    }
    async function runFlush() {
      await ready;
      if (!online()) return;
      const attempted = new Set();
      while (true) {
        const item = queue().find(entry => !entry.blocked && !attempted.has(entry.id));
        if (!item) break;
        attempted.add(item.id);
        try {
          if (!Number.isInteger(item.baseRevision)) {
            // No trustworthy baseline (old offline queue or edits before first load).
            // Keep the edit locally instead of uploading a potentially stale whole list.
            throw Object.assign(new Error('这份修改缺少同步版本，已保留在本机，请先导出备份'), { status: 409 });
          }
          await save(queueKey, queue().map(entry => entry.id === item.id ? { ...entry, sent: true } : entry));
          const result = await request(item.path, item.tripId, {
            protocol: 2, mutationId: item.id, baseRevision: item.baseRevision,
            tripId: item.tripId, items: item.items
          });
          writeResults.set(item.id, result);
          setRevision(item.key, result.revision, item.owner === owner);
          // Read the current queue again: new edits may have arrived while awaiting HTTP.
          const current = queue().filter(entry => entry.id !== item.id).map(entry =>
            entry.key === item.key && entry.owner === item.owner && entry.baseRevision === item.baseRevision
              ? { ...entry, baseRevision: result.revision } : entry);
          await save(queueKey, current);
          onStatus(item.path, current.some(entry => entry.key === item.key) ? 'pending' : 'saved', item.tripId);
        } catch (error) {
          const blocked = [400, 409, 413, 426].includes(error.status);
          if (blocked) await save(queueKey, queue().map(entry => entry.key === item.key ? { ...entry, blocked: true, error: error.message } : entry));
          onStatus(item.path, blocked ? 'conflict' : 'pending', item.tripId, error.message);
          if (!blocked) break;
        }
      }
    }
    function flush() {
      if (flushing) return flushing;
      const run = () => runFlush();
      flushing = (root.navigator?.locks
        ? root.navigator.locks.request('kr-sync-flush-v2', run) : run()).finally(() => { flushing = null; });
      return flushing;
    }
    async function write(path, tripId, items) {
      await ready;
      const itemKey = key(path, tripId);
      epochs.set(itemKey, (epochs.get(itemKey) || 0) + 1);
      const prior = pending(path, tripId);
      const entry = {
        id: root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        key: itemKey, path, tripId, owner: prior?.owner || owner, items: JSON.parse(JSON.stringify(items)),
        baseRevision: prior?.owner === owner ? prior.baseRevision : revision(path, tripId),
        ...(prior?.blocked ? { blocked: true, error: prior.error } : {})
      };
      // On reload, edits are based on the pending snapshot shown by read().
      if (prior && revision(path, tripId) == null) entry.baseRevision = prior.baseRevision;
      else entry.owner = owner;
      await save(queueKey, [...queue().filter(item => item.key !== itemKey || item.sent || item.owner !== entry.owner), entry]);
      onStatus(path, 'pending', tripId);
      await flush();
      const remaining = pending(path, tripId);
      const saved = writeResults.get(entry.id);
      writeResults.delete(entry.id);
      return { success: true, queued: Boolean(remaining), conflict: Boolean(remaining?.blocked), ...(Array.isArray(saved?.data) ? { data: saved.data } : {}) };
    }
    function archiveConflicts(tripId) {
      const items = queue().filter(item => item.tripId === tripId && item.blocked);
      if (!items.length) return false;
      save(`kr_sync_conflict_backup::${tripId}`, { savedAt: Date.now(), items });
      save(queueKey, queue().filter(item => !items.some(saved => saved.id === item.id)));
      return true;
    }
    return { read, write, flush, pending, revision, archiveConflicts, ready, settled: () => durableWrites };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createSyncClient };
  else root.createSyncClient = createSyncClient;
})(typeof globalThis === 'undefined' ? window : globalThis);
