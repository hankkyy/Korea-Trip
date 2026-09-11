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
    // Safari's IndexedDB can occasionally leave an open or transaction pending
    // (especially for an installed web app after an interrupted restore). Local
    // persistence is an enhancement: it must never hold up the whole trip UI.
    const dbPromise = root.indexedDB ? new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => finish(null), 1500);
      try {
        const request = root.indexedDB.open('lu-travel-sync', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('state');
        request.onsuccess = () => finish(request.result);
        request.onerror = request.onblocked = () => finish(null);
      } catch { finish(null); }
    }) : Promise.resolve(null);
    async function durableGet(name) {
      const db = await dbPromise;
      if (!db) return null;
      return new Promise(resolve => {
        let settled = false;
        const finish = (value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        };
        const timer = setTimeout(() => finish(null), 1500);
        try {
          const request = db.transaction('state').objectStore('state').get(name);
          request.onsuccess = () => finish(typeof request.result === 'string' ? request.result : null);
          request.onerror = () => finish(null);
        } catch { finish(null); }
      });
    }
    async function durablePut(name, raw) {
      const db = await dbPromise;
      if (!db) return false;
      return new Promise(resolve => {
        let settled = false;
        const finish = (ok = false) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(ok);
        };
        const timer = setTimeout(finish, 1500);
        try {
          const transaction = db.transaction('state', 'readwrite');
          transaction.objectStore('state').put(raw, name);
          transaction.oncomplete = () => finish(true);
          transaction.onerror = transaction.onabort = () => finish(false);
        } catch { finish(); }
      });
    }
    const load = (name, fallback) => {
      let raw;
      try { raw = storage.getItem(name); } catch {}
      if (raw == null) raw = memory.get(name);
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
      let localSaved = false;
      try { storage.setItem(name, raw); localSaved = true; } catch {}
      const task = durableWrites.then(async () => {
        const durableSaved = await durablePut(name, raw);
        if (!localSaved && !durableSaved) throw new Error('设备存储不可用，修改尚未持久保存。请保持页面打开并导出备份。');
      });
      durableWrites = task.catch(() => {});
      return task;
    };
    const queue = () => {
      const value = load(queueKey, []);
      return Array.isArray(value) ? value : [];
    };
    const ready = (async () => {
      for (const name of [queueKey, stateKey]) {
        let localRaw = null;
        try {
          localRaw = storage.getItem(name);
          if (localRaw) JSON.parse(localRaw);
        } catch {
          load(name, null); // quarantine malformed local data
          localRaw = null;
        }
        const raw = localRaw || await durableGet(name);
        if (!raw) continue;
        memory.set(name, raw);
        if (!localRaw) try { storage.setItem(name, raw); } catch {}
      }
      if (!load('kr_sync_legacy_imported_v2', false)) {
        const legacyValue = load('kr_offline_write_queue', []);
        const existing = queue();
        for (const item of Array.isArray(legacyValue) ? legacyValue : []) {
          if (!Array.isArray(item.body?.items) || existing.some(entry => entry.key === key(item.path, item.tripId))) continue;
          existing.push({ id: `legacy-${item.id}`, key: key(item.path, item.tripId), path: item.path, tripId: item.tripId, items: item.body.items });
        }
        if (existing.length) await save(queueKey, existing);
        try { storage.setItem('kr_sync_legacy_imported_v2', 'true'); } catch {}
      }
    })();
    const pending = (path, tripId) => queue().filter(item => item.key === key(path, tripId)).at(-1);
    // A different tab can update localStorage while this tab still displays an
    // older list. Only revisions actually read/saved by this tab are baselines.
    const revision = (path, tripId) => knownRevisions.get(key(path, tripId));
    function setRevision(itemKey, value, displayed = true) {
      const states = load(stateKey, {}); states[itemKey] = value; save(stateKey, states).catch(() => {});
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
    async function read(path, tripId, accept = () => true) {
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
      if (!accept(result.data)) return null;
      setRevision(itemKey, result.revision);
      return result.data;
    }
    function rebaseEntry(entry, before, remote, nextRevision) {
      const id = item => String(item.clientId ?? item.id);
      const map = items => new Map(items.map(item => [id(item), item]));
      const base = map(before), local = map(entry.items), merged = map(remote);
      // Only reapply edits made after the submitted snapshot. Preserve remote additions.
      for (const recordId of new Set([...base.keys(), ...local.keys()])) {
        if (JSON.stringify(base.get(recordId)) === JSON.stringify(local.get(recordId))) continue;
        if (local.has(recordId)) merged.set(recordId, local.get(recordId));
        else merged.delete(recordId);
      }
      return { ...entry, items: [...merged.values()], baseRevision: nextRevision };
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
          writeResults.set(item.key, result);
          setRevision(item.key, result.revision, false);
          // Read the current queue again: new edits may have arrived while awaiting HTTP.
          const current = queue().filter(entry => entry.id !== item.id).map(entry =>
            entry.key === item.key && entry.owner === item.owner && entry.baseRevision === item.baseRevision
              ? rebaseEntry(entry, item.items, result.data, result.revision) : entry);
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
    async function write(path, tripId, items, accept = () => true) {
      await ready;
      const itemKey = key(path, tripId);
      epochs.set(itemKey, (epochs.get(itemKey) || 0) + 1);
      const prior = pending(path, tripId);
      const entry = {
        id: root.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        key: itemKey, path, tripId, owner: prior?.owner || owner, items: JSON.parse(JSON.stringify(items)),
        displayItems: JSON.parse(JSON.stringify(items)),
        baseRevision: prior?.owner === owner ? prior.baseRevision : revision(path, tripId),
        ...(prior?.blocked ? { blocked: true, error: prior.error } : {})
      };
      if (prior?.owner === owner && prior.displayItems) {
        entry.items = rebaseEntry(entry, prior.displayItems, prior.items, prior.baseRevision).items;
      }
      // On reload, edits are based on the pending snapshot shown by read().
      if (prior && revision(path, tripId) == null) entry.baseRevision = prior.baseRevision;
      else entry.owner = owner;
      await save(queueKey, [...queue().filter(item => item.key !== itemKey || item.sent || item.owner !== entry.owner), entry]);
      onStatus(path, 'pending', tripId);
      await flush();
      const remaining = pending(path, tripId);
      const saved = writeResults.get(entry.key);
      if (!remaining && saved) {
        const displayed = accept(saved.data);
        if (displayed || !saved.merged && !saved.duplicate) setRevision(itemKey, saved.revision);
      }
      return { success: true, queued: Boolean(remaining), conflict: Boolean(remaining?.blocked), ...(Array.isArray(saved?.data) ? { data: saved.data } : {}) };
    }
    async function archiveConflicts(tripId) {
      const items = queue().filter(item => item.tripId === tripId && item.blocked);
      if (!items.length) return false;
      await save(`kr_sync_conflict_backup::${tripId}`, { savedAt: Date.now(), items });
      await save(queueKey, queue().filter(item => !items.some(saved => saved.id === item.id)));
      return true;
    }
    return { read, write, flush, pending, revision, archiveConflicts, queue, ready, settled: () => durableWrites };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createSyncClient };
  else root.createSyncClient = createSyncClient;
})(typeof globalThis === 'undefined' ? window : globalThis);
