/**
 * O formulário do editor de itens de treino — as contas puras da tela.
 *
 * O formulário é o próprio item no formato de `blankItem` (+ `visibility`):
 * quem decide o que é gravado continua sendo `normalizeItemInput` (domínio),
 * que a tela chama para mostrar os erros e o serviço chama de novo ao gravar.
 * Aqui fica só o que é da TELA: que campo aparece em que tipo, o rascunho
 * local, a ordem dos erros, a mescla do que veio da IA e os arquivos
 * enviados que sobraram depois de salvar.
 */

import { blankItem } from '@/modules/training/domain/trainingItem';
import { ITEM_KINDS, LEVEL_MAX, LEVEL_MIN } from '@/modules/training/domain/taxonomy';
import { AUTHOR_ROLE, VISIBILITY, isAutoApproved, publishNotice } from '@/modules/training/domain/visibility';

const exceto = (...tipos) => ITEM_KINDS.filter((k) => !tipos.includes(k));
const GOLPE = ['drill', 'fundamento', 'jogada'];
const QUADRA = ['drill', 'fundamento', 'jogada', 'fisico'];

/**
 * Em que tipos cada campo do formulário costuma valer (pesquisa do modelo
 * padrão). Campo fora daqui vale para todos.
 */
export const FIELD_KINDS = Object.freeze({
  players_min: ['drill', 'treino', 'fundamento', 'jogada'],
  players_max: ['drill', 'treino', 'fundamento', 'jogada'],
  intensity: exceto('estudo'),
  place: exceto('estudo'),
  equipment: exceto('estudo'),
  practice_mode: GOLPE,
  setup: ['drill', 'jogada'],
  steps: exceto('treino'),
  cues: exceto('treino', 'estudo'),
  positioning: exceto('treino'),
  common_errors: QUADRA,
  motor: ['drill', 'fundamento', 'fisico'],
  technique: ['fundamento', 'jogada'],
  variations: QUADRA,
  metric: QUADRA,
  success_criteria: QUADRA,
  when_to_use: GOLPE,
  safety: exceto('estudo'),
  diagrams: ['drill', 'fundamento', 'jogada', 'estudo'],
  blocks: ['treino'],
  sets: ['fisico'],
  reps: ['fisico'],
  rest_sec: ['fisico'],
  tempo: ['fisico'],
  study_type: ['estudo'],
  rules_edition: ['estudo'],
  rules_section: ['estudo'],
  link: ['estudo'],
  questions: ['estudo'],
});

/** O valor tem algo escrito? (0 conta; texto em branco, lista vazia e objeto vazio não) */
export function temConteudo(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.values(v).some(temConteudo);
  return true;
}

/**
 * O campo aparece? Vale para o tipo — OU já tem conteúdo. A segunda parte é
 * de propósito: trocar o tipo, ou abrir um item importado, nunca ESCONDE algo
 * que vai ser gravado. O que a pessoa vê é o que vai para a ficha.
 */
export function campoVisivel(kind, campo, form = {}) {
  const tipos = FIELD_KINDS[campo];
  return !tipos || tipos.includes(kind) || temConteudo(form[campo]);
}

/**
 * As seções do formulário, na ordem de leitura da ficha. `porque` é a linha
 * que explica a técnica da seção (o que a pesquisa mostrou que funciona).
 */
export const EDITOR_SECTIONS = Object.freeze([
  {
    id: 'basico',
    titulo: 'Básico',
    porque: 'O que é, para quem serve e quanto tempo leva — é o que aparece no cartão da biblioteca.',
    campos: ['title', 'summary', 'objective', 'skills', 'level_min', 'players_min', 'duration_min', 'intensity', 'place', 'equipment', 'practice_mode'],
  },
  {
    id: 'como',
    titulo: 'Como fazer',
    porque: 'Escreva para quem chega na quadra sem você: onde cada um fica, os passos na ordem e uma ou duas dicas curtas.',
    campos: ['setup', 'steps', 'cues'],
  },
  {
    id: 'tecnica',
    titulo: 'O corpo, ponto a ponto',
    porque: 'Uma parte do corpo por linha — empunhadura, pés, pernas, tronco, braço, punho, raquete — e o que cada uma faz. Feche com 3 ou 4 sinais de que saiu certo, que a pessoa confere sozinha.',
    campos: ['technique'],
  },
  {
    id: 'blocos',
    titulo: 'Blocos do treino',
    porque: 'Aquecimento → técnica e tática → jogo (a maior parte) → volta à calma. Cada bloco pode apontar para um item da biblioteca.',
    campos: ['blocks'],
  },
  {
    id: 'fisico',
    titulo: 'Séries e repetições',
    porque: 'A receita completa — séries, repetições, descanso e ritmo — para repetir igual em casa ou na academia.',
    campos: ['sets', 'reps', 'rest_sec', 'tempo'],
  },
  {
    id: 'estudo',
    titulo: 'Estudo',
    porque: 'Regra muda todo ano: diga a edição. Perguntas de situação ("pode ou não pode?") fixam mais do que reler.',
    campos: ['study_type', 'rules_edition', 'rules_section', 'link', 'questions'],
  },
  {
    id: 'quando',
    titulo: 'Quando usar',
    porque: 'A situação de jogo em que isso aparece — sem ela, o treino não chega à partida.',
    campos: ['when_to_use'],
  },
  {
    id: 'certo',
    titulo: 'Certo × errado',
    porque: 'O errado só ensina AO LADO do certo — sozinho, ele fixa justamente o erro. Escreva o certo e, logo depois, o errado com o porquê.',
    campos: ['positioning'],
  },
  {
    id: 'erros',
    titulo: 'Erros comuns',
    porque: 'O erro como ele APARECE na quadra e a correção como uma dica: é o que o atleta procura quando algo dá errado.',
    campos: ['common_errors'],
  },
  {
    id: 'movimento',
    titulo: 'Movimento',
    porque: 'Preparação, execução e finalização: o que o corpo e a raquete fazem em cada fase — e as capacidades que o exercício treina.',
    campos: ['motor'],
  },
  {
    id: 'variacoes',
    titulo: 'Variações',
    porque: 'Mude UMA alavanca por vez — Espaço, Tarefa, Equipamento ou Pessoas — para cada um treinar no próprio desafio.',
    campos: ['variations'],
  },
  {
    id: 'meta',
    titulo: 'Meta',
    porque: 'Um número que a pessoa consegue contar sozinha diz quando o exercício está dominado e é hora de subir.',
    campos: ['metric', 'success_criteria'],
  },
  {
    id: 'seguranca',
    titulo: 'Segurança',
    porque: 'O risco real do exercício e como evitar. "Tome cuidado" não protege ninguém; diga o que fazer.',
    campos: ['safety'],
  },
  {
    id: 'diagramas',
    dica: 'treino-editor-diagrama',
    titulo: 'Diagramas da quadra',
    porque: 'Um desenho mostra posição e trajetória melhor que um parágrafo. Use "Certo" e "Errado" para comparar lado a lado.',
    campos: ['diagrams'],
  },
  {
    id: 'midia',
    dica: 'treino-editor-midia',
    titulo: 'Fotos e vídeos',
    porque: 'Um vídeo curto ou uma foto mostram o que o texto não alcança. Diga na legenda o que observar.',
    campos: ['media'],
  },
]);

/** As seções que aparecem para este tipo (e este conteúdo). */
export function secoesVisiveis(kind, form = {}) {
  return EDITOR_SECTIONS.filter((s) => s.campos.some((c) => campoVisivel(kind, c, form)));
}

/** A seção tem algo preenchido? (o ✓ do índice) */
export function secaoPreenchida(secao, form = {}) {
  return secao.campos.some((c) => temConteudo(form[c]));
}

const LISTAS = ['skills', 'roles', 'place', 'equipment', 'steps', 'cues', 'positioning', 'common_errors', 'blocks', 'questions', 'diagrams', 'media'];

/**
 * Um item (do banco, da cópia ou da IA) no formato do formulário: tudo o que
 * o editor espera existe, e nada que não é conteúdo entra.
 */
export function formFromItem(item = {}) {
  const base = blankItem(item?.kind);
  const out = { ...base };
  for (const k of Object.keys(base)) {
    if (item?.[k] !== undefined && item?.[k] !== null) out[k] = item[k];
  }
  out.variations = { ...base.variations, ...(item?.variations || {}) };
  out.metric = { ...base.metric, ...(item?.metric || {}) };
  out.motor = {
    phases: { ...base.motor.phases, ...(item?.motor?.phases || {}) },
    abilities: Array.isArray(item?.motor?.abilities) ? item.motor.abilities : [],
  };
  out.technique = {
    checkpoints: Array.isArray(item?.technique?.checkpoints) ? item.technique.checkpoints : [],
    self_check: Array.isArray(item?.technique?.self_check) ? item.technique.self_check : [],
  };
  for (const k of LISTAS) if (!Array.isArray(out[k])) out[k] = [];
  out.visibility = Object.values(VISIBILITY).includes(item?.visibility) ? item.visibility : base.visibility;
  return out;
}

/**
 * Só os campos VAZIOS do formulário recebem o que veio de fora (a IA). O tipo
 * e a visibilidade nunca mudam aqui — a pessoa já os escolheu.
 */
export function mergeEmptyFields(form, value) {
  const vindo = formFromItem(value);
  const out = { ...form };
  for (const k of Object.keys(vindo)) {
    if (k === 'kind' || k === 'visibility') continue;
    if (!temConteudo(form[k]) && temConteudo(vindo[k])) out[k] = vindo[k];
  }
  return out;
}

/** Preenche o formulário com o item da IA: tudo, ou só o que está vazio. */
export function fillFromAi(form, value, { onlyEmpty = false } = {}) {
  if (onlyEmpty) return mergeEmptyFields(form, value);
  return { ...formFromItem(value), visibility: form.visibility };
}

/** Troca o item `i` de lugar com o vizinho (`dir` -1 sobe, +1 desce). */
export function moveItem(list = [], i, dir) {
  const j = i + dir;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return list;
  const out = [...list];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export const replaceAt = (list = [], i, v) => list.map((x, k) => (k === i ? v : x));
export const removeAt = (list = [], i) => list.filter((_, k) => k !== i);

/** Níveis da régua 2.0–8.0 de meio em meio ponto (os seletores). */
export function levelOptions() {
  const out = [];
  for (let n = LEVEL_MIN; n <= LEVEL_MAX + 1e-9; n += 0.5) out.push(Math.round(n * 10) / 10);
  return out;
}

export const formatLevel = (n) => Number(n).toFixed(1).replace('.', ',');

/** Ordem em que a tela leva a pessoa ao primeiro erro (a ordem do formulário). */
const ORDEM_DOS_ERROS = ['kind', 'title', 'summary', 'steps', 'blocks', 'rules_edition', 'link'];

export function firstErrorKey(errors = {}) {
  const chaves = Object.keys(errors || {});
  if (!chaves.length) return null;
  return ORDEM_DOS_ERROS.find((k) => chaves.includes(k)) || chaves[0];
}

/** O id do elemento de cada campo (âncora para rolar até o erro). */
export const campoId = (key) => `campo-${key}`;

// ── Rascunho local ───────────────────────────────────────────────────────

/**
 * Chave do rascunho: por usuário (num tablet de clube, uma pessoa não herda o
 * texto da outra) e por item. A cópia tem chave própria: o rascunho de uma
 * adaptação nunca pode reaparecer como item novo SEM a origem — perderia o
 * crédito e a trava de cópia de conteúdo não público.
 */
export function draftKey(uid, { itemId = null, copiar = null } = {}) {
  if (!uid) return null;
  const alvo = itemId || (copiar ? `novo-copia-${copiar}` : 'novo');
  return `v2:draft:${uid}:treino:${alvo}`;
}

/** @returns {{ form: object, savedAt: number, aiAssisted: boolean } | null} */
export function readDraft(key) {
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || d.v !== 1 || !d.form || typeof d.form !== 'object') return null;
    return { form: formFromItem(d.form), savedAt: Number(d.savedAt) || 0, aiAssisted: d.aiAssisted === true };
  } catch {
    return null;
  }
}

export function writeDraft(key, { form, aiAssisted = false }, now = Date.now()) {
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ v: 1, savedAt: now, aiAssisted, form }));
  } catch { /* sem espaço ou bloqueado: o rascunho é conveniência */ }
}

export function clearDraft(key) {
  if (!key) return;
  try { window.localStorage.removeItem(key); } catch { /* idem */ }
}

/** Dois formulários iguais? (o "tem alterações" da tela) */
export const sameForm = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── Depois de salvar ─────────────────────────────────────────────────────

/**
 * Arquivos enviados que não ficaram no item salvo: os que a pessoa enviou
 * nesta edição e tirou, e os que o item tinha e saíram. Só os DESTA pessoa —
 * arquivo de outra conta (o admin editando) nem a regra deixaria apagar.
 */
export function orphanUploads({ before = [], sessionPaths = [], after = [], uid } = {}) {
  if (!uid) return [];
  const prefixo = `treino/${uid}/`;
  const ficam = new Set((after || []).map((m) => m?.path).filter(Boolean));
  const antes = (before || []).filter((m) => m?.source === 'upload' && m.path).map((m) => m.path);
  return [...new Set([...antes, ...(sessionPaths || [])])]
    .filter((p) => typeof p === 'string' && p.startsWith(prefixo) && !ficam.has(p));
}

/**
 * O que acontece ao salvar com esta visibilidade — dito ANTES. Menor de 18
 * anos publica sempre via revisão (trava do serviço que a regra não vê).
 */
export function saveNotice({ visibility, role, settings = {}, isAdmin = false, uid = null, wasApproved = false, ageYears = null }) {
  if (visibility === VISIBILITY.PUBLICO && !isAdmin && role !== AUTHOR_ROLE.PLATAFORMA
    && Number.isFinite(ageYears) && ageYears < 18 && isAutoApproved(role, settings, { uid })) {
    return 'A equipe revisa antes de publicar. Enquanto isso, só você vê.';
  }
  return publishNotice({ visibility, role, settings, isAdmin, uid, wasApproved });
}
