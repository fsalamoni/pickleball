/**
 * O que as telas de CONTEÚDO do treino mostram — Biblioteca, Meus, Recebidos
 * e a ficha do item — decidido aqui, longe do React, para ser testado.
 *
 * Nada aqui busca dado: recebe as listas que os hooks já trouxeram e devolve
 * o recorte, a ordem e as frases. A regra de negócio (quem vê, quem edita,
 * revisão) continua em `modules/training/domain`; isto é só apresentação.
 */

import {
  filterItems, normalizeItemInput, sortLibrary, sortRecent, timeMs,
} from '@/modules/training/domain/trainingItem';
import { ITEM_KINDS, PLACES, isValidSkill } from '@/modules/training/domain/taxonomy';
import { REVIEW, VISIBILITY } from '@/modules/training/domain/visibility';
import { SHARE_KIND, sortInbox } from '@/modules/training/domain/share';
import { formatDayLabel, toISODate, todayLocal } from '@/modules/training/domain/dates';
import { instanteEmMs } from '@/core/domain/instant';

// ── Biblioteca ──────────────────────────────────────────────────────────

/** Chave do filtro → nome do parâmetro na URL (`/treino?aba=biblioteca&tipo=drill…`). */
export const LIBRARY_PARAMS = Object.freeze({
  text: 'q', kind: 'tipo', skill: 'habilidade', level: 'nivel', players: 'jogadores',
  place: 'local', maxMinutes: 'tempo', origin: 'origem', saved: 'salvos',
});

/** `nivel=meu`: "do meu nível", resolvido na hora pelo nível unificado da pessoa. */
export const MY_LEVEL = 'meu';

/** Origem em uma palavra (o filtro usa as mesmas). */
export const ORIGIN_LABELS = Object.freeze({ plataforma: 'PickleRush', professor: 'Professores', atleta: 'Comunidade' });

const EMPTY_FILTERS = Object.freeze({
  text: '', kind: '', skill: '', level: null, players: null, place: '', maxMinutes: null, origin: '', saved: false,
});

/** Lê os filtros da URL; valor desconhecido é ignorado (link velho não quebra a tela). */
export function libraryFiltersFromParams(params) {
  const get = (k) => String(params?.get?.(k) ?? '').trim();
  const num = (k, min, max) => {
    const raw = get(k);
    if (!raw) return null;
    const n = Number(raw.replace(',', '.'));
    return Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  const nivel = get(LIBRARY_PARAMS.level);
  const kind = get(LIBRARY_PARAMS.kind);
  const skill = get(LIBRARY_PARAMS.skill);
  const place = get(LIBRARY_PARAMS.place);
  const origin = get(LIBRARY_PARAMS.origin);
  return {
    text: get(LIBRARY_PARAMS.text).slice(0, 80),
    kind: ITEM_KINDS.includes(kind) ? kind : '',
    skill: isValidSkill(skill) ? skill : '',
    level: nivel === MY_LEVEL ? MY_LEVEL : num(LIBRARY_PARAMS.level, 2, 8),
    players: num(LIBRARY_PARAMS.players, 1, 8),
    place: PLACES.includes(place) ? place : '',
    maxMinutes: num(LIBRARY_PARAMS.maxMinutes, 1, 240),
    origin: Object.prototype.hasOwnProperty.call(ORIGIN_LABELS, origin) ? origin : '',
    saved: get(LIBRARY_PARAMS.saved) === '1',
  };
}

/** Os filtros como extras de `irPara('biblioteca', …)` (vazio some da URL). */
export function libraryParams(filters = {}) {
  const f = { ...EMPTY_FILTERS, ...filters };
  const out = {};
  for (const [key, param] of Object.entries(LIBRARY_PARAMS)) {
    const v = f[key];
    if (key === 'saved') out[param] = v ? '1' : '';
    else out[param] = v === null || v === undefined ? '' : String(v);
  }
  return out;
}

export function hasActiveFilters(filters = {}) {
  const f = { ...EMPTY_FILTERS, ...filters };
  return Object.keys(EMPTY_FILTERS).some((k) => (k === 'saved' ? f.saved : f[k] !== '' && f[k] !== null));
}

/** "Do meu nível" vira o número; nível desconhecido vira `null` (não esconde nada). */
export function resolveLevel(level, myLevel) {
  if (level === MY_LEVEL) return Number.isFinite(myLevel) ? myLevel : null;
  return Number.isFinite(level) ? level : null;
}

/**
 * Monta a biblioteca: destaques da equipe no topo, depois os itens dos meus
 * professores, depois o resto. Um item aparece num lugar só.
 *
 * @returns {{ destaques: object[], professores: object[], demais: object[], total: number }}
 */
export function buildLibrary({ publicItems = [], coachItems = [], filters = {}, myLevel = null, favorites = [] } = {}) {
  const byId = new Map();
  for (const it of [...publicItems, ...coachItems]) if (it?.id) byId.set(it.id, it);
  const doProfessor = new Set(coachItems.map((i) => i?.id));
  let todos = [...byId.values()];
  if (filters.saved) {
    const fav = new Set(favorites);
    todos = todos.filter((i) => fav.has(i.id));
  }
  const f = filterItems(todos, {
    ...filters,
    level: resolveLevel(filters.level, myLevel),
    players: Number.isFinite(filters.players) ? filters.players : null,
    maxMinutes: Number.isFinite(filters.maxMinutes) ? filters.maxMinutes : null,
  });
  return {
    destaques: sortLibrary(f.filter((i) => i.featured && !doProfessor.has(i.id))),
    professores: sortRecent(f.filter((i) => doProfessor.has(i.id))),
    demais: sortLibrary(f.filter((i) => !i.featured && !doProfessor.has(i.id))),
    total: f.length,
  };
}

// ── Meus ────────────────────────────────────────────────────────────────

export const MY_STATES = Object.freeze(['rascunho', 'alunos', 'revisao', 'aprovado', 'recusado', 'oculto']);
export const MY_STATE_LABELS = Object.freeze({
  rascunho: 'Só eu',
  alunos: 'Meus alunos',
  revisao: 'Em revisão',
  aprovado: 'Publicado',
  recusado: 'Não aprovado',
  oculto: 'Oculto pela equipe',
});

/** Em que estado está um item meu (o filtro da lista "Meus"). */
export function myItemState(item = {}) {
  if (item.hidden === true) return 'oculto';
  if (item.visibility === VISIBILITY.ALUNOS) return 'alunos';
  if (item.visibility !== VISIBILITY.PUBLICO) return 'rascunho';
  if (item.review === REVIEW.APROVADO) return 'aprovado';
  if (item.review === REVIEW.RECUSADO) return 'recusado';
  return 'revisao';
}

export function countByState(items = []) {
  const out = Object.fromEntries(MY_STATES.map((s) => [s, 0]));
  for (const it of items) out[myItemState(it)] += 1;
  return out;
}

/** Itens esperando revisão × o limite da plataforma. */
export function pendingInfo(items = [], settings = {}) {
  const limite = Number(settings.max_pending_per_user) || 5;
  const pendentes = items.filter((i) => i.review === REVIEW.PENDENTE && i.hidden !== true).length;
  return { pendentes, limite, cheio: pendentes >= limite };
}

// ── Recebidos e enviados ───────────────────────────────────────────────

/** Do professor primeiro (prazo mais perto antes), depois indicações, concluídos no fim. */
export function inboxGroups(shares = []) {
  const ordem = sortInbox(shares);
  return {
    professor: ordem.filter((s) => !s.done_at && s.kind === SHARE_KIND.ALUNO),
    indicacoes: ordem.filter((s) => !s.done_at && s.kind !== SHARE_KIND.ALUNO),
    feitos: ordem.filter((s) => !!s.done_at),
  };
}

/**
 * O item de um envio ainda abre? Só se AFIRMA "indisponível" com todas as
 * fontes carregadas e completas — consulta que falhou não vira "sumiu".
 * @param {{ item_id: string }} share
 * @param {{ byId?: object, isLoading?: boolean, isError?: boolean, incompleto?: boolean }} visible
 * @returns {'ok'|'indisponivel'|'desconhecido'}
 */
export function shareAvailability(share = {}, visible = {}) {
  if (visible.byId?.[share.item_id]) return 'ok';
  if (visible.isLoading || visible.isError || visible.incompleto) return 'desconhecido';
  return 'indisponivel';
}

export const SENT_STATE_LABELS = Object.freeze({ enviado: 'Enviado', visto: 'Visto', feito: 'Feito' });

export function sentState(share = {}) {
  if (share.done_at) return 'feito';
  if (share.read_at) return 'visto';
  return 'enviado';
}

/** O que mandei, agrupado por item (o mais recente primeiro). */
export function groupSent(shares = []) {
  const grupos = new Map();
  for (const s of shares) {
    const g = grupos.get(s.item_id) || { itemId: s.item_id, title: s.item_title || 'Item', kind: s.item_kind || '', shares: [], last: 0 };
    g.shares.push(s);
    g.last = Math.max(g.last, timeMs(s.created_at));
    grupos.set(s.item_id, g);
  }
  return [...grupos.values()]
    .map((g) => ({
      ...g,
      shares: [...g.shares].sort((a, b) => timeMs(b.created_at) - timeMs(a.created_at)),
      done: g.shares.filter((s) => s.done_at).length,
      total: g.shares.length,
    }))
    .sort((a, b) => b.last - a.last);
}

/** "Qua, 08/10" de um instante do banco; '' se não há instante (ainda gravando). */
export function dayOf(ts, today = todayLocal()) {
  const ms = instanteEmMs(ts);
  return Number.isFinite(ms) ? formatDayLabel(toISODate(new Date(ms)), today) : '';
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** O resultado de `shareItem` em pt-BR. */
export function shareResultText({ sent = 0, skipped = 0, failed = 0, notified = 0 } = {}, { kind = SHARE_KIND.INDICACAO } = {}) {
  const aluno = kind === SHARE_KIND.ALUNO;
  const partes = [];
  if (sent > 0) partes.push(`${aluno ? 'Enviado a' : 'Indicado a'} ${plural(sent, aluno ? 'aluno' : 'pessoa', aluno ? 'alunos' : 'pessoas')}.`);
  else if (skipped > 0 && failed === 0) partes.push('Ninguém recebeu de novo: todos já tinham este item em aberto.');
  if (skipped > 0 && sent > 0) {
    partes.push(skipped === 1 ? '1 já tinha este item em aberto e não recebeu de novo.' : `${skipped} já tinham este item em aberto e não receberam de novo.`);
  }
  if (failed > 0) partes.push(failed === 1 ? '1 envio não saiu — tente de novo.' : `${failed} envios não saíram — tente de novo.`);
  if (sent > 0 && notified < sent) {
    const sem = sent - notified;
    partes.push(`${sem === 1 ? '1 pessoa não recebeu' : `${sem} pessoas não receberam`} o aviso, mas o item já está em Recebidos.`);
  }
  return partes.join(' ');
}

// ── Ficha ───────────────────────────────────────────────────────────────

/** Os nomes das seções da ficha, para o índice "Nesta ficha". */
export const SECTION_TITLES = Object.freeze({
  diagramas: 'Diagrama', objetivo: 'Objetivo', quando: 'Quando usar', pratica: 'Para praticar',
  seguranca: 'Segurança', blocos: 'Blocos', fisico: 'Séries', montagem: 'Montagem', passos: 'Passo a passo',
  tecnica: 'O corpo, ponto a ponto', dicas: 'Dicas', certoErrado: 'Certo e errado', erros: 'Erros comuns',
  autoavaliacao: 'Fiz certo?', motor: 'O movimento', variacoes: 'Variações', meta: 'Meta', estudo: 'Para estudar',
  midia: 'Fotos e vídeos', conteudo: 'Conteúdo',
});

/** A ficha é longa o bastante para um índice no topo? */
export const INDEX_MIN_SECTIONS = 6;

/**
 * A ficha a partir do item: o conteúdo normalizado (o que o banco tem de
 * fora do formato some, nunca vira HTML) e as seções que TÊM conteúdo, na
 * ordem de leitura. Seção sem conteúdo não entra — nunca uma seção vazia.
 */
export function itemView(item = {}) {
  const v = normalizeItemInput(item || {}).value;
  const certos = v.positioning.filter((p) => p.type === 'certo');
  const errados = v.positioning.filter((p) => p.type === 'errado');
  const mediaCerto = v.media.filter((m) => m.tag === 'certo');
  const mediaErrado = v.media.filter((m) => m.tag === 'errado');
  const mediaDemo = v.media.filter((m) => m.tag !== 'certo' && m.tag !== 'errado');
  const legado = item?.legacy === true;
  const body = legado ? String(item.body ?? '').trim() : '';
  const fase = v.motor.phases;
  const tem = {
    diagramas: v.diagrams.length > 0,
    objetivo: !!v.objective,
    quando: !!v.when_to_use,
    pratica: v.skills.length > 0 || v.place.length > 0 || v.equipment.length > 0 || v.intensity !== null
      || !!v.practice_mode || v.roles.length > 0,
    seguranca: !!v.safety,
    blocos: v.blocks.length > 0,
    fisico: !!(v.sets || v.reps || v.rest_sec || v.tempo),
    montagem: !!v.setup,
    passos: v.steps.length > 0,
    tecnica: v.technique.checkpoints.length > 0,
    dicas: v.cues.length > 0,
    certoErrado: certos.length + errados.length + mediaCerto.length + mediaErrado.length > 0,
    erros: v.common_errors.length > 0,
    autoavaliacao: v.technique.self_check.length > 0,
    motor: !!(fase.preparacao || fase.execucao || fase.finalizacao) || v.motor.abilities.length > 0,
    variacoes: !!(v.variations.easier || v.variations.harder),
    meta: !!(v.success_criteria || v.metric.type),
    estudo: !!(v.link || v.rules_edition || v.rules_section || v.questions.length),
    midia: mediaDemo.length > 0,
    conteudo: !!body,
  };
  return {
    v,
    certos,
    errados,
    mediaCerto,
    mediaErrado,
    mediaDemo,
    body,
    // O resumo do conteúdo antigo é o começo do próprio texto: com o texto inteiro na ficha, repetiria.
    resumo: body ? '' : v.summary,
    sections: Object.keys(tem).filter((k) => tem[k]),
  };
}
