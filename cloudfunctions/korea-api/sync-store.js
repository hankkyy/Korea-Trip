const { createHash, randomUUID } = require('crypto');

const COLLECTION = 'kr_sync_state';
const hash = value => createHash('sha256').update(value).digest('hex');
const keyFor = (path, tripId) => hash(`${path}:${path === '/trips' ? 'global' : tripId}`);
const logicalId = item => String(item?.clientId ?? item?.id ?? '');
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function mergeSnapshots(baseItems, localItems, remoteItems) {
  const asMap = items => new Map(items.map(item => [logicalId(item), item]));
  const base = asMap(baseItems), local = asMap(localItems), remote = asMap(remoteItems);
  const order = [...new Set([...local.keys(), ...remote.keys(), ...base.keys()])];
  const merged = [];
  for (const id of order) {
    if (!id) throw Object.assign(new Error('record is missing a stable id'), { status: 400 });
    const before = base.get(id), left = local.get(id), right = remote.get(id);
    const leftChanged = stableJson(left) !== stableJson(before);
    const rightChanged = stableJson(right) !== stableJson(before);
    if (leftChanged && rightChanged && stableJson(left) !== stableJson(right)) {
      throw Object.assign(new Error('同一条记录已在另一台设备修改，双方版本均已保留'), { status: 409 });
    }
    const chosen = leftChanged ? left : right;
    if (chosen) merged.push(chosen);
  }
  return merged;
}
function checked(result) {
  if (result?.code) throw new Error(result.message || result.code);
  return result;
}
async function getDoc(ref) {
  const result = checked(await ref.get());
  return Array.isArray(result.data) ? result.data[0] : result.data;
}
function cleanItems(items, tripId, path) {
  const records = new Map();
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw Object.assign(new Error('invalid item'), { status: 400 });
    const { _id, _openid, _createTime, _updateTime, ...data } = item;
    // A logical ID survives database re-inserts. Never deduplicate by title or amount.
    const id = String(data.clientId ?? data.id ?? _id ?? randomUUID());
    const record = { ...data, id: data.id ?? id, ...(path === '/expenses' ? { clientId: id } : {}), tripId: path === '/trips' ? (data.id || tripId) : tripId };
    const prior = records.get(id);
    if (!prior || Number(record.updatedAt || 0) >= Number(prior.updatedAt || 0)) records.set(id, record);
  }
  return [...records.values()];
}

function createSyncStore(db, collections) {
  const col = () => db.collection(COLLECTION);
  async function pack(items) {
    // Immutable, content-addressed chunks keep large photo lists below document limits.
    const encoded = Buffer.from(JSON.stringify(items)).toString('base64');
    const ids = [];
    for (let offset = 0; offset < encoded.length; offset += 180000) {
      const payload = encoded.slice(offset, offset + 180000);
      const id = `chunk-${hash(payload)}`;
      checked(await col().doc(id).set({ payload }));
      ids.push(id);
    }
    return ids;
  }
  async function unpack(head) {
    const parts = await Promise.all(head.chunks.map(id => getDoc(col().doc(id))));
    if (parts.some(part => typeof part?.payload !== 'string')) throw new Error('incomplete saved snapshot');
    return JSON.parse(Buffer.from(parts.map(part => part.payload).join(''), 'base64').toString());
  }
  async function readLegacy(path, tripId) {
    const records = [];
    for (let offset = 0; ; offset += 100) {
      let query = db.collection(collections[path]);
      if (path !== '/trips') query = query.where({ tripId });
      const page = checked(await query.orderBy('_id', 'asc').skip(offset).limit(100).get()).data;
      records.push(...page);
      if (page.length < 100) return records;
    }
  }
  async function ensureHead(path, tripId) {
    const id = keyFor(path, tripId);
    const existing = await getDoc(col().doc(id));
    if (existing) return existing;
    const legacy = await readLegacy(path, tripId);
    const backupChunks = await pack(legacy);
    const chunks = await pack(cleanItems(legacy, tripId, path));
    return db.runTransaction(async tx => {
      const ref = tx.collection(COLLECTION).doc(id);
      const current = await getDoc(ref);
      if (current) return current;
      const head = { path, tripId, revision: 1, chunks, backupChunks, history: [], receipts: [], updatedAt: Date.now() };
      checked(await ref.set(head));
      return head;
    });
  }
  async function read(path, tripId) {
    const head = await ensureHead(path, tripId);
    return { success: true, data: await unpack(head), revision: head.revision, protocol: 2 };
  }
  async function write(path, tripId, body) {
    if (body.protocol !== 2 || !Number.isInteger(body.baseRevision) || typeof body.mutationId !== 'string') {
      throw Object.assign(new Error('请刷新页面后再保存，当前版本已升级'), { status: 426 });
    }
    if (!Array.isArray(body.items)) throw Object.assign(new Error('items must be an array'), { status: 400 });
    const localItems = cleanItems(body.items, tripId, path);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const head = await ensureHead(path, tripId);
      const receipt = (head.receipts || []).find(entry => entry.id === body.mutationId);
      if (receipt) return { success: true, revision: head.revision, duplicate: true, data: await unpack(head) };
      if (body.baseRevision > head.revision) throw Object.assign(new Error('同步版本无效，请刷新后重试'), { status: 409 });
      let items = localItems;
      let merged = false;
      if (head.revision !== body.baseRevision) {
        const base = (head.history || []).find(entry => entry.revision === body.baseRevision);
        if (!base) throw Object.assign(new Error('另一台设备已修改，旧版本已超出自动合并范围'), { status: 409 });
        const remoteItems = await unpack(head);
        items = mergeSnapshots(await unpack(base), localItems, remoteItems);
        if (stableJson(items) === stableJson(remoteItems)) return { success: true, revision: head.revision, count: items.length, data: remoteItems, merged: true, unchanged: true };
        merged = true;
      }
      const chunks = await pack(items);
      try {
        return await db.runTransaction(async tx => {
          const ref = tx.collection(COLLECTION).doc(keyFor(path, tripId));
          const current = await getDoc(ref);
          const duplicate = (current.receipts || []).find(entry => entry.id === body.mutationId);
          if (duplicate) throw Object.assign(new Error('retry duplicate read'), { retryMerge: true });
          if (current.revision !== head.revision) throw Object.assign(new Error('retry merge'), { retryMerge: true });
          const revision = current.revision + 1;
          const { _id, ...previous } = current;
          const history = [...(current.history || []), { revision: current.revision, chunks: current.chunks, updatedAt: current.updatedAt }].slice(-30);
          checked(await ref.set({ ...previous, chunks, history, revision, receipts: [...(current.receipts || []), { id: body.mutationId, revision }].slice(-100), updatedAt: Date.now() }));
          return { success: true, revision, count: items.length, data: items, merged };
        });
      } catch (error) {
        if (!error.retryMerge || attempt === 3) throw error;
      }
    }
  }
  return { read, write };
}
module.exports = { createSyncStore, cleanItems, mergeSnapshots };
