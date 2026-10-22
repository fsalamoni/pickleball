/**
 * Tipos de filiação (Etapa 2 do cadastro estruturado, 2026-10-22).
 *
 * O CATÁLOGO é da plataforma: o admin mantém em Painel admin → Federações →
 * Configuração (`platform_settings/federations.member_types[]`). Cinco tipos
 * já vêm prontos — atleta, professor, árbitro, clube e arena — e o admin os
 * renomeia, descreve, desliga ou cria outros (dirigente, técnico, escola…).
 * Cada federação cria planos para os tipos que quiser.
 *
 * Cada tipo diz QUEM se filia (`entity`): uma pessoa, um clube ou uma arena; e
 * em que GRUPO conta (`category`) no colégio eleitoral e nos indicadores —
 * pessoa conta como atleta, professor, árbitro ou em nenhum grupo; clube e
 * arena contam como entidade. Os ids são gravados no plano e na filiação:
 * nunca renomeie um id.
 *
 * A resolução do tipo tem cópia no servidor (`functions/federationMemberTypes.js`,
 * paridade em `federationMemberTypes.parity.test.js`).
 */
import { t, tk } from '@/core/i18n';

export const MEMBER_ENTITY = Object.freeze({ PERSON: 'person', CLUB: 'club', ARENA: 'arena' });
export const MEMBER_ENTITY_LABELS = Object.freeze({ person: tk('Pessoa'), club: tk('Clube'), arena: tk('Arena') });

/** Grupo do colégio eleitoral (Lei 14.597) e dos indicadores. `none` não vota. */
export const PERSON_CATEGORIES = Object.freeze(['athlete', 'coach', 'referee', 'none']);
export const MEMBER_CATEGORY_LABELS = Object.freeze({
  athlete: tk('Atletas'), coach: tk('Professores'), referee: tk('Árbitros'), none: tk('Nenhum grupo (não vota)'), club: tk('Clubes'), arena: tk('Arenas'),
});

export const MEMBER_TYPE_ID_RE = /^[a-z][a-z0-9_]{1,23}$/;
export const MEMBER_TYPES_MAX = 30;

const BUILTIN = Object.freeze([
  { id: 'athlete', label: tk('Atleta'), entity: 'person', category: 'athlete' },
  { id: 'coach', label: tk('Professor(a)'), entity: 'person', category: 'coach' },
  { id: 'referee', label: tk('Árbitro(a)'), entity: 'person', category: 'referee' },
  { id: 'club', label: tk('Clube'), entity: 'club', category: 'club' },
  { id: 'arena', label: tk('Arena'), entity: 'arena', category: 'arena' },
]);
export const BUILTIN_MEMBER_TYPE_IDS = Object.freeze(BUILTIN.map((b) => b.id));
const BUILTIN_BY_ID = Object.fromEntries(BUILTIN.map((b) => [b.id, b]));

const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

/** A categoria que vale para a entidade: clube e arena contam como eles mesmos. */
export function categoryFor(entity, category) {
  if (entity === 'club' || entity === 'arena') return entity;
  return PERSON_CATEGORIES.includes(category) ? category : 'none';
}

/**
 * O catálogo em uso: os cinco prontos (com o nome, a descrição e o liga/desliga
 * que o admin gravou) e os criados pelo admin. Entrada inválida é ignorada.
 */
export function memberTypeCatalog(settings) {
  const gravados = Array.isArray(settings?.member_types) ? settings.member_types : [];
  const porId = new Map();
  gravados.forEach((g) => { if (g && MEMBER_TYPE_ID_RE.test(String(g.id || '')) && !porId.has(g.id)) porId.set(g.id, g); });
  const prontos = BUILTIN.map((b) => {
    const g = porId.get(b.id) || {};
    const label = texto(g.label, 40);
    return { ...b, label: label || b.label, custom_label: Boolean(label), description: texto(g.description, 200), active: g.active !== false, builtin: true };
  });
  const proprios = [...porId.values()].filter((g) => !BUILTIN_BY_ID[g.id]).map((g) => {
    const entity = Object.values(MEMBER_ENTITY).includes(g.entity) ? g.entity : 'person';
    return { id: g.id, label: texto(g.label, 40) || g.id, custom_label: true, description: texto(g.description, 200), entity, category: categoryFor(entity, g.category), active: g.active !== false, builtin: false };
  });
  return [...prontos, ...proprios];
}

/** O nome que a tela mostra: o pronto é traduzido; o que o admin escreveu, não. */
export const memberTypeName = (type) => (type ? (type.custom_label ? type.label : t(type.label)) : '');

/**
 * O tipo de um plano ou filiação. Procura no catálogo; se o tipo saiu do
 * catálogo, vale o que ficou gravado no próprio documento (`person_type_label`,
 * `entity`, `person_category`); id antigo sem nada vira o pronto equivalente.
 */
export function memberTypeOf(catalog, source) {
  const id = typeof source === 'string' ? source : (source?.person_type || 'athlete');
  const doc = typeof source === 'string' ? {} : (source || {});
  const achado = (catalog || []).find((x) => x.id === id);
  if (achado) return achado;
  const pronto = BUILTIN_BY_ID[id];
  if (pronto) return { ...pronto, custom_label: false, description: '', active: true, builtin: true };
  const entity = Object.values(MEMBER_ENTITY).includes(doc.entity) ? doc.entity : 'person';
  return { id, label: texto(doc.person_type_label, 40) || id, custom_label: true, description: '', entity, category: categoryFor(entity, doc.person_category), active: false, builtin: false };
}

/** O nome do tipo de um plano ou filiação; o catálogo (opcional) dá o nome atual, sem ele vale o gravado. */
export function personTypeLabel(source, catalog = null) {
  const id = source?.person_type || 'athlete';
  // Com o catálogo carregado vale o nome ATUAL do admin (renomear o tipo chega aos planos já gravados).
  const doCatalogo = (catalog || []).find((x) => x.id === id);
  if (doCatalogo) return memberTypeName(doCatalogo);
  // O nome pronto gravado em português (servidor e plano) é traduzido; o que o admin escreveu, não.
  if (BUILTIN_BY_ID[id] && (!source?.person_type_label || source.person_type_label === BUILTIN_BY_ID[id].label)) return t(BUILTIN_BY_ID[id].label);
  return texto(source?.person_type_label, 40) || (BUILTIN_BY_ID[id] ? t(BUILTIN_BY_ID[id].label) : id);
}

/** Os campos de tipo que o plano grava ao salvar (o servidor confere de novo no pedido). */
export function planTypeFields(catalog, personType) {
  const tipo = memberTypeOf(catalog, personType);
  return { person_type: tipo.id, entity: tipo.entity, person_category: tipo.category, person_type_label: tipo.label };
}

export const isOrgEntity = (entity) => entity === 'club' || entity === 'arena';
export const isOrgMember = (member) => isOrgEntity(member?.org_kind);

/**
 * Valida a lista que o admin salva. Os cinco prontos não mudam de entidade nem
 * de grupo e não saem da lista (desligar é o caminho). Até 30 tipos.
 */
export function validateMemberTypes(list) {
  const errors = {};
  const ids = new Set();
  const value = [];
  (Array.isArray(list) ? list : []).forEach((x, i) => {
    const id = texto(x?.id, 24);
    const pronto = BUILTIN_BY_ID[id];
    if (!MEMBER_TYPE_ID_RE.test(id)) { errors[`id_${i}`] = t('Código com 2 a 24 letras minúsculas, números ou _ (começando por letra).'); return; }
    if (ids.has(id)) { errors[`id_${i}`] = t('Código repetido: {id}.', { id }); return; }
    ids.add(id);
    const label = texto(x.label, 40);
    if (!pronto && label.length < 2) { errors[`label_${i}`] = t('Dê um nome ao tipo.'); return; }
    const entity = pronto ? pronto.entity : (Object.values(MEMBER_ENTITY).includes(x.entity) ? x.entity : 'person');
    const category = pronto ? pronto.category : categoryFor(entity, x.category);
    value.push({ id, label: pronto && (label === pronto.label || label === t(pronto.label)) ? '' : label, description: texto(x.description, 200), entity, category, active: x.active !== false });
  });
  BUILTIN.forEach((b) => { if (!ids.has(b.id)) value.push({ id: b.id, label: '', description: '', entity: b.entity, category: b.category, active: true }); });
  if (value.length > MEMBER_TYPES_MAX) errors.list = t('No máximo {n} tipos.', { n: MEMBER_TYPES_MAX });
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/** Sugere um código a partir do nome ("Dirigente esportivo" → `dirigente_esportivo`). */
export function suggestMemberTypeId(label, existentes = []) {
  const base = String(label || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^[^a-z]+/, '').slice(0, 20) || 'tipo';
  const usados = new Set(existentes);
  if (!usados.has(base) && base.length >= 2) return base;
  for (let n = 2; n < 100; n += 1) { const c = `${base.slice(0, 20)}_${n}`; if (!usados.has(c)) return c; }
  return `${base.slice(0, 16)}_${Date.now() % 10000}`;
}
