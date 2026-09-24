/**
 * Um Firestore FALSO, em memória, só com o que a exclusão de cadastro usa.
 *
 * Existe porque o código de exclusão APAGA dados, e testar só as partes puras
 * deixaria de fora justamente o que mais importa: a ordem das operações, o
 * que acontece com uma conta bloqueada e se rodar duas vezes é seguro.
 * Não é um emulador — é o mínimo para exercitar a cascata.
 */

class FakeDocSnap {
  constructor(ref, data) { this.ref = ref; this.id = ref.id; this._data = data; }
  get exists() { return this._data !== undefined; }
  data() { return this._data === undefined ? undefined : JSON.parse(JSON.stringify(this._data)); }
}

class FakeDocRef {
  constructor(store, path) { this.store = store; this.path = path; this.id = path.split('/').pop(); }
  async get() { return new FakeDocSnap(this, this.store.docs.get(this.path)); }
  collection(name) { return new FakeQuery(this.store, `${this.path}/${name}`); }
  async delete() { this.store.log.push(['delete', this.path]); this.store.docs.delete(this.path); }
  async update(data) { aplicarUpdate(this.store, this, data); }
}

/** Aplica um `update` (com `increment` falso) — usado pelo lote e pela transação. */
function aplicarUpdate(store, ref, data) {
  store.log.push(['update', ref.path]);
  const atual = store.docs.get(ref.path);
  if (atual === undefined) throw new Error(`update em documento ausente: ${ref.path}`);
  const novo = { ...atual };
  Object.entries(data).forEach(([k, v]) => {
    novo[k] = v && typeof v === 'object' && '__increment' in v ? (Number(atual[k]) || 0) + v.__increment : v;
  });
  store.docs.set(ref.path, novo);
}

class FakeQuery {
  constructor(store, colPath, filters = [], lim = Infinity) {
    this.store = store; this.colPath = colPath; this.filters = filters; this.lim = lim;
  }
  doc(id) { return new FakeDocRef(this.store, `${this.colPath}/${id}`); }
  where(field, op, value) { return new FakeQuery(this.store, this.colPath, [...this.filters, [field, op, value]], this.lim); }
  limit(n) { return new FakeQuery(this.store, this.colPath, this.filters, n); }
  async add(data) {
    const id = `auto${this.store.docs.size}`;
    this.store.docs.set(`${this.colPath}/${id}`, data);
    this.store.log.push(['add', `${this.colPath}/${id}`]);
    return this.doc(id);
  }
  async get() {
    const prefix = `${this.colPath}/`;
    const docs = [...this.store.docs.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .filter(([, data]) => this.filters.every(([f, op, v]) => {
        if (op === '==') return data[f] === v;
        if (op === 'array-contains') return Array.isArray(data[f]) && data[f].includes(v);
        throw new Error(`operador não suportado no falso: ${op}`);
      }))
      .slice(0, this.lim)
      .map(([path, data]) => new FakeDocSnap(new FakeDocRef(this.store, path), data));
    return { docs, size: docs.length, empty: docs.length === 0 };
  }
}

/** `FieldValue.increment` falso: guarda o delta e o lote aplica. */
const FakeFieldValue = {
  increment: (n) => ({ __increment: n }),
  serverTimestamp: () => ({ __serverTimestamp: true }),
};

function createFakeDb(seed = {}) {
  const store = { docs: new Map(Object.entries(seed)), log: [] };
  const db = {
    store,
    collection: (name) => new FakeQuery(store, name),
    /**
     * Transação falsa: lê e escreve direto (sem isolamento) — basta para
     * exercitar a LÓGICA; a exclusão mútua de verdade é do Firestore.
     */
    async runTransaction(fn) {
      const escritas = [];
      const tx = {
        get: (alvo) => alvo.get(),
        update: (ref, data) => escritas.push(() => aplicarUpdate(store, ref, data)),
      };
      const r = await fn(tx);
      escritas.forEach((w) => w());
      return r;
    },
    batch() {
      const ops = [];
      return {
        update: (ref, data) => ops.push(['update', ref, data]),
        delete: (ref) => ops.push(['delete', ref]),
        async commit() {
          ops.forEach(([tipo, ref, data]) => {
            store.log.push([tipo, ref.path]);
            if (tipo === 'delete') { store.docs.delete(ref.path); return; }
            const atual = store.docs.get(ref.path);
            if (atual === undefined) throw new Error(`update em documento ausente: ${ref.path}`);
            const novo = { ...atual };
            Object.entries(data).forEach(([k, v]) => {
              novo[k] = v && typeof v === 'object' && '__increment' in v ? (Number(atual[k]) || 0) + v.__increment : v;
            });
            store.docs.set(ref.path, novo);
          });
        },
      };
    },
  };
  return db;
}

/** Auth falso: `users` é o conjunto de uids com conta de login. */
function createFakeAuth(uids = [], { failOn = [], log = [] } = {}) {
  const contas = new Set(uids);
  return {
    log,
    contas,
    async getUser(uid) {
      if (!contas.has(uid)) { const e = new Error('nao'); e.code = 'auth/user-not-found'; throw e; }
      return { uid };
    },
    async deleteUser(uid) {
      log.push(['deleteUser', uid]);
      if (failOn.includes(uid)) { const e = new Error('falhou'); e.code = 'auth/internal-error'; throw e; }
      if (!contas.has(uid)) { const e = new Error('nao'); e.code = 'auth/user-not-found'; throw e; }
      contas.delete(uid);
    },
  };
}

function createFakeBucket(files = []) {
  let arquivos = [...files];
  return {
    get arquivos() { return arquivos; },
    async getFiles({ prefix }) { return [arquivos.filter((f) => f.startsWith(prefix)).map((name) => ({ name }))]; },
    async deleteFiles({ prefix }) { arquivos = arquivos.filter((f) => !f.startsWith(prefix)); },
  };
}

module.exports = { createFakeDb, createFakeAuth, createFakeBucket, FakeFieldValue };
