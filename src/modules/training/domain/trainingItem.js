/**
 * O MODELO PADRÃO de um item de treino (drill, treino, fundamento, jogada,
 * físico, estudo) e a sua validação. Uma forma só para todos os autores —
 * plataforma, professor e atleta — e para a IA.
 *
 * `normalizeItemInput` é a fonte única do que é gravado: a tela, a importação
 * em JSON, a biblioteca inicial e o serviço passam todos por aqui. O que a
 * regra do Firestore confere (tamanhos, imutáveis, revisão) está espelhado.
 */

import {
  ITEM_KINDS, ITEM_KIND, isValidSkill, PLACES, EQUIPMENT, MOTOR_ABILITIES,
  BLOCK_TYPES, METRIC_TYPES, STUDY_TYPES, PRACTICE_MODES, LEVEL_MIN, LEVEL_MAX, TECHNIQUE_PARTS,
} from './taxonomy.js';
import { normalizeDiagrams } from './diagram.js';
import { normalizeMediaList } from './media.js';
import { VISIBILITY } from './visibility.js';
import { safeHttpUrl } from '@/core/domain/externalUrl';

export const ITEM_LIMITS = Object.freeze({
  title: 120, summary: 280, objective: 300, setup: 1000, step: 300, steps: 15,
  cue: 120, cues: 8, positioning: 8, positioningText: 300, errors: 8, error: 200, fix: 300,
  variation: 400, success: 300, metricTarget: 60, safety: 400, phase: 300, abilities: 6,
  skills: 6, roles: 6, role: 40, equipment: 10, blocks: 12, blockTitle: 80, blockNotes: 300,
  questions: 6, question: 200, whenToUse: 400, link: 500, rulesEdition: 40, rulesSection: 60,
  reps: 40, tempo: 40, sharedUids: 50, checkpoints: 8, checkpoint: 300, selfChecks: 6, selfCheck: 200,
});

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const int = (v, min, max) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
};
const strList = (list, maxItems, maxLen) => (Array.isArray(list) ? list : [])
  .map((s) => str(s, maxLen))
  .filter(Boolean)
  .slice(0, maxItems);
const oneOf = (list, v, def = null) => (list.includes(v) ? v : def);
const enumList = (list, allowed, max) => [...new Set((Array.isArray(list) ? list : []).filter((v) => allowed.includes(v)))].slice(0, max);

/** Nível na régua 2.0–8.0 (uma casa) ou `null`. */
export function normalizeLevel(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, n)) * 10) / 10;
}

/** Item em branco para o editor. */
export function blankItem(kind = ITEM_KIND.DRILL) {
  return {
    kind: oneOf(ITEM_KINDS, kind, ITEM_KIND.DRILL),
    title: '', summary: '', objective: '',
    skills: [], level_min: null, level_max: null,
    players_min: null, players_max: null, roles: [],
    duration_min: null, intensity: null, place: [], practice_mode: '', equipment: [],
    setup: '', steps: [], cues: [], positioning: [], common_errors: [],
    variations: { easier: '', harder: '' },
    success_criteria: '', metric: { type: '', target: '' }, safety: '',
    motor: { phases: { preparacao: '', execucao: '', finalizacao: '' }, abilities: [] },
    technique: { checkpoints: [], self_check: [] },
    blocks: [], sets: null, reps: '', rest_sec: null, tempo: '',
    study_type: '', rules_edition: '', rules_section: '', questions: [], link: '',
    when_to_use: '', diagrams: [], media: [],
    visibility: VISIBILITY.PRIVADO,
  };
}

function normalizeBlocks(list) {
  return (Array.isArray(list) ? list : []).map((b) => {
    const type = oneOf(BLOCK_TYPES, b?.type, null);
    const title = str(b?.title, ITEM_LIMITS.blockTitle);
    if (!type || !title) return null;
    return {
      type,
      title,
      duration_min: int(b?.duration_min, 0, 240),
      item_id: str(b?.item_id, 64) || null,
      notes: str(b?.notes, ITEM_LIMITS.blockNotes),
    };
  }).filter(Boolean).slice(0, ITEM_LIMITS.blocks);
}

/**
 * Normaliza e valida o CONTEÚDO de um item (o que o autor escreve).
 * Não trata autoria nem revisão — isso é do serviço.
 *
 * @returns {{ valid: boolean, errors: Record<string,string>, value: object }}
 */
export function normalizeItemInput(input = {}) {
  const errors = {};
  const kind = oneOf(ITEM_KINDS, input.kind, null);
  if (!kind) errors.kind = 'Escolha o tipo.';

  const title = str(input.title, ITEM_LIMITS.title);
  if (title.length < 3) errors.title = 'Dê um nome com pelo menos 3 letras.';
  const summary = str(input.summary, ITEM_LIMITS.summary);
  if (summary.length < 10) errors.summary = 'Escreva um resumo de uma ou duas frases.';

  let level_min = normalizeLevel(input.level_min);
  let level_max = normalizeLevel(input.level_max);
  if (level_min !== null && level_max !== null && level_min > level_max) [level_min, level_max] = [level_max, level_min];

  let players_min = int(input.players_min, 1, 8);
  let players_max = int(input.players_max, 1, 8);
  if (players_min !== null && players_max !== null && players_min > players_max) [players_min, players_max] = [players_max, players_min];

  const positioning = (Array.isArray(input.positioning) ? input.positioning : []).map((p) => {
    const text = str(p?.text, ITEM_LIMITS.positioningText);
    return text ? { type: p?.type === 'errado' ? 'errado' : 'certo', text } : null;
  }).filter(Boolean).slice(0, ITEM_LIMITS.positioning);

  const common_errors = (Array.isArray(input.common_errors) ? input.common_errors : []).map((e) => {
    const error = str(e?.error, ITEM_LIMITS.error);
    const fix = str(e?.fix, ITEM_LIMITS.fix);
    return error ? { error, fix } : null;
  }).filter(Boolean).slice(0, ITEM_LIMITS.errors);

  const metricType = oneOf(METRIC_TYPES, input.metric?.type, '');
  const metric = { type: metricType, target: metricType ? str(input.metric?.target, ITEM_LIMITS.metricTarget) : '' };

  const phases = input.motor?.phases || {};
  const motor = {
    phases: {
      preparacao: str(phases.preparacao, ITEM_LIMITS.phase),
      execucao: str(phases.execucao, ITEM_LIMITS.phase),
      finalizacao: str(phases.finalizacao, ITEM_LIMITS.phase),
    },
    abilities: enumList(input.motor?.abilities, MOTOR_ABILITIES, ITEM_LIMITS.abilities),
  };

  // A técnica ponto a ponto (fundamento/jogada): cada parte do gesto e como
  // saber, pelo que a bola faz, se saiu certo. Opcional para todo tipo.
  const technique = {
    checkpoints: (Array.isArray(input.technique?.checkpoints) ? input.technique.checkpoints : []).map((c) => {
      const part = oneOf(TECHNIQUE_PARTS, c?.part, null);
      const text = str(c?.text, ITEM_LIMITS.checkpoint);
      return part && text ? { part, text } : null;
    }).filter(Boolean).slice(0, ITEM_LIMITS.checkpoints),
    self_check: strList(input.technique?.self_check, ITEM_LIMITS.selfChecks, ITEM_LIMITS.selfCheck),
  };

  const study_type = kind === ITEM_KIND.ESTUDO ? oneOf(STUDY_TYPES, input.study_type, 'leitura') : '';
  const rules_edition = kind === ITEM_KIND.ESTUDO ? str(input.rules_edition, ITEM_LIMITS.rulesEdition) : '';
  if (study_type === 'regra' && !rules_edition) {
    errors.rules_edition = 'Diga de qual edição do regulamento é a regra (ex.: "USA Pickleball 2026").';
  }
  const rawLink = str(input.link, ITEM_LIMITS.link);
  const safeLink = rawLink ? safeHttpUrl(rawLink, { maxLength: ITEM_LIMITS.link }) : '';
  const link = safeLink.startsWith('https://') ? safeLink : '';
  if (rawLink && !link) errors.link = 'Use um link que comece com https://';

  const blocks = kind === ITEM_KIND.TREINO ? normalizeBlocks(input.blocks) : [];
  if (kind === ITEM_KIND.TREINO && blocks.length === 0) errors.blocks = 'Um treino precisa de pelo menos um bloco.';

  const steps = strList(input.steps, ITEM_LIMITS.steps, ITEM_LIMITS.step);
  if ((kind === ITEM_KIND.DRILL || kind === ITEM_KIND.FISICO) && steps.length === 0) {
    errors.steps = 'Escreva o passo a passo (pelo menos um passo).';
  }

  const value = {
    kind: kind || ITEM_KIND.DRILL,
    title,
    summary,
    objective: str(input.objective, ITEM_LIMITS.objective),
    skills: [...new Set((Array.isArray(input.skills) ? input.skills : []).filter(isValidSkill))].slice(0, ITEM_LIMITS.skills),
    level_min,
    level_max,
    players_min,
    players_max,
    roles: strList(input.roles, ITEM_LIMITS.roles, ITEM_LIMITS.role),
    duration_min: int(input.duration_min, 0, 240),
    intensity: int(input.intensity, 0, 10),
    place: enumList(input.place, PLACES, PLACES.length),
    practice_mode: oneOf(PRACTICE_MODES, input.practice_mode, ''),
    equipment: enumList(input.equipment, EQUIPMENT, ITEM_LIMITS.equipment),
    setup: str(input.setup, ITEM_LIMITS.setup),
    steps,
    cues: strList(input.cues, ITEM_LIMITS.cues, ITEM_LIMITS.cue),
    positioning,
    common_errors,
    variations: {
      easier: str(input.variations?.easier, ITEM_LIMITS.variation),
      harder: str(input.variations?.harder, ITEM_LIMITS.variation),
    },
    success_criteria: str(input.success_criteria, ITEM_LIMITS.success),
    metric,
    safety: str(input.safety, ITEM_LIMITS.safety),
    motor,
    technique,
    blocks,
    sets: kind === ITEM_KIND.FISICO ? int(input.sets, 0, 20) : null,
    reps: kind === ITEM_KIND.FISICO ? str(input.reps, ITEM_LIMITS.reps) : '',
    rest_sec: kind === ITEM_KIND.FISICO ? int(input.rest_sec, 0, 600) : null,
    tempo: kind === ITEM_KIND.FISICO ? str(input.tempo, ITEM_LIMITS.tempo) : '',
    study_type,
    rules_edition,
    rules_section: kind === ITEM_KIND.ESTUDO ? str(input.rules_section, ITEM_LIMITS.rulesSection) : '',
    questions: kind === ITEM_KIND.ESTUDO ? strList(input.questions, ITEM_LIMITS.questions, ITEM_LIMITS.question) : [],
    link,
    when_to_use: str(input.when_to_use, ITEM_LIMITS.whenToUse),
    diagrams: normalizeDiagrams(input.diagrams),
    media: normalizeMediaList(input.media),
  };

  return { valid: Object.keys(errors).length === 0, errors, value };
}

/**
 * Checklist de qualidade (o que a pesquisa diz que um bom drill tem). Não
 * bloqueia salvar: orienta o autor e ordena a biblioteca.
 * @returns {{ score: number, total: number, missing: string[] }}
 */
export function itemQuality(item = {}) {
  const checks = [];
  const add = (ok, label) => checks.push({ ok: !!ok, label });
  add(item.objective, 'Objetivo');
  add(item.skills?.length, 'Habilidades');
  add(item.level_min !== null && item.level_min !== undefined, 'Nível indicado');
  if (item.kind === ITEM_KIND.TREINO) {
    add(item.blocks?.length >= 3, 'Pelo menos 3 blocos');
    add(item.duration_min, 'Duração');
  } else if (item.kind === ITEM_KIND.ESTUDO) {
    add(item.link || item.media?.length, 'Link ou mídia');
    add(item.questions?.length, 'Perguntas para fixar');
  } else {
    add(item.steps?.length >= 2, 'Passo a passo');
    add(item.cues?.length, 'Dicas curtas');
    add(item.common_errors?.length, 'Erros comuns e correção');
    add(item.diagrams?.length || item.media?.length, 'Diagrama ou mídia');
    if (item.kind === ITEM_KIND.DRILL) {
      add(item.setup, 'Montagem');
      add(item.success_criteria || item.metric?.type, 'Meta ou critério de sucesso');
      add(item.variations?.easier || item.variations?.harder, 'Variações');
    }
    if (item.kind === ITEM_KIND.FUNDAMENTO || item.kind === ITEM_KIND.JOGADA) {
      // O errado só ensina AO LADO do certo (sozinho, atrapalha).
      const certos = (item.positioning || []).filter((p) => p.type === 'certo').length;
      const errados = (item.positioning || []).filter((p) => p.type === 'errado').length;
      add(certos > 0 && errados > 0 && certos >= errados, 'Certo e errado lado a lado');
      add(item.when_to_use, 'Quando usar');
    }
    if (item.kind === ITEM_KIND.FUNDAMENTO) add(item.technique?.checkpoints?.length, 'Técnica ponto a ponto');
    if (item.kind === ITEM_KIND.FISICO) add(item.sets || item.reps, 'Séries e repetições');
  }
  const ok = checks.filter((c) => c.ok).length;
  return { score: ok, total: checks.length, missing: checks.filter((c) => !c.ok).map((c) => c.label) };
}

/** Texto curto de duração/jogadores para o cartão. */
export function itemMetaLine(item = {}) {
  const partes = [];
  if (item.duration_min) partes.push(`${item.duration_min} min`);
  if (item.players_min) {
    partes.push(item.players_max && item.players_max !== item.players_min
      ? `${item.players_min}–${item.players_max} jogadores`
      : `${item.players_min} jogador${item.players_min > 1 ? 'es' : ''}`);
  }
  if (item.level_min) {
    const fmt = (n) => Number(n).toFixed(1).replace('.', ',');
    partes.push(item.level_max && item.level_max !== item.level_min ? `nível ${fmt(item.level_min)}–${fmt(item.level_max)}` : `nível ${fmt(item.level_min)}+`);
  }
  return partes.join(' · ');
}

/** O item serve para este nível? Nível desconhecido nunca esconde. */
export function fitsLevel(item = {}, level = null) {
  if (!Number.isFinite(level)) return true;
  if (Number.isFinite(item.level_min) && level < item.level_min - 0.25) return false;
  if (Number.isFinite(item.level_max) && level > item.level_max + 0.25) return false;
  return true;
}

/**
 * Filtra a biblioteca. Todos os filtros são opcionais.
 * @param {object[]} items
 * @param {{ text?: string, kind?: string, skill?: string, level?: number|null, players?: number|null,
 *   place?: string, maxMinutes?: number|null, origin?: string }} f
 */
export function filterItems(items = [], f = {}) {
  const q = normalizeText(f.text || '');
  return items.filter((it) => {
    if (f.kind && it.kind !== f.kind) return false;
    if (f.skill && !(it.skills || []).some((s) => s === f.skill || s.startsWith(`${f.skill}.`) || f.skill.startsWith(`${s}.`))) return false;
    if (Number.isFinite(f.level) && !fitsLevel(it, f.level)) return false;
    if (Number.isFinite(f.players)) {
      if (Number.isFinite(it.players_min) && f.players < it.players_min) return false;
      if (Number.isFinite(it.players_max) && f.players > it.players_max) return false;
    }
    if (f.place && (it.place || []).length && !(it.place || []).includes(f.place)) return false;
    if (Number.isFinite(f.maxMinutes) && Number.isFinite(it.duration_min) && it.duration_min > f.maxMinutes) return false;
    if (f.origin && it.author_role !== f.origin) return false;
    if (q) {
      const hay = normalizeText([it.title, it.summary, it.objective, it.author_name, ...(it.cues || [])].join(' '));
      if (!q.split(/\s+/).every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}

export function normalizeText(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const ms = (t) => {
  if (!t) return 0;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t.seconds === 'number') return t.seconds * 1000;
  if (typeof t === 'number') return t;
  return 0;
};

/** Ordem da biblioteca: destaques, depois qualidade, depois mais recente. */
export function sortLibrary(items = []) {
  return [...items].sort((a, b) => {
    if (!!b.featured !== !!a.featured) return b.featured ? 1 : -1;
    const qa = itemQuality(a); const qb = itemQuality(b);
    const ra = qa.total ? qa.score / qa.total : 0; const rb = qb.total ? qb.score / qb.total : 0;
    if (Math.abs(rb - ra) > 0.15) return rb - ra;
    return ms(b.updated_at || b.created_at) - ms(a.updated_at || a.created_at);
  });
}

export function sortRecent(items = []) {
  return [...items].sort((a, b) => ms(b.updated_at || b.created_at) - ms(a.updated_at || a.created_at));
}

export { ms as timeMs };

/**
 * Conteúdo antigo do professor (`coach_content`) no formato de item — só
 * leitura, sem migração. Aparece em "Dos meus professores".
 */
export function fromCoachContent(c = {}, coachName = '') {
  const kindByCategory = { drill: 'drill', dica: 'fundamento', tatica: 'jogada', condicionamento: 'fisico', outro: 'estudo' };
  const media = [];
  if (c.video_url) media.push({ type: 'video', source: 'url', url: c.video_url, caption: '', tag: 'demo' });
  const body = String(c.body || '').trim();
  return {
    id: `cc_${c.id}`,
    legacy: true,
    legacy_id: c.id,
    kind: kindByCategory[c.category] || 'estudo',
    title: str(c.title, ITEM_LIMITS.title),
    summary: body.slice(0, ITEM_LIMITS.summary),
    body,
    steps: [], cues: [], skills: [], positioning: [], common_errors: [], diagrams: [],
    media: normalizeMediaList(media),
    author_uid: c.coach_id,
    author_role: 'professor',
    author_name: coachName,
    visibility: c.visibility === 'students' ? VISIBILITY.ALUNOS : VISIBILITY.PUBLICO,
    review: 'aprovado',
    hidden: false,
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}

/** Itens novos contidos num treino (blocos que apontam para outros itens). */
export function linkedItemIds(item = {}) {
  return [...new Set((item.blocks || []).map((b) => b.item_id).filter(Boolean))];
}
