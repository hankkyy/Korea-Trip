const clone = value => value === undefined ? undefined : structuredClone(value);

export function memoryDb(seed = {}) {
  let records = new Map(Object.entries(seed));
  let chain = Promise.resolve();
  const collection = (name, source = () => records) => ({
    doc(id) { return {
      async get() { return { data: clone(source().get(`${name}/${id}`)) }; },
      async set(data) { source().set(`${name}/${id}`, clone(data)); return { updated: 1 }; }
    }; },
    where(filter) { this.filter = filter; return this; },
    orderBy() { return this; }, skip(offset) { this.offset = offset; return this; }, limit(n) { this.n = n; return this; },
    async get() {
      return { data: [...source()]
        .filter(([key, value]) => key.startsWith(name + '/') && (!this.filter || Object.entries(this.filter).every(([k, v]) => value[k] === v)))
        .map(([key, value]) => ({ ...clone(value), _id: key.split('/')[1] }))
        .slice(this.offset || 0, (this.offset || 0) + (this.n || 100)) };
    }
  });
  return {
    collection,
    runTransaction(task) {
      const result = chain.then(async () => {
        const draft = new Map(records);
        const value = await task({ collection: name => collection(name, () => draft) });
        records = draft;
        return value;
      });
      chain = result.catch(() => {});
      return result;
    }
  };
}

export const paths = {
  '/todos': 'kr_todos', '/expenses': 'kr_expenses', '/checklist': 'kr_checklist',
  '/itinerary': 'kr_itinerary', '/docs': 'kr_docs', '/inspirations': 'kr_inspirations', '/bucket-list': 'kr_bucketlist', '/trips': 'kr_trips'
};
