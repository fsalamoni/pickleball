/**
 * MERCADO — categorias (departamentos) e os atributos de cada uma.
 *
 * Semente em código: o admin só LIGA e DESLIGA categorias (configuração do
 * Mercado), não cria. Os atributos viram campos do formulário de anúncio e
 * filtros da busca (`filterable`). O `slug` é gravado no anúncio: nunca
 * renomeie, só acrescente.
 */

const BRANDS_PADDLE = [
  'Selkirk', 'JOOLA', 'Franklin', 'Head', 'Gearbox', 'Paddletek', 'Onix',
  'Engage', 'CRBN', 'Six Zero', 'Vatic Pro', 'Babolat', 'Wilson', 'Adidas',
  'Diadem', 'Oneshot', 'Rakete', 'Outra',
];

const A = Object.freeze({
  marca: { key: 'marca', label: 'Marca', type: 'select', options: BRANDS_PADDLE, filterable: true },
  marcaLivre: { key: 'marca', label: 'Marca', type: 'text', filterable: true },
  peso: { key: 'peso_g', label: 'Peso', type: 'number', unit: 'g', filterable: true },
  core: {
    key: 'core_mm', label: 'Espessura do núcleo', type: 'select', unit: 'mm',
    options: ['11', '13', '14', '16', '19', '20'], filterable: true,
  },
  face: {
    key: 'face', label: 'Face', type: 'select',
    options: ['Fibra de carbono', 'Fibra de vidro', 'Kevlar', 'Híbrida', 'Madeira', 'Outra'], filterable: true,
  },
  formato: {
    key: 'formato', label: 'Formato', type: 'select',
    options: ['Padrão', 'Alongado', 'Híbrido', 'Largo'], filterable: true,
  },
  grip: { key: 'grip_mm', label: 'Circunferência do grip', type: 'number', unit: 'mm' },
  quantidade: { key: 'quantidade', label: 'Quantidade na embalagem', type: 'number', filterable: true },
  uso: { key: 'uso', label: 'Uso', type: 'select', options: ['Indoor', 'Outdoor', 'Ambos'], filterable: true },
  cor: { key: 'cor', label: 'Cor', type: 'text' },
  numeracao: {
    key: 'numeracao', label: 'Numeração', type: 'select',
    options: ['33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'], filterable: true,
  },
  tamanho: {
    key: 'tamanho', label: 'Tamanho', type: 'select',
    options: ['PP', 'P', 'M', 'G', 'GG', 'XG'], filterable: true,
  },
  genero: {
    key: 'genero', label: 'Modelo', type: 'select',
    options: ['Masculino', 'Feminino', 'Unissex', 'Infantil'], filterable: true,
  },
  capacidade: { key: 'capacidade', label: 'Quantas raquetes cabem', type: 'number', filterable: true },
  portatil: { key: 'portatil', label: 'Portátil', type: 'boolean', filterable: true },
});

/**
 * Árvore de departamentos. `children` herdam os atributos do pai e somam os
 * próprios.
 */
export const MARKET_CATEGORIES = Object.freeze([
  {
    slug: 'raquetes', label: 'Raquetes', icon: 'paddle',
    attributes: [A.marca, A.peso, A.core, A.face, A.formato, A.grip],
    children: [
      { slug: 'raquete-controle', label: 'Controle' },
      { slug: 'raquete-potencia', label: 'Potência' },
      { slug: 'raquete-hibrida', label: 'Híbrida' },
      { slug: 'raquete-iniciante', label: 'Iniciante' },
      { slug: 'raquete-infantil', label: 'Infantil' },
    ],
  },
  {
    slug: 'bolas', label: 'Bolas', icon: 'ball',
    attributes: [A.marcaLivre, A.uso, A.quantidade, A.cor],
    children: [],
  },
  {
    slug: 'calcados', label: 'Calçados', icon: 'shoe',
    attributes: [A.marcaLivre, A.numeracao, A.genero, A.uso],
    children: [],
  },
  {
    slug: 'vestuario', label: 'Roupas', icon: 'shirt',
    attributes: [A.marcaLivre, A.tamanho, A.genero, A.cor],
    children: [
      { slug: 'camisetas', label: 'Camisetas' },
      { slug: 'shorts-saias', label: 'Shorts e saias' },
      { slug: 'agasalhos', label: 'Agasalhos' },
      { slug: 'bones-viseiras', label: 'Bonés e viseiras' },
      { slug: 'meias', label: 'Meias' },
    ],
  },
  {
    slug: 'bolsas', label: 'Bolsas e mochilas', icon: 'bag',
    attributes: [A.marcaLivre, A.capacidade, A.cor],
    children: [],
  },
  {
    slug: 'acessorios', label: 'Acessórios', icon: 'tag',
    attributes: [A.marcaLivre],
    children: [
      { slug: 'overgrip', label: 'Overgrip e grip', attributes: [A.quantidade, A.cor] },
      { slug: 'protetor-de-borda', label: 'Protetor de borda' },
      { slug: 'oculos-protecao', label: 'Óculos e proteção' },
      { slug: 'munhequeiras', label: 'Munhequeiras e faixas' },
      { slug: 'capas', label: 'Capas de raquete' },
    ],
  },
  {
    slug: 'quadra', label: 'Rede e quadra', icon: 'net',
    attributes: [A.marcaLivre],
    children: [
      { slug: 'redes', label: 'Redes e postes', attributes: [A.portatil] },
      { slug: 'marcacao', label: 'Marcação de quadra' },
      { slug: 'maquina-de-bolas', label: 'Máquina de bolas' },
    ],
  },
  {
    slug: 'treino', label: 'Treino e recuperação', icon: 'dumbbell',
    attributes: [A.marcaLivre],
    children: [
      { slug: 'acessorios-treino', label: 'Acessórios de treino' },
      { slug: 'recuperacao', label: 'Recuperação e fisioterapia' },
    ],
  },
  {
    slug: 'outros', label: 'Outros', icon: 'box',
    attributes: [],
    children: [],
  },
]);

const flat = new Map();
for (const root of MARKET_CATEGORIES) {
  flat.set(root.slug, { ...root, parent: null });
  for (const child of root.children || []) {
    flat.set(child.slug, { ...child, parent: root.slug, children: [] });
  }
}

/** Categoria pelo slug (ou `null`). */
export function findCategory(slug) {
  return flat.get(slug) || null;
}

/** Departamentos ligados (o admin pode desligar alguns). */
export function activeCategories(disabled = []) {
  const off = new Set(disabled || []);
  return MARKET_CATEGORIES
    .filter((c) => !off.has(c.slug))
    .map((c) => ({ ...c, children: (c.children || []).filter((k) => !off.has(k.slug)) }));
}

/** O departamento raiz de uma categoria (o próprio, se já for raiz). */
export function rootOf(slug) {
  const c = findCategory(slug);
  if (!c) return null;
  return c.parent ? findCategory(c.parent) : c;
}

/** ['Raquetes', 'Controle'] */
export function categoryBreadcrumb(slug) {
  const c = findCategory(slug);
  if (!c) return [];
  return c.parent ? [findCategory(c.parent).label, c.label] : [c.label];
}

/** ['raquetes', 'raquete-controle'] — gravado no anúncio para filtrar pelo departamento. */
export function categoryPath(slug) {
  const c = findCategory(slug);
  if (!c) return [];
  return c.parent ? [c.parent, c.slug] : [c.slug];
}

/** Atributos efetivos: os do pai + os próprios (sem repetir a chave). */
export function attributesFor(slug) {
  const c = findCategory(slug);
  if (!c) return [];
  const parent = c.parent ? findCategory(c.parent) : null;
  const all = [...(parent?.attributes || []), ...(c.attributes || [])];
  const seen = new Set();
  return all.filter((a) => (seen.has(a.key) ? false : seen.add(a.key)));
}

export function filterableAttributes(slug) {
  return attributesFor(slug).filter((a) => a.filterable);
}

/**
 * Confere e limpa os atributos digitados. Atributo desconhecido some; número
 * inválido é erro; opção fora da lista é erro.
 * @returns {{ value: Record<string, any>, errors: Record<string, string> }}
 */
export function validateAttributes(slug, values = {}) {
  const value = {};
  const errors = {};
  for (const attr of attributesFor(slug)) {
    const raw = values?.[attr.key];
    if (raw === undefined || raw === null || raw === '') continue;
    if (attr.type === 'number') {
      const n = Number(String(raw).replace(',', '.'));
      if (!Number.isFinite(n) || n < 0) errors[attr.key] = `${attr.label}: use um número.`;
      else value[attr.key] = n;
    } else if (attr.type === 'boolean') {
      value[attr.key] = raw === true || raw === 'true';
    } else if (attr.type === 'select') {
      const s = String(raw);
      if (!attr.options.includes(s)) errors[attr.key] = `${attr.label}: escolha uma opção da lista.`;
      else value[attr.key] = s;
    } else {
      const s = String(raw).trim().slice(0, 60);
      if (s) value[attr.key] = s;
    }
  }
  return { value, errors };
}

/** Texto curto do atributo para mostrar ("16 mm", "Sim"). */
export function formatAttribute(attr, v) {
  if (v === undefined || v === null || v === '') return '';
  if (attr.type === 'boolean') return v ? 'Sim' : 'Não';
  return attr.unit ? `${v} ${attr.unit}` : String(v);
}
