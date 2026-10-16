/**
 * Firestore FALSO e mais completo, em memória — para provar as tarefas
 * agendadas da gamificação (que leem, calculam e gravam) sem emulador.
 *
 * Cobre o que elas usam: consultas com `==`, `in`, `>=`, `>`, `<=`, `<`,
 * `array-contains`, `orderBy`, `limit`, `count()` e `aggregate` (soma);
 * `set` com `merge` (e os sentinelas `FieldValue.delete`/`arrayUnion`), `add`; documentos com `get/create/set/update/delete`;
 * `db.getAll(...)` e o lote (`set/update/create/delete`). `create` num
 * documento que existe lança o erro ALREADY_EXISTS (code 6), como o real —
 * é nele que a idempotência dos avisos e dos prêmios se apoia.
 */
class Snap {
  constructor(ref, data) { this.ref = ref; this.id = ref.id; this._d = data; }
  get exists() { return this._d !== undefined; }
  data() { return this._d === undefined ? undefined : JSON.parse(JSON.stringify(this._d)); }
}

function jaExiste(path) {
  const e = new Error(`6 ALREADY_EXISTS: Document already exists: ${path}`);
  e.code = 6;
  return e;
}

/** Os sentinelas do Admin SDK (`FieldValue.delete()`, `arrayUnion`) num `set` com `merge`. */
const sentinela = (v) => (v && typeof v === 'object' && v.constructor ? v.constructor.name : '');
function mescla(atual, patch) {
  const novo = { ...(atual && typeof atual === 'object' ? atual : {}) };
  Object.entries(patch).forEach(([k, v]) => {
    const tipo = sentinela(v);
    if (tipo === 'DeleteTransform') delete novo[k];
    else if (tipo === 'ArrayUnionTransform') novo[k] = [...new Set([...(Array.isArray(novo[k]) ? novo[k] : []), ...v.elements])];
    else if (tipo === 'Object' && !Array.isArray(v)) novo[k] = mescla(novo[k], v);
    else novo[k] = JSON.parse(JSON.stringify(v));
  });
  return novo;
}

function aplica(atual, patch) {
  const novo = { ...atual };
  Object.entries(patch).forEach(([k, v]) => { novo[k] = v; });
  return novo;
}

class Ref {
  constructor(store, path) { this.store = store; this.path = path; this.id = path.split('/').pop(); }
  async get() { return new Snap(this, this.store.docs.get(this.path)); }
  async set(data, opts) {
    this.store.log.push(['set', this.path]);
    this.store.docs.set(this.path, opts && opts.merge ? mescla(this.store.docs.get(this.path), data) : JSON.parse(JSON.stringify(data)));
  }
  async create(data) {
    if (this.store.docs.has(this.path)) throw jaExiste(this.path);
    this.store.log.push(['create', this.path]);
    this.store.docs.set(this.path, JSON.parse(JSON.stringify(data)));
  }
  async update(patch) {
    if (!this.store.docs.has(this.path)) throw new Error(`update em documento ausente: ${this.path}`);
    this.store.log.push(['update', this.path]);
    this.store.docs.set(this.path, aplica(this.store.docs.get(this.path), patch));
  }
  async delete() { this.store.log.push(['delete', this.path]); this.store.docs.delete(this.path); }
}

/** `a.b.c` percorre mapas aninhados, como o Firestore faz num `where`. */
const valorDoCampo = (data, campo) => String(campo).split('.').reduce((o, k) => (o == null ? undefined : o[k]), data);

const casa = (data, [campo, op, valor]) => {
  const v = valorDoCampo(data, campo);
  switch (op) {
    case '==': return v === valor;
    case 'in': return Array.isArray(valor) && valor.includes(v);
    case '>=': return v !== undefined && v >= valor;
    case '>': return v !== undefined && v > valor;
    case '<=': return v !== undefined && v !== null && v <= valor;
    case '<': return v !== undefined && v !== null && v < valor;
    case 'array-contains': return Array.isArray(v) && v.includes(valor);
    default: throw new Error(`operador não suportado: ${op}`);
  }
};

class Query {
  constructor(store, col, filtros = [], ordem = null, lim = Infinity) {
    this.store = store; this.col = col; this.filtros = filtros; this.ordem = ordem; this.lim = lim;
  }
  doc(id) {
    this.store.seq = (this.store.seq || 0) + 1;
    return new Ref(this.store, `${this.col}/${id === undefined ? `auto${this.store.seq}` : id}`);
  }
  async add(data) { const r = this.doc(); await r.set(data); return r; }
  where(c, op, v) { return new Query(this.store, this.col, [...this.filtros, [c, op, v]], this.ordem, this.lim); }
  orderBy(c, dir = 'asc') { return new Query(this.store, this.col, this.filtros, [c, dir], this.lim); }
  limit(n) { return new Query(this.store, this.col, this.filtros, this.ordem, n); }
  _linhas() {
    const prefixo = `${this.col}/`;
    let linhas = [...this.store.docs.entries()]
      .filter(([p]) => p.startsWith(prefixo) && !p.slice(prefixo.length).includes('/'))
      .filter(([, d]) => this.filtros.every((f) => casa(d, f)));
    if (this.ordem) {
      const [c, dir] = this.ordem;
      linhas = linhas.sort(([, a], [, b]) => (dir === 'desc' ? -1 : 1) * ((a[c] > b[c]) - (a[c] < b[c])));
    }
    return linhas.slice(0, this.lim);
  }
  async get() {
    const docs = this._linhas().map(([p, d]) => new Snap(new Ref(this.store, p), d));
    return { docs, size: docs.length, empty: docs.length === 0 };
  }
  count() { return { get: async () => ({ data: () => ({ count: this._linhas().length }) }) }; }
  /** `aggregate({ total: AggregateField.sum('campo') })`. */
  aggregate(spec) {
    return {
      get: async () => {
        const linhas = this._linhas();
        const out = {};
        Object.entries(spec).forEach(([nome, f]) => {
          out[nome] = linhas.reduce((s, [, d]) => s + (Number(valorDoCampo(d, f._field)) || 0), 0);
        });
        return { data: () => out };
      },
    };
  }
}

function createRichFakeDb(seed = {}) {
  const store = { docs: new Map(Object.entries(seed).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])), log: [] };
  return {
    store,
    collection: (n) => new Query(store, n),
    async getAll(...refs) { return Promise.all(refs.map((r) => r.get())); },
    batch() {
      const ops = [];
      return {
        set: (r, d, o) => ops.push(['set', r, d, o]),
        create: (r, d) => ops.push(['create', r, d]),
        update: (r, d) => ops.push(['update', r, d]),
        delete: (r) => ops.push(['delete', r]),
        async commit() {
          for (const [t, r, d, o] of ops) {
            // eslint-disable-next-line no-await-in-loop
            await r[t](d, o);
          }
        },
      };
    },
    /** Todos os documentos de uma coleção, como { id: dados }. */
    dump(col) {
      const out = {};
      store.docs.forEach((d, p) => { if (p.startsWith(`${col}/`)) out[p.slice(col.length + 1)] = d; });
      return out;
    },
  };
}

module.exports = { createRichFakeDb };
