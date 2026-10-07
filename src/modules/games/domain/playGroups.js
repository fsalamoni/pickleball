/**
 * GRUPOS dentro do Play (flag `play_groups`) — modelo, nível, formação e
 * distribuição. Lógica pura, sem I/O e sem React.
 *
 * ## O que é um grupo
 *
 * Um conjunto nomeado e colorido de participantes do dia, com duas famílias de
 * configuração que NÃO se misturam:
 *
 *  - **Perfil** — quem é do grupo: faixa de nível (régua 2.0–8.0) e sexo. Serve
 *    para SUGERIR e conferir (distribuir por nível, entrada de quem chega). Nunca
 *    barra ninguém: o organizador põe quem quiser onde quiser.
 *  - **Regras da partida** — como o grupo joga: formação das duplas, diferença
 *    máxima de nível e se isso é EXIGIDO ou só PREFERIDO. Valem no sorteio
 *    (`playGroupsDraw.js`).
 *
 * ## Onde mora (nenhuma coleção nova)
 *
 *   game_days/{id}.play_groups          lista de grupos (≤ MAX_GROUPS)
 *   game_days/{id}.play_groups_policy   fila | revezamento | prioridade
 *   participants/{pid}.play_group_id    o grupo da pessoa (ou null)
 *   games/{gid}.group_id|name|color     o grupo da partida (cópia)
 *
 * Todos opcionais: ausentes, o dia se comporta como sempre. `play_group_id` que
 * aponta para um grupo que não existe mais é lido como "sem grupo"
 * (`groupIdOf`) — remover um grupo não exige cascata para o dia continuar certo.
 *
 * ## Duas regras que a plataforma já tinha e que valem aqui
 *
 *  - Nível desconhecido não barra ninguém e não entra na conta (`playLevelOrNull`
 *    devolve null; nunca o 3.0 de `playLevelValue`).
 *  - Sexo desconhecido não preenche vaga de dupla mista nem de mesmo sexo.
 *
 * Ver `docs/39-PLAY-GRUPOS.md`.
 */

import { isPlayFormat } from '@/modules/clubs/domain/gameDayFormats.js';
import { UNIFIED_MIN, UNIFIED_MAX } from '@/modules/rating/domain/unifiedLevel.js';
import { playLevelOrNull } from './gamePlay.js';
import { GAME_DAY_LIMITS } from './gameDay.js';

/* -------------------------------- constantes ------------------------------- */

/** Como as duplas se formam DENTRO do grupo. */
export const GROUP_FORMATION = Object.freeze({
  FREE: 'free', // como o Play sempre fez: equilibra nível e prioriza mistas
  MIXED: 'mixed', // cada dupla com 1 homem e 1 mulher
  SAME_SEX: 'same_sex', // a partida só com pessoas do mesmo sexo
});

export const GROUP_FORMATION_LABELS = Object.freeze({
  [GROUP_FORMATION.FREE]: 'Livre',
  [GROUP_FORMATION.MIXED]: 'Duplas mistas',
  [GROUP_FORMATION.SAME_SEX]: 'Duplas do mesmo sexo',
});

export const GROUP_FORMATION_HINTS = Object.freeze({
  [GROUP_FORMATION.FREE]:
    'Sem regra de sexo: o sorteio equilibra o nível e, quando sabe o sexo de todos, prefere duplas mistas — como o Play sempre fez.',
  [GROUP_FORMATION.MIXED]:
    'Cada dupla com um homem e uma mulher. A partida leva dois homens e duas mulheres (num jogo simples, um de cada).',
  [GROUP_FORMATION.SAME_SEX]:
    'Os quatro da partida são do mesmo sexo: ou só homens, ou só mulheres. Nunca mistura.',
});

/** Para quem é o grupo (perfil — sugere, não barra). */
export const GROUP_GENDER = Object.freeze({ ANY: 'any', MALE: 'male', FEMALE: 'female' });

export const GROUP_GENDER_LABELS = Object.freeze({
  [GROUP_GENDER.ANY]: 'Todos',
  [GROUP_GENDER.MALE]: 'Só homens',
  [GROUP_GENDER.FEMALE]: 'Só mulheres',
});

/** O que decide quando mais de um grupo pode ocupar a quadra. */
export const GROUP_POLICY = Object.freeze({
  QUEUE: 'queue',
  ROTATE: 'rotate',
  PRIORITY: 'priority',
});

export const GROUP_POLICY_LABELS = Object.freeze({
  [GROUP_POLICY.QUEUE]: 'Por tempo de espera',
  [GROUP_POLICY.ROTATE]: 'Revezar os grupos',
  [GROUP_POLICY.PRIORITY]: 'Por prioridade',
});

export const GROUP_POLICY_HINTS = Object.freeze({
  [GROUP_POLICY.QUEUE]:
    'Entra o grupo cujo primeiro da fila espera há mais tempo. É a regra do Play de sempre, entre todos os grupos: nenhum fica esquecido.',
  [GROUP_POLICY.ROTATE]:
    'Os grupos se revezam em círculo: terminou a vez de um, a próxima quadra é do seguinte — mesmo que o outro tenha gente esperando há menos tempo.',
  [GROUP_POLICY.PRIORITY]:
    'Vale a ordem da lista de grupos: o de cima ocupa a quadra sempre que tiver partida pronta. Os de baixo jogam quando o de cima não preencher.',
});

/** O grupo pode ser escolhido pela própria pessoa (e recebê-la na entrada)? */
export const GROUP_JOIN = Object.freeze({ OPEN: 'open', CLOSED: 'closed' });

/** Cores dos grupos (chaves; as classes de cada uma moram na UI). */
export const PLAY_GROUP_COLORS = Object.freeze([
  'sky', 'emerald', 'amber', 'rose', 'violet', 'teal', 'orange', 'indigo',
]);

export const PLAY_GROUP_LIMITS = Object.freeze({
  MAX_GROUPS: 10,
  NAME_MAX: 30,
  /** A régua vai de 2.0 a 8.0: nenhuma diferença passa de 6. */
  MAX_GAP: UNIFIED_MAX - UNIFIED_MIN,
});

/** Degraus de nível oferecidos nos seletores (2.0, 2.5 … 8.0). */
export const PLAY_GROUP_LEVEL_STEPS = Object.freeze(
  Array.from({ length: Math.round((UNIFIED_MAX - UNIFIED_MIN) / 0.5) + 1 }, (_, i) => UNIFIED_MIN + i * 0.5),
);

/** Diferenças máximas de nível oferecidas. */
export const PLAY_GROUP_GAP_OPTIONS = Object.freeze([0.5, 1, 1.5, 2]);

/**
 * Valor de SELEÇÃO (nunca gravado) para "quem está sem grupo" em controles que
 * escolhem um grupo — escolher a quadra, filtrar. Nos dados, sem grupo é null.
 */
export const NO_GROUP = '__none__';

const EPS = 1e-9;

/* --------------------------------- ids ------------------------------------ */

/** Id curto e estável de um grupo. `rng` existe para o teste ser determinístico. */
export function newGroupId(rng = Math.random) {
  const n = Math.floor(rng() * (36 ** 6));
  return `g${n.toString(36).padStart(6, '0')}`;
}

/* ----------------------------- normalização -------------------------------- */

const isObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const oneOf = (map, v, fallback) => (Object.values(map).includes(v) ? v : fallback);

/** Número da régua ou null — vazio NUNCA vira zero. */
function toLevel(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.min(UNIFIED_MAX, Math.max(UNIFIED_MIN, n)) * 100) / 100;
}

function toGap(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(Math.min(PLAY_GROUP_LIMITS.MAX_GAP, n) * 100) / 100;
}

function toCourts(v) {
  if (!Array.isArray(v)) return [];
  const set = new Set();
  v.forEach((x) => {
    const n = Math.floor(Number(x));
    if (Number.isFinite(n) && n >= 1 && n <= GAME_DAY_LIMITS.MAX_COURTS) set.add(n);
  });
  return Array.from(set).sort((a, b) => a - b);
}

/**
 * Um grupo na forma que gravamos e lemos. Devolve null para o que não é grupo.
 *
 * @param {object} raw
 * @param {number} index posição na lista (dá nome e cor quando faltam)
 */
export function normalizePlayGroup(raw, index = 0) {
  if (!isObject(raw)) return null;
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `g${index + 1}`;
  const name = String(raw.name ?? '').trim().slice(0, PLAY_GROUP_LIMITS.NAME_MAX) || `Grupo ${index + 1}`;
  let min = toLevel(raw.level_min);
  let max = toLevel(raw.level_max);
  if (min != null && max != null && min > max) [min, max] = [max, min];
  return {
    id,
    name,
    color: PLAY_GROUP_COLORS.includes(raw.color) ? raw.color : PLAY_GROUP_COLORS[index % PLAY_GROUP_COLORS.length],
    level_min: min,
    level_max: max,
    gender: oneOf(GROUP_GENDER, raw.gender, GROUP_GENDER.ANY),
    formation: oneOf(GROUP_FORMATION, raw.formation, GROUP_FORMATION.FREE),
    max_level_gap: toGap(raw.max_level_gap),
    strict: raw.strict === true,
    courts: toCourts(raw.courts),
    fill: raw.fill === true,
    paused: raw.paused === true,
    join: oneOf(GROUP_JOIN, raw.join, GROUP_JOIN.OPEN),
  };
}

/**
 * A configuração de grupos de um dia de jogo, sempre completa e sã: ids
 * únicos, no máximo `MAX_GROUPS`, política conhecida. Idempotente — normalizar o
 * que já está normalizado não muda nada.
 *
 * @param {object|null} gameDay lê `play_groups` e `play_groups_policy`
 * @returns {{ groups: object[], policy: string }}
 */
export function normalizePlayGroupsConfig(gameDay) {
  const lista = Array.isArray(gameDay?.play_groups) ? gameDay.play_groups : [];
  const grupos = [];
  const vistos = new Set();
  lista.filter(isObject).slice(0, PLAY_GROUP_LIMITS.MAX_GROUPS).forEach((raw) => {
    const g = normalizePlayGroup(raw, grupos.length);
    if (!g) return;
    let id = g.id;
    for (let n = 2; vistos.has(id); n += 1) id = `${g.id}-${n}`;
    vistos.add(id);
    grupos.push({ ...g, id });
  });
  return {
    groups: grupos,
    policy: oneOf(GROUP_POLICY, gameDay?.play_groups_policy, GROUP_POLICY.QUEUE),
  };
}

const chave = (nome) => String(nome ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Valida o que o organizador montou na tela e devolve o valor PRONTO para
 * gravar no dia. Lista vazia é válida: é como se desligam os grupos.
 *
 * @param {{ groups?: object[], policy?: string }} input
 * @returns {{ valid: boolean, errors: string[], value: { play_groups: object[], play_groups_policy: string } }}
 */
export function validatePlayGroups(input = {}) {
  const bruto = Array.isArray(input.groups) ? input.groups : [];
  const errors = [];
  if (bruto.length > PLAY_GROUP_LIMITS.MAX_GROUPS) {
    errors.push(`No máximo ${PLAY_GROUP_LIMITS.MAX_GROUPS} grupos por dia.`);
  }
  const nomes = new Set();
  bruto.filter(isObject).forEach((g) => {
    const nome = chave(g.name);
    if (!nome) { errors.push('Dê um nome a cada grupo.'); return; }
    if (nomes.has(nome)) errors.push(`Dois grupos com o mesmo nome (“${String(g.name).trim()}”): a tela não os distinguiria.`);
    nomes.add(nome);
  });
  const cfg = normalizePlayGroupsConfig({ play_groups: bruto, play_groups_policy: input.policy });
  return {
    valid: errors.length === 0,
    errors: Array.from(new Set(errors)),
    value: { play_groups: cfg.groups, play_groups_policy: cfg.policy },
  };
}

/**
 * Os grupos valem NESTE dia? Flag ligada, formato Play e ao menos um grupo.
 * Desligada a flag, os grupos gravados são ignorados — é a chave de segurança.
 */
export function isPlayGroupsActive(gameDay, flagOn) {
  if (!flagOn || !gameDay || !isPlayFormat(gameDay.format)) return false;
  return normalizePlayGroupsConfig(gameDay).groups.length > 0;
}

/* ------------------------------- consultas --------------------------------- */

/** O grupo de um participante; grupo que não existe mais vira "sem grupo". */
export function groupIdOf(participant, config) {
  const id = participant?.play_group_id;
  if (typeof id !== 'string' || !id) return null;
  return (config?.groups || []).some((g) => g.id === id) ? id : null;
}

export function groupById(config, id) {
  if (!id || id === NO_GROUP) return null;
  return (config?.groups || []).find((g) => g.id === id) || null;
}

/** Sexo conhecido (`male`/`female`) ou null. */
export function genderOfParticipant(p) {
  return p?.play_gender === 'male' || p?.play_gender === 'female' ? p.play_gender : null;
}

/**
 * O nível cabe na faixa? Os DOIS extremos valem — grupos vizinhos compartilham
 * o limite (2.0–3.0 e 3.0–4.0) e, no limite, vale o grupo de cima da lista. Sem
 * nível conhecido ninguém é barrado.
 */
export function levelInRange(level, min, max) {
  if (typeof level !== 'number' || !Number.isFinite(level)) return true;
  if (min != null && level < min - EPS) return false;
  if (max != null && level > max + EPS) return false;
  return true;
}

const hasRange = (g) => g.level_min != null || g.level_max != null;

/* --------------------------- regras da partida ----------------------------- */

/**
 * Estes jogadores formam uma partida da formação pedida? Sexo desconhecido não
 * preenche vaga de mista nem de mesmo sexo.
 */
export function fitsFormation(players, formation) {
  if (formation !== GROUP_FORMATION.MIXED && formation !== GROUP_FORMATION.SAME_SEX) return true;
  const lista = players || [];
  const n = lista.length;
  if (n === 0) return false;
  const sexos = lista.map(genderOfParticipant);
  if (formation === GROUP_FORMATION.SAME_SEX) {
    return sexos[0] != null && sexos.every((s) => s === sexos[0]);
  }
  if (n % 2 !== 0) return false;
  const homens = sexos.filter((s) => s === 'male').length;
  const mulheres = sexos.filter((s) => s === 'female').length;
  return homens === n / 2 && mulheres === n / 2;
}

/**
 * A diferença entre o maior e o menor nível da partida cabe no limite? Quem não
 * tem nível conhecido não conta — e não barra ninguém.
 */
export function fitsLevelGap(players, maxGap) {
  if (maxGap == null || !(maxGap > 0)) return true;
  const niveis = (players || []).map(playLevelOrNull).filter((n) => n != null);
  if (niveis.length < 2) return true;
  return Math.max(...niveis) - Math.min(...niveis) <= maxGap + EPS;
}

/* ------------------------- qual grupo combina com quem --------------------- */

/**
 * O grupo que combina com uma pessoa (ou com uma dupla).
 *
 * Primeiro as faixas de nível, na ordem da lista (no limite compartilhado vale
 * o de cima). Depois, só para quem nenhuma faixa pegou, o grupo "geral" — o que
 * não tem faixa —, e apenas se for UM: com dois não há como escolher sem chutar.
 *
 * @param {{ level: number|null, gender?: string|null }} entity
 * @param {{ groups: object[] }} config
 * @param {{ onlyOpen?: boolean }} [opts] `onlyOpen`: ignora grupos fechados
 * @returns {{ group: object|null, reason: string|null }}
 */
export function matchGroupFor(entity, config, { onlyOpen = false } = {}) {
  const candidatos = (config?.groups || []).filter((g) => !onlyOpen || g.join === GROUP_JOIN.OPEN);
  if (candidatos.length === 0) return { group: null, reason: 'Não há grupo disponível.' };

  const nivel = typeof entity?.level === 'number' && Number.isFinite(entity.level) ? entity.level : null;
  const sexo = entity?.gender === 'male' || entity?.gender === 'female' ? entity.gender : null;
  const sexoOk = (g) => g.gender === GROUP_GENDER.ANY || g.gender === sexo;

  const comFaixa = candidatos.filter(hasRange);
  const gerais = candidatos.filter((g) => !hasRange(g));

  if (nivel != null) {
    const achado = comFaixa.find((g) => sexoOk(g) && levelInRange(nivel, g.level_min, g.level_max));
    if (achado) return { group: achado, reason: null };
  }

  const geraisOk = gerais.filter(sexoOk);
  if (geraisOk.length === 1) return { group: geraisOk[0], reason: null };
  if (geraisOk.length > 1) {
    return { group: null, reason: 'Há vários grupos livres — escolha à mão.' };
  }

  // Nada combinou: o motivo é o primeiro dado que falta, na ordem em que a
  // pessoa consegue consertar — nível, depois sexo, depois a faixa em si.
  if (nivel == null) {
    return { group: null, reason: 'Nível não informado — não dá para escolher a faixa.' };
  }
  if (sexo == null && candidatos.some((g) => g.gender !== GROUP_GENDER.ANY)) {
    return { group: null, reason: 'Sexo não informado — há grupos que dependem dele.' };
  }
  return { group: null, reason: `O nível ${nivel.toFixed(1)} não cabe em nenhuma faixa dos grupos.` };
}

/**
 * O grupo de quem acaba de chegar: o que combina com o nível e o sexo dele,
 * entre os grupos ABERTOS. Nunca põe sozinho num grupo fechado.
 *
 * @param {{ groups: object[] }} config
 * @param {object} entry participante (usa `level_value`, `play_level`, `play_gender`)
 * @returns {string|null} id do grupo
 */
export function groupForEntry(config, entry) {
  const { group } = matchGroupFor(
    { level: playLevelOrNull(entry), gender: genderOfParticipant(entry) },
    config,
    { onlyOpen: true },
  );
  return group ? group.id : null;
}

function mutualPartner(p, byId) {
  if (!p?.partner_id) return null;
  const q = byId.get(p.partner_id);
  return q && q.partner_id === p.id ? q : null;
}

/**
 * A SUGESTÃO de "Distribuir por nível": quem vai para qual grupo. Só devolve o
 * que MUDA — quem já está no grupo certo não aparece. Quem não dá para
 * distribuir (sem nível, fora das faixas) vem em `unmatched`, com o motivo.
 *
 * Dupla vinculada vai JUNTA, pelo nível médio dos dois: o vínculo só vale
 * dentro do grupo, e separar a dupla na distribuição desfaria em silêncio o que
 * alguém pediu.
 *
 * @param {{ participants: object[], config: { groups: object[] },
 *           scope?: 'ungrouped'|'all', onlyOpen?: boolean }} args
 * @returns {{ assignments: Array<{pid:string,name:string,groupId:string,fromGroupId:string|null,reason:string}>,
 *             unmatched: Array<{pid:string,name:string,reason:string}>,
 *             byGroup: Record<string, number> }}
 */
export function suggestPlayGroupAssignments({
  participants = [], config, scope = 'ungrouped', onlyOpen = false,
} = {}) {
  const out = { assignments: [], unmatched: [], byGroup: {} };
  if (!config?.groups?.length) return out;

  const todos = participants.filter(Boolean);
  const byId = new Map(todos.map((p) => [p.id, p]));
  const feitos = new Set();
  const atual = (p) => groupIdOf(p, config);

  const atribuir = (p, groupId, reason) => {
    if (atual(p) === groupId) return;
    out.assignments.push({
      pid: p.id, name: p.name, groupId, fromGroupId: atual(p), reason,
    });
    out.byGroup[groupId] = (out.byGroup[groupId] || 0) + 1;
  };
  const semAchar = (p, reason) => {
    if (atual(p) === null) out.unmatched.push({ pid: p.id, name: p.name, reason });
  };

  todos.forEach((p) => {
    if (feitos.has(p.id)) return;
    const par = mutualPartner(p, byId);
    const unidade = par ? [p, par] : [p];
    unidade.forEach((x) => feitos.add(x.id));

    const mexiveis = scope === 'all' ? unidade : unidade.filter((x) => atual(x) === null);
    if (mexiveis.length === 0) return;

    // Um da dupla já tem grupo e o outro não: o que está sem grupo acompanha.
    if (scope !== 'all' && par && mexiveis.length === 1) {
      const fixo = unidade.find((x) => atual(x) !== null);
      atribuir(mexiveis[0], atual(fixo), 'Acompanha a dupla.');
      return;
    }

    const niveis = unidade.map(playLevelOrNull).filter((n) => n != null);
    const nivel = niveis.length ? niveis.reduce((a, b) => a + b, 0) / niveis.length : null;
    const sexos = unidade.map((x) => x.play_gender);
    const sexo = sexos.every((s) => s === sexos[0]) ? genderOfParticipant(unidade[0]) : null;

    const { group, reason } = matchGroupFor({ level: nivel, gender: sexo }, config, { onlyOpen });
    if (!group) { mexiveis.forEach((x) => semAchar(x, reason)); return; }
    mexiveis.forEach((x) => atribuir(
      x,
      group.id,
      par ? 'Dupla vinculada, pelo nível médio.' : (nivel != null ? `Nível ${nivel.toFixed(1)}.` : 'Grupo livre.'),
    ));
  });
  return out;
}

/* -------------------------------- modelos ---------------------------------- */

export const PLAY_GROUP_TEMPLATES = Object.freeze([
  {
    id: 'by_level',
    label: 'Por nível',
    description: 'Iniciante, Intermediário e Avançado — cada um joga entre os seus.',
  },
  {
    id: 'by_formation',
    label: 'Por tipo de dupla',
    description: 'Mistas, masculinas e femininas — a partida sai sempre do tipo do grupo.',
  },
  {
    id: 'blank',
    label: 'Em branco',
    description: 'Dois grupos livres para você configurar do seu jeito (a turma A e a turma B).',
  },
]);

const MODELOS = {
  by_level: [
    { name: 'Iniciante', level_min: 2, level_max: 3 },
    { name: 'Intermediário', level_min: 3, level_max: 4 },
    { name: 'Avançado', level_min: 4, level_max: 8 },
  ],
  by_formation: [
    { name: 'Mistas', formation: GROUP_FORMATION.MIXED },
    { name: 'Masculinas', formation: GROUP_FORMATION.SAME_SEX, gender: GROUP_GENDER.MALE },
    { name: 'Femininas', formation: GROUP_FORMATION.SAME_SEX, gender: GROUP_GENDER.FEMALE },
  ],
  blank: [{ name: 'Grupo A' }, { name: 'Grupo B' }],
};

/** Os grupos de um modelo, já normalizados e com ids novos. */
export function buildTemplateGroups(templateId, rng = Math.random) {
  const modelo = MODELOS[templateId];
  if (!modelo) return [];
  const vistos = new Set();
  return modelo.map((spec, i) => {
    let id = newGroupId(rng);
    if (vistos.has(id)) id = `${id}${i}`;
    vistos.add(id);
    return normalizePlayGroup({ ...spec, id }, i);
  });
}

/* ------------------------- numeração por grupo ----------------------------- */

/**
 * Acrescenta à `view` do Play o grupo de cada pessoa e a posição NA FILA DO
 * GRUPO (`groupNo`). `orderNo`, a ordem de entrada global, não muda — é ela que
 * a substituição e a previsão usam. Quem está sem grupo (ou num grupo que
 * deixou de existir) tem uma fila própria.
 *
 * Sem grupos devolve a MESMA view.
 */
export function applyGroupNumbers(view, config) {
  if (!view || !config?.groups?.length) return view;
  const contador = new Map();
  const numerar = (p) => {
    const gid = groupIdOf(p, config);
    const n = (contador.get(gid) || 0) + 1;
    contador.set(gid, n);
    return { ...p, group_id: gid, groupNo: n };
  };
  const order = (view.order || []).map(numerar);
  const porId = new Map(order.map((p) => [p.id, p]));
  const comGrupo = (p) => ({ ...p, group_id: groupIdOf(p, config), groupNo: null });
  return {
    ...view,
    order,
    inCourt: (view.inCourt || []).map(comGrupo),
    unavailable: (view.unavailable || []).map(comGrupo),
    all: (view.all || []).map((p) => porId.get(p.id) || comGrupo(p)),
  };
}

/**
 * Põe o nível unificado já resolvido (`level_value`) em quem tem — só em
 * memória, como o resto do Play: nada é gravado no participante. É o que a tela
 * e o serviço fazem ANTES de sortear, e é por fazerem a mesma coisa que a
 * previsão bate com a partida criada. Quem não está no mapa segue como está
 * (cai no nível declarado).
 *
 * @param {Array} participants
 * @param {Record<string, number>|null} niveis id do participante → nível
 */
export function withLevels(participants, niveis) {
  if (!niveis || Object.keys(niveis).length === 0) return participants;
  return (participants || []).map((p) => (
    p && Number.isFinite(niveis[p.id]) ? { ...p, level_value: niveis[p.id] } : p
  ));
}

/**
 * A pessoa está FORA do perfil do grupo em que está? `'nivel'`, `'sexo'` ou
 * null. O perfil só sugere — quem organiza põe quem quiser onde quiser —, então
 * isto serve para a tela avisar com um selo discreto, nunca para barrar. E dado
 * que falta não é "fora do perfil": a tela não acusa sem saber.
 */
export function profileMismatch(participant, group) {
  if (!group) return null;
  const nivel = playLevelOrNull(participant);
  if (nivel != null && !levelInRange(nivel, group.level_min, group.level_max)) return 'nivel';
  const sexo = genderOfParticipant(participant);
  if (group.gender !== GROUP_GENDER.ANY && sexo != null && sexo !== group.gender) return 'sexo';
  return null;
}

/**
 * O parceiro da dupla vinculada, quando ele está em OUTRO grupo — o vínculo só
 * vale dentro do grupo, então a tela avisa. Devolve o parceiro ou null.
 */
export function linkedPartnerInOtherGroup(participant, participants, config) {
  if (!participant?.partner_id) return null;
  const par = (participants || []).find((x) => x?.id === participant.partner_id);
  if (!par || par.partner_id !== participant.id) return null;
  return groupIdOf(par, config) !== groupIdOf(participant, config) ? par : null;
}

/* -------------------------------- avisos ----------------------------------- */

const nivelTxt = (n) => Number(n).toFixed(1);

/**
 * O que está torto na configuração — dito ANTES de alguém ficar esperando uma
 * partida que nunca sai. Cada aviso tem `key` estável, `tone` e `text`.
 *
 * @param {{ groups: object[] }} config
 * @param {{ courts?: number, participants?: object[] }} ctx
 */
export function groupsConfigWarnings(config, { courts = 1, participants = [] } = {}) {
  const grupos = config?.groups || [];
  if (grupos.length === 0) return [];
  const avisos = [];
  const total = Math.max(1, Math.floor(Number(courts)) || 1);

  // 1) quadras que nenhum grupo pode usar
  for (let c = 1; c <= total; c += 1) {
    const alguem = grupos.some((g) => g.courts.length === 0 || g.courts.includes(c));
    if (!alguem) {
      avisos.push({
        key: `quadra-${c}`, tone: 'amber',
        text: `A quadra ${c} não está liberada para nenhum grupo — só quem está sem grupo joga nela.`,
      });
    }
  }

  // 2) buracos entre as faixas de nível
  const faixas = grupos.filter(hasRange)
    .map((g) => [g.level_min ?? UNIFIED_MIN, g.level_max ?? UNIFIED_MAX])
    .sort((a, b) => a[0] - b[0]);
  if (faixas.length >= 2) {
    let ate = faixas[0][1];
    for (let i = 1; i < faixas.length; i += 1) {
      if (faixas[i][0] > ate + EPS) {
        avisos.push({
          key: `faixa-${nivelTxt(ate)}-${nivelTxt(faixas[i][0])}`, tone: 'amber',
          text: `Nenhum grupo cobre os níveis de ${nivelTxt(ate)} a ${nivelTxt(faixas[i][0])} — quem estiver nessa faixa fica sem grupo.`,
        });
      }
      ate = Math.max(ate, faixas[i][1]);
    }
  }

  const gente = participants.filter(Boolean);
  const membrosDe = (g) => gente.filter((p) => groupIdOf(p, config) === g.id);

  // 3) grupo sem ninguém (com o dia vazio não há a quem culpar)
  if (gente.length > 0) {
    grupos.forEach((g) => {
      if (membrosDe(g).length === 0) {
        avisos.push({ key: `vazio-${g.id}`, tone: 'info', text: `O grupo ${g.name} ainda não tem ninguém.` });
      }
    });
  }

  // 4) sexo desconhecido num grupo que depende dele
  grupos.forEach((g) => {
    if (g.formation === GROUP_FORMATION.FREE && g.gender === GROUP_GENDER.ANY) return;
    const sem = membrosDe(g).filter((p) => genderOfParticipant(p) == null).length;
    if (sem > 0) {
      avisos.push({
        key: `sexo-${g.id}`, tone: 'amber',
        text: `${sem} ${sem === 1 ? 'pessoa' : 'pessoas'} do grupo ${g.name} sem sexo informado — ${sem === 1 ? 'não entra' : 'não entram'} na conta de duplas mistas ou do mesmo sexo.`,
      });
    }
  });

  // 5) todos em pausa
  if (grupos.every((g) => g.paused)) {
    avisos.push({
      key: 'todos-pausados', tone: 'amber',
      text: 'Todos os grupos estão em pausa — só quem está sem grupo joga.',
    });
  }
  return avisos;
}

/* ------------------------------ descrição ---------------------------------- */

/**
 * O que está configurado num grupo, em frases curtas (para chips). Grupo sem
 * nenhuma regra devolve lista vazia — o padrão não precisa ser repetido.
 *
 * @returns {Array<{ key: string, label: string }>}
 */
export function describeGroupRules(group) {
  if (!group) return [];
  const chips = [];
  const add = (key, label) => chips.push({ key, label });

  if (group.level_min != null && group.level_max != null) {
    add('nivel', `Nível ${nivelTxt(group.level_min)}–${nivelTxt(group.level_max)}`);
  } else if (group.level_min != null) {
    add('nivel', `Nível ${nivelTxt(group.level_min)}+`);
  } else if (group.level_max != null) {
    add('nivel', `Nível até ${nivelTxt(group.level_max)}`);
  }
  if (group.gender !== GROUP_GENDER.ANY) add('sexo', GROUP_GENDER_LABELS[group.gender]);
  if (group.formation !== GROUP_FORMATION.FREE) add('formacao', GROUP_FORMATION_LABELS[group.formation]);
  if (group.max_level_gap != null) add('gap', `Diferença máx. de nível ${nivelTxt(group.max_level_gap)}`);
  if ((group.formation !== GROUP_FORMATION.FREE || group.max_level_gap != null) && group.strict) {
    add('exige', 'Exige essas regras');
  }
  if (group.courts.length > 0) {
    add('quadras', `${group.courts.length === 1 ? 'Quadra' : 'Quadras'} ${group.courts.join(', ')}`);
  }
  if (group.fill) add('completa', 'Completa com quem está sem grupo');
  if (group.join === GROUP_JOIN.CLOSED) add('fechado', 'Só a organização coloca');
  if (group.paused) add('pausa', 'Em pausa');
  return chips;
}

/** A cópia do grupo que a partida carrega (sobrevive à remoção do grupo). */
export function groupSnapshot(group) {
  return {
    group_id: group?.id ?? null,
    group_name: group?.name ?? null,
    group_color: group?.color ?? null,
  };
}
