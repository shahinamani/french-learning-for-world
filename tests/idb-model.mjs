/**
 * A small MODEL of the parts of IndexedDB these tests depend on. It is not
 * IndexedDB: IndexedDB does not exist in Node, and the unit suite runs with the
 * web dependencies hidden, so `idb` cannot be imported either.
 *
 * What it models, because the behaviour under test is defined by it:
 *   - a database has a version; the upgrade callback runs only when a higher
 *     version is requested, with the old version;
 *   - an object store has a keyPath (a string or an array of fields) and
 *     `put` on an existing key overwrites while `add` on one refuses;
 *   - createObjectStore on a name that exists throws (as the real one does).
 *
 * What it does NOT prove: that a real browser accepts the schema, and that the
 * real upgrade keeps real rows. Those two are checked in web/e2e/walk.mjs.
 */
export class Store {
  constructor(name, keyPath) { this.name = name; this.keyPath = keyPath; this.rows = new Map(); this.indexes = {}; }
  keyOf(v) {
    const kp = this.keyPath;
    return JSON.stringify(Array.isArray(kp) ? kp.map((f) => v[f]) : v[kp]);
  }
  createIndex(name, keyPath) { this.indexes[name] = keyPath; }
  put(v) { this.rows.set(this.keyOf(v), structuredClone(v)); }
  add(v) {
    if (this.rows.has(this.keyOf(v))) throw new Error('ConstraintError');
    this.put(v);
  }
  get(key) { return structuredClone(this.rows.get(JSON.stringify(key))); }
  getAll() { return [...this.rows.values()].map((r) => structuredClone(r)); }
  get count() { return this.rows.size; }
}

export class Database {
  constructor() { this.version = 0; this.stores = new Map(); this.deleted = []; }
  /** What the upgrade callback is handed. There is deliberately a recorder for
   *  deleteObjectStore, so a test can assert it was never called. */
  get upgradeApi() {
    return {
      objectStoreNames: { contains: (n) => this.stores.has(n) },
      createObjectStore: (name, { keyPath }) => {
        if (this.stores.has(name)) throw new Error('ConstraintError: store exists');
        const s = new Store(name, keyPath); this.stores.set(name, s); return s;
      },
      deleteObjectStore: (name) => { this.deleted.push(name); this.stores.delete(name); },
    };
  }
  open(version, upgrade) {
    if (version < this.version) throw new Error('VersionError');
    if (version > this.version) {
      const old = this.version;
      upgrade(this.upgradeApi, old);
      this.version = version;
    }
    return this;
  }
  store(name) { return this.stores.get(name); }
}
