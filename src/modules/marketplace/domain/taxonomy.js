/**
 * MERCADO — categorias (departamentos) e os atributos de cada uma.
 *
 * Semente em código: o admin só LIGA e DESLIGA categorias (configuração do
 * Mercado), não cria. Os atributos viram campos do formulário de anúncio e
 * filtros da busca (`filterable`). O `slug` é gravado no anúncio: nunca
 * renomeie, só acrescente.
 */
import { t, tk } from '@/core/i18n';

const BRANDS_PADDLE = [
  'Selkirk', 'JOOLA', 'Franklin', 'Head', 'Gearbox', 'Paddletek', 'Onix',
  'Engage', 'CRBN', 'Six Zero', 'Vatic Pro', 'Babolat', 'Wilson', 'Adidas',
  'Diadem', 'Oneshot', 'Rakete', tk('Outra'),
];

const A = Object.freeze({
  marca: { key: 'marca', label: tk('Marca'), type: 'select', options: BRANDS_PADDLE, filterable: true },
  marcaLivre: { key: 'marca', label: tk('Marca'), type: 'text', filterable: true },
  peso: { key: 'peso_g', label: tk('Peso'), type: 'number', unit: 'g', filterable: true },
  core: {
    key: 'core_mm', label: tk('Espessura do núcleo'), type: 'select', unit: 'mm',
    options: ['11', '13', '14', '16', '19', '20'], filterable: true,
  },
  face: {
    key: 'face', label: tk('Face'), type: 'select',
    options: [tk('Fibra de carbono'), tk('Fibra de vidro'), 'Kevlar', tk('Híbrida'), tk('Madeira'), tk('Outra')], filterable: true,
  },
  formato: {
    key: 'formato', label: tk('Formato'), type: 'select',
    options: [tk('Padrão'), tk('Alongado'), tk('Híbrido'), tk('Largo')], filterable: true,
  },
  grip: { key: 'grip_mm', label: tk('Circunferência do grip'), type: 'number', unit: 'mm' },
  quantidade: { key: 'quantidade', label: tk('Quantidade na embalagem'), type: 'number', filterable: true },
  uso: { key: 'uso', label: tk('Uso'), type: 'select', options: ['Indoor', 'Outdoor', tk('Ambos')], filterable: true },
  cor: { key: 'cor', label: tk('Cor'), type: 'text' },
  numeracao: {
    key: 'numeracao', label: tk('Numeração'), type: 'select',
    options: ['33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'], filterable: true,
  },
  tamanho: {
    key: 'tamanho', label: tk('Tamanho'), type: 'select',
    options: ['PP', 'P', 'M', 'G', 'GG', 'XG'], filterable: true,
  },
  genero: {
    key: 'genero', label: tk('Modelo'), type: 'select',
    options: [tk('Masculino'), tk('Feminino'), tk('Unissex'), tk('Infantil')], filterable: true,
  },
  capacidade: { key: 'capacidade', label: tk('Quantas raquetes cabem'), type: 'number', filterable: true },
  portatil: { key: 'portatil', label: tk('Portátil'), type: 'boolean', filterable: true },
});

/**
 * Árvore de departamentos. `children` herdam os atributos do pai e somam os
 * próprios.
 */
export const MARKET_CATEGORIES = Object.freeze([
  {
    slug: 'raquetes', label: tk('Raquetes'), icon: 'paddle',
    attributes: [A.marca, A.peso, A.core, A.face, A.formato, A.grip],
    children: [
      { slug: 'raquete-controle', label: tk('Controle') },
      { slug: 'raquete-potencia', label: tk('Potência') },
      { slug: 'raquete-hibrida', label: tk('Híbrida') },
      { slug: 'raquete-iniciante', label: tk('Iniciante') },
      { slug: 'raquete-infantil', label: tk('Infantil') },
    ],
  },
  {
    slug: 'bolas', label: tk('Bolas'), icon: 'ball',
    attributes: [A.marcaLivre, A.uso, A.quantidade, A.cor],
    children: [],
  },
  {
    slug: 'calcados', label: tk('Calçados'), icon: 'shoe',
    attributes: [A.marcaLivre, A.numeracao, A.genero, A.uso],
    children: [],
  },
  {
    slug: 'vestuario', label: tk('Roupas'), icon: 'shirt',
    attributes: [A.marcaLivre, A.tamanho, A.genero, A.cor],
    children: [
      { slug: 'camisetas', label: tk('Camisetas') },
      { slug: 'shorts-saias', label: tk('Shorts e saias') },
      { slug: 'agasalhos', label: tk('Agasalhos') },
      { slug: 'bones-viseiras', label: tk('Bonés e viseiras') },
      { slug: 'meias', label: tk('Meias') },
    ],
  },
  {
    slug: 'bolsas', label: tk('Bolsas e mochilas'), icon: 'bag',
    attributes: [A.marcaLivre, A.capacidade, A.cor],
    children: [],
  },
  {
    slug: 'acessorios', label: tk('Acessórios'), icon: 'tag',
    attributes: [A.marcaLivre],
    children: [
      { slug: 'overgrip', label: tk('Overgrip e grip'), attributes: [A.quantidade, A.cor] },
      { slug: 'protetor-de-borda', label: tk('Protetor de borda') },
      { slug: 'oculos-protecao', label: tk('Óculos e proteção') },
      { slug: 'munhequeiras', label: tk('Munhequeiras e faixas') },
      { slug: 'capas', label: tk('Capas de raquete') },
    ],
  },
  {
    slug: 'quadra', label: tk('Rede e quadra'), icon: 'net',
    attributes: [A.marcaLivre],
    children: [
      { slug: 'redes', label: tk('Redes e postes'), attributes: [A.portatil] },
      { slug: 'marcacao', label: tk('Marcação de quadra') },
      { slug: 'maquina-de-bolas', label: tk('Máquina de bolas') },
    ],
  },
  {
    slug: 'treino', label: tk('Treino e recuperação'), icon: 'dumbbell',
    attributes: [A.marcaLivre],
    children: [
      { slug: 'acessorios-treino', label: tk('Acessórios de treino') },
      { slug: 'recuperacao', label: tk('Recuperação e fisioterapia') },
    ],
  },
  {
    slug: 'outros', label: tk('Outros'), icon: 'box',
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
  return c.parent ? [t(findCategory(c.parent).label), t(c.label)] : [t(c.label)];
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
      if (!Number.isFinite(n) || n < 0) errors[attr.key] = t('{campo}: use um número.', { campo: t(attr.label) });
      else value[attr.key] = n;
    } else if (attr.type === 'boolean') {
      value[attr.key] = raw === true || raw === 'true';
    } else if (attr.type === 'select') {
      const s = String(raw);
      if (!attr.options.includes(s)) errors[attr.key] = t('{campo}: escolha uma opção da lista.', { campo: t(attr.label) });
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
  if (attr.type === 'boolean') return v ? t('Sim') : t('Não');
  if (attr.unit) return `${v} ${attr.unit}`;
  return attr.type === 'select' ? t(String(v)) : String(v);
}
