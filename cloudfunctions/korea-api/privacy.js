const OWNER_ROUTES = new Set(['/todos', '/checklist', '/bucket-list', '/expenses', '/docs', '/inspirations', '/trips']);
const PERSONAL_ROUTES = new Set(['/expenses', '/docs']);

const recordId = item => String(item?.clientId ?? item?.id ?? '');
const isPrivate = item => item?.visibility === 'private' && Boolean(item?.ownerId);

function allowRead(route, caller) {
  if (caller.role === 'owner') return;
  if (route === '/itinerary' || route === '/weather' || route === '/fx') return;
  if (OWNER_ROUTES.has(route)) throw Object.assign(new Error('此资料仅旅行成员可见'), { status: 403 });
}

function visibleItems(route, items, caller) {
  if (caller.role !== 'owner' || !PERSONAL_ROUTES.has(route)) return items;
  return items.filter(item => !isPrivate(item) || item.ownerId === caller.uid);
}

function protectPrivateWrite(route, submitted, current, caller) {
  if (!PERSONAL_ROUTES.has(route)) return submitted;
  const existing = new Map(current.map(item => [recordId(item), item]));
  const incoming = new Map();
  for (const raw of submitted) {
    const id = recordId(raw);
    const prior = existing.get(id);
    if (prior && isPrivate(prior) && prior.ownerId !== caller.uid) {
      throw Object.assign(new Error('不能修改另一位成员的私人资料'), { status: 403 });
    }
    const item = { ...raw };
    if (item.visibility === 'private') {
      item.ownerId = caller.uid;
    } else {
      item.visibility = 'shared';
      delete item.ownerId;
    }
    incoming.set(id, item);
  }
  for (const [id, item] of existing) {
    if (isPrivate(item) && item.ownerId !== caller.uid) incoming.set(id, item);
  }
  return [...incoming.values()];
}

module.exports = { allowRead, visibleItems, protectPrivateWrite, isPrivate };
