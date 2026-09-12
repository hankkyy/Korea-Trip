const isPrivate = item => item?.visibility === 'private' && Boolean(item?.ownerId);

function allowRead() {}

function visibleItems(route, items) {
  return items;
}

function protectPrivateWrite(route, submitted) {
  return submitted.map(raw => {
    const item = { ...raw, visibility: 'shared' };
    delete item.ownerId;
    return item;
  });
}

module.exports = { allowRead, visibleItems, protectPrivateWrite, isPrivate };
