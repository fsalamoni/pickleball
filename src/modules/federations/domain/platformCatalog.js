/**
 * Configuração geral das federações no painel do admin da plataforma (Etapa 5
 * do cadastro estruturado, 2026-10-22), ao lado dos tipos de filiação
 * (`memberTypes.js`). Tudo mora em `platform_settings/federations` (só o admin
 * da plataforma escreve, todo mundo lê) e nada aqui obriga a federação: são
 * PONTOS DE PARTIDA que ela copia e muda à vontade.
 *
 * - `doc_kinds[]`: documentos que a plataforma SUGERE aos planos (exame de
 *   vista, estatuto social, cartão CNPJ…). O plano copia o nome para os seus
 *   documentos próprios (`other_docs[]`), então mudar ou tirar uma sugestão
 *   não mexe em plano nenhum.
 * - `tournament_tier_templates[]`: modelos de categorias de torneio que a
 *   federação copia ao criar as suas (`{SIGLA}` vira a sigla dela).
 * - `default_modules`: os módulos que já nascem ligados quando a federação é
 *   aprovada pela primeira vez (o servidor aplica, em `federationReview`).
 */
import { t, tk } from '@/core/i18n';
import { FED_MODULE_META } from './constants.js';
import { availableModules } from './federation.js';
import { TIER_MAX, normalizeTier, validateTiers } from './officialRanking.js';

const texto = (v, max) => String(v == null ? '' : v).trim().slice(0, max);

/* ------------------------------------------------- documentos sugeridos -- */

/** Para quem o documento serve: pessoa, entidade (clube e arena) ou ambos. */
export const DOC_SCOPE = Object.freeze({ PERSON: 'person', ORG: 'org', ALL: 'all' });
export const DOC_SCOPE_LABELS = Object.freeze({ person: tk('Pessoas'), org: tk('Clubes e arenas'), all: tk('Todos') });
/** Curto o bastante para caber em `c_<id>`, o id do documento no plano (≤ 24). */
export const DOC_KIND_ID_RE = /^[a-z][a-z0-9_]{1,20}$/;
export const DOC_KINDS_MAX = 40;

export const DEFAULT_DOC_KINDS = Object.freeze([
  { id: 'foto_3x4', label: tk('Foto 3x4'), scope: 'person' },
  { id: 'ficha_assinada', label: tk('Ficha de filiação assinada'), scope: 'person' },
  { id: 'termo_imagem', label: tk('Termo de responsabilidade e uso de imagem'), scope: 'person' },
  { id: 'exame_vista', label: tk('Exame de vista'), scope: 'person' },
  { id: 'registro_cref', label: tk('Registro no CREF'), scope: 'person' },
  { id: 'certificado_arbitro', label: tk('Certificado de curso de arbitragem'), scope: 'person' },
  { id: 'estatuto_social', label: tk('Estatuto social'), scope: 'org' },
  { id: 'cartao_cnpj', label: tk('Cartão CNPJ'), scope: 'org' },
  { id: 'ata_eleicao', label: tk('Ata de eleição da diretoria'), scope: 'org' },
  { id: 'alvara', label: tk('Alvará de funcionamento'), scope: 'org' },
  { id: 'endereco_sede', label: tk('Comprovante de endereço da sede'), scope: 'org' },
]);

/** As sugestões em uso: as gravadas pelo admin, ou as padrão se ele nunca salvou. */
export function docKindsCatalog(settings) {
  if (!Array.isArray(settings?.doc_kinds)) return DEFAULT_DOC_KINDS.map((d) => ({ ...d, label: t(d.label), active: true }));
  const vistos = new Set();
  return settings.doc_kinds
    .filter((d) => d && DOC_KIND_ID_RE.test(String(d.id || '')) && texto(d.label, 80).length >= 2 && !vistos.has(d.id) && vistos.add(d.id))
    .map((d) => ({ id: d.id, label: texto(d.label, 80), scope: Object.values(DOC_SCOPE).includes(d.scope) ? d.scope : DOC_SCOPE.ALL, active: d.active !== false }))
    .slice(0, DOC_KINDS_MAX);
}

/** Um id novo a partir do nome, sem repetir. */
export function suggestDocKindId(label, existentes = []) {
  const base = (String(label || 'documento').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^[^a-z]+|_+$/g, '').slice(0, 18)) || 'documento';
  const usados = new Set(existentes);
  let id = base.length >= 2 ? base : `doc_${base}`;
  for (let i = 2; usados.has(id); i += 1) id = `${base.slice(0, 18)}_${i}`;
  return id;
}

/** Confere a lista antes de gravar: nome com 2+ letras, sem repetir id nem nome. */
export function validateDocKinds(list = []) {
  const errors = {};
  if (!Array.isArray(list)) return { ok: false, errors: { list: t('Lista inválida.') }, value: [] };
  if (list.length > DOC_KINDS_MAX) errors.list = t('No máximo {n} documentos.', { n: DOC_KINDS_MAX });
  const ids = new Set();
  const nomes = new Set();
  const value = list.map((d, i) => {
    const id = String(d?.id || '');
    const label = texto(d?.label, 80);
    if (!DOC_KIND_ID_RE.test(id)) errors[`id_${i}`] = t('Use de 2 a 21 letras minúsculas, números ou _, começando por letra.');
    else if (ids.has(id)) errors[`id_${i}`] = t('Código repetido.');
    ids.add(id);
    if (label.length < 2) errors[`label_${i}`] = t('Dê um nome ao documento.');
    else if (nomes.has(label.toLowerCase())) errors[`label_${i}`] = t('Já existe um documento com este nome.');
    nomes.add(label.toLowerCase());
    return { id, label, scope: Object.values(DOC_SCOPE).includes(d?.scope) ? d.scope : DOC_SCOPE.ALL, active: d?.active !== false };
  });
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/**
 * O que oferecer como atalho no plano: sugestões ligadas, do público certo, e
 * que o plano ainda não pede (pelo nome). Vira `{ id: 'c_<id>', label }` —
 * o mesmo formato dos documentos próprios.
 */
export function docSuggestions(catalog, { entidade = false, atuais = [] } = {}) {
  const ja = new Set((atuais || []).map((x) => texto(x?.label, 80).toLowerCase()).filter(Boolean));
  return (catalog || [])
    .filter((d) => d.active && (d.scope === DOC_SCOPE.ALL || d.scope === (entidade ? DOC_SCOPE.ORG : DOC_SCOPE.PERSON)) && !ja.has(d.label.toLowerCase()))
    .map((d) => ({ id: `c_${d.id}`, label: d.label }));
}

/* ------------------------------------------- modelos de categorias -- */

export const TIER_TEMPLATE_ID_RE = /^[a-z][a-z0-9_]{1,30}$/;
export const TIER_TEMPLATES_MAX = 12;
/** Na sigla e no nome, `{SIGLA}` vira a sigla da federação ao copiar. */
export const ACRONYM_TOKEN = '{SIGLA}';

const tabela = (...pontos) => Object.fromEntries(pontos.map((p, i) => [i + 1, p]));

export const DEFAULT_TIER_TEMPLATES = Object.freeze([
  {
    id: 'circuito_3_grupos',
    name: tk('Circuito em três grupos'),
    description: tk('Três tamanhos de torneio, do maior ao menor, no padrão dos circuitos: 1000, 500 e 250 pontos ao campeão.'),
    tiers: [
      { id: 'g1', code: '{SIGLA} 1000', group: 'G1', name: tk('Grupo 1'), points_by_place: tabela(1000, 600, 360, 360, 180, 180, 180, 180), participation: 10, requirements: { min_entrants: 32 } },
      { id: 'g2', code: '{SIGLA} 500', group: 'G2', name: tk('Grupo 2'), points_by_place: tabela(500, 300, 180, 180, 90, 90, 90, 90), participation: 5, requirements: { min_entrants: 16 } },
      { id: 'g3', code: '{SIGLA} 250', group: 'G3', name: tk('Grupo 3'), points_by_place: tabela(250, 150, 90, 90, 45, 45, 45, 45), participation: 3, requirements: { min_entrants: 8 } },
    ],
  },
  {
    id: 'estadual_e_etapas',
    name: tk('Campeonato estadual e etapas'),
    description: tk('O campeonato principal do ano vale o dobro das etapas do circuito, e os torneios abertos valem a metade de uma etapa.'),
    tiers: [
      { id: 'estadual', code: '{SIGLA} 2000', group: 'G1', name: tk('Campeonato estadual'), points_by_place: tabela(2000, 1200, 720, 720, 360, 360, 360, 360), participation: 20, requirements: { min_entrants: 16 } },
      { id: 'etapa', code: '{SIGLA} 1000', group: 'G2', name: tk('Etapa do circuito'), points_by_place: tabela(1000, 600, 360, 360, 180, 180, 180, 180), participation: 10, requirements: { min_entrants: 12 } },
      { id: 'aberto', code: '{SIGLA} 500', group: 'G3', name: tk('Torneio aberto'), points_by_place: tabela(500, 300, 180, 180, 90, 90, 90, 90), participation: 5, requirements: { min_entrants: 8 } },
    ],
  },
]);

/** Um modelo saneado (categorias válidas pela régua das categorias). */
function normalizeTemplate(m) {
  if (!m || !TIER_TEMPLATE_ID_RE.test(String(m.id || ''))) return null;
  const vistos = new Set();
  const tiers = (Array.isArray(m.tiers) ? m.tiers : []).map(normalizeTier).filter((tt) => tt && !vistos.has(tt.id) && vistos.add(tt.id)).slice(0, TIER_MAX)
    .map(({ legacy, ...tt }) => tt); // eslint-disable-line no-unused-vars
  return { id: m.id, name: texto(m.name, 80), description: texto(m.description, 300), tiers, active: m.active !== false };
}

/** Os modelos em uso: os gravados pelo admin, ou os padrão se ele nunca salvou. */
export function tierTemplatesCatalog(settings) {
  const fonte = Array.isArray(settings?.tournament_tier_templates)
    ? settings.tournament_tier_templates
    : DEFAULT_TIER_TEMPLATES.map((m) => ({ ...m, name: t(m.name), description: t(m.description), tiers: m.tiers.map((tt) => ({ ...tt, name: t(tt.name) })) }));
  const vistos = new Set();
  return fonte.map(normalizeTemplate).filter((m) => m && m.tiers.length && !vistos.has(m.id) && vistos.add(m.id)).slice(0, TIER_TEMPLATES_MAX);
}

/** Confere os modelos antes de gravar: nome, e categorias pela mesma régua da federação. */
export function validateTierTemplates(list = []) {
  const errors = {};
  if (!Array.isArray(list)) return { ok: false, errors: { list: t('Lista inválida.') }, value: [] };
  if (list.length > TIER_TEMPLATES_MAX) errors.list = t('No máximo {n} modelos.', { n: TIER_TEMPLATES_MAX });
  const ids = new Set();
  const value = list.map((m, i) => {
    const n = normalizeTemplate(m);
    if (!n) { errors[`id_${i}`] = t('Código inválido.'); return null; }
    if (ids.has(n.id)) errors[`id_${i}`] = t('Código repetido.');
    ids.add(n.id);
    if (n.name.length < 3) errors[`name_${i}`] = t('Dê um nome ao modelo.');
    const r = validateTiers(n.tiers);
    if (!r.ok) errors[`tiers_${i}`] = r.geral || t('Confira as categorias do modelo.');
    return n;
  }).filter(Boolean);
  return { ok: Object.keys(errors).length === 0, errors, value };
}

/**
 * As categorias de um modelo, prontas para a federação: `{SIGLA}` trocado
 * pela sigla dela (sem sigla, some com o espaço). Os ids vêm do modelo; quem
 * copia parte de uma lista vazia, então não há colisão.
 */
export function applyTierTemplate(template, { acronym = '' } = {}) {
  const sigla = texto(acronym, 12);
  const troca = (s) => texto(String(s || '').split(ACRONYM_TOKEN).join(sigla).replace(/\s+/g, ' '), 80);
  return (template?.tiers || []).map((tt) => normalizeTier({ ...tt, code: troca(tt.code).slice(0, 24), name: troca(tt.name), active: true })).filter(Boolean);
}

/* --------------------------------------------------- módulos iniciais -- */

/**
 * Os módulos que nascem ligados: só os disponíveis, e o que depende de outro
 * leva o outro junto (ranking oficial exige torneios chancelados). Ausente,
 * nenhum — como sempre foi.
 */
export function normalizeDefaultModules(raw = {}) {
  const disponiveis = availableModules();
  const ligados = new Set(disponiveis.filter((k) => raw?.[k] === true));
  [...ligados].forEach((k) => { const req = FED_MODULE_META[k]?.requires; if (req && disponiveis.includes(req)) ligados.add(req); });
  return Object.fromEntries(disponiveis.map((k) => [k, ligados.has(k)]));
}

export const defaultModulesFrom = (settings) => normalizeDefaultModules(settings?.default_modules || {});
