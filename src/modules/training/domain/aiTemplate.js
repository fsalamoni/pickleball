/**
 * "Gerar com IA" e importação em JSON.
 *
 * A plataforma não chama IA nenhuma: ela entrega o PEDIDO pronto (regras de
 * escrita da pesquisa + exemplo completo + modelo do tipo) para a pessoa
 * colar na IA que já usa, e LÊ de volta o JSON que a IA devolver. Tudo o que
 * volta passa por `normalizeItemInput` — a IA respeita o formato, mas não
 * respeita tamanhos nem listas fechadas, e às vezes inventa link.
 *
 * Base: `docs/40-CENTRO-DE-TREINO.md` §"O modelo padrão" (foco externo nas
 * dicas, variação por alavanca, certo sempre ao lado do errado, sem inventar
 * mídia, link nem número de regra).
 */

import {
  EQUIPMENT, ITEM_KIND, ITEM_KIND_LABELS, ITEM_KINDS, METRIC_TYPES, MOTOR_ABILITIES, PLACES,
  PRACTICE_MODES, SKILLS, SKILL_AREAS,
} from './taxonomy.js';
import { blankItem, itemQuality, normalizeItemInput } from './trainingItem.js';

/** Itens por importação (proteção da tela e da escrita em lote). */
export const MAX_IMPORT_ITEMS = 100;

const BODY_PARTS = ['punho', 'pulso', 'cotovelo', 'ombro', 'joelho', 'quadril', 'tronco', 'músculo', 'musculo', 'braço', 'braco', 'antebraço', 'antebraco'];

/**
 * Avisos sobre as dicas (não bloqueiam): dica boa é curta e aponta para FORA
 * do corpo (bola, alvo, raquete, rede).
 * @param {string[]} cues
 * @returns {string[]}
 */
export function cueWarnings(cues = []) {
  const out = [];
  (Array.isArray(cues) ? cues : []).forEach((c, i) => {
    const texto = String(c ?? '').trim();
    if (!texto) return;
    const palavras = texto.split(/\s+/).length;
    if (palavras > 8) out.push(`Dica ${i + 1} tem ${palavras} palavras — dica boa cabe em 8.`);
    const lower = texto.toLowerCase();
    const parte = BODY_PARTS.find((p) => new RegExp(`(^|[^a-zà-ú])${p}`, 'i').test(lower));
    if (parte) out.push(`Dica ${i + 1} fala do corpo ("${parte}"). Prefira apontar para a bola, o alvo ou a raquete.`);
    if (/^(não|nunca)\b/i.test(texto)) out.push(`Dica ${i + 1} começa com negação. Diga o que FAZER.`);
  });
  return out;
}

/** O certo × errado tem o "errado" sozinho? (errado sem o certo ao lado atrapalha) */
export function positioningWarnings(positioning = []) {
  const list = Array.isArray(positioning) ? positioning : [];
  const certos = list.filter((p) => p?.type === 'certo').length;
  const errados = list.filter((p) => p?.type === 'errado').length;
  return errados > certos ? ['Há mais "errado" do que "certo". Mostre sempre o certo ao lado de cada errado.'] : [];
}

/** Exemplo completo (passa em todas as regras do pedido). */
export const AI_EXAMPLE = Object.freeze({
  kind: 'drill',
  title: 'Dink cruzado no pé de dentro',
  summary: 'Dupla na linha da cozinha trocando dinks cruzados com alvo no pé de dentro. Para quem já mantém o dink e quer precisão.',
  objective: 'Ao final, o atleta consegue manter 10 dinks cruzados seguidos caindo na cozinha, perto do pé de dentro do parceiro.',
  skills: ['kitchen.dink_cruzado', 'kitchen.paciencia'],
  level_min: 3.0,
  level_max: 4.5,
  players_min: 2,
  players_max: 4,
  roles: ['Parceiro de dink'],
  duration_min: 10,
  intensity: 3,
  place: ['quadra'],
  equipment: ['bolas', 'cones'],
  practice_mode: 'bloco',
  setup: 'Os dois na linha da cozinha, em diagonal (direita × direita). Um cone dentro da cozinha, a 30 cm da linha, em frente ao pé de dentro de cada um. Cesto de bolas no poste.',
  steps: [
    'Quem está à direita solta a bola e começa com um dink cruzado.',
    'Troquem dinks cruzados mirando o cone do outro.',
    'Contem em voz alta cada dink que cai na cozinha.',
    'Errou, zera a contagem e recomeça quem errou.',
    'A cada 2 minutos, troquem para a diagonal esquerda.',
  ],
  cues: ['Raquete na frente, como uma pá', 'Bola sobe e desce antes da rede', 'Mire o cadarço do pé de dentro'],
  common_errors: [
    { error: 'A bola sobe demais e o parceiro pode atacar.', fix: 'Ponto mais alto da bola do seu lado da rede.' },
    { error: 'A bola morre na rede.', fix: 'Termine com a raquete apontando o cone do outro lado.' },
  ],
  variations: {
    easier: 'Tarefa: paralelo em vez de cruzado (bola mais curta) e meta de 5 seguidos.',
    harder: "Tarefa: o parceiro alterna pé de dentro e pé de fora (o 'oito'); bola alta pode ser atacada.",
  },
  metric: { type: 'sequencia', target: '10 seguidos' },
  success_criteria: "Conta se cai na cozinha abaixo da altura do joelho do parceiro. Fez 10 seguidos duas vezes? Vá para 'Mais difícil'.",
  safety: '',
  motor: {
    phases: {
      preparacao: 'Base aberta, joelhos dobrados, raquete na frente da cintura.',
      execucao: 'As pernas sobem e a raquete empurra a bola para cima e para a frente, sem bater.',
      finalizacao: 'A raquete para apontando o alvo e você volta à base.',
    },
    abilities: ['precisao', 'equilibrio', 'ritmo'],
  },
  when_to_use: 'Rally de cozinha em duplas, quando ninguém tem bola atacável.',
  positioning: [],
  diagrams: [{
    title: 'Diagonal direita',
    tag: 'neutro',
    court: 'cozinha',
    elements: [
      { t: 'jogador', x: 75, y: 33, team: 'a', label: 'A' },
      { t: 'jogador', x: 25, y: 67, team: 'b', label: 'B' },
      { t: 'cone', x: 30, y: 62 },
      { t: 'cone', x: 70, y: 38 },
      { t: 'seta', x: 75, y: 35, x2: 30, y2: 62, style: 'bola', label: '1' },
      { t: 'seta', x: 25, y: 65, x2: 70, y2: 38, style: 'bola', label: '2' },
    ],
  }],
  media: [],
  link: '',
});

/** Campos que cada tipo usa (o modelo JSON entregue à IA). */
const KIND_FIELDS = {
  drill: ['setup', 'steps', 'cues', 'common_errors', 'variations', 'metric', 'success_criteria', 'safety', 'motor', 'practice_mode', 'when_to_use', 'diagrams'],
  treino: ['blocks', 'safety'],
  fundamento: ['steps', 'cues', 'positioning', 'common_errors', 'motor', 'when_to_use', 'variations', 'diagrams'],
  jogada: ['steps', 'cues', 'positioning', 'common_errors', 'when_to_use', 'variations', 'diagrams'],
  fisico: ['steps', 'cues', 'common_errors', 'sets', 'reps', 'rest_sec', 'tempo', 'safety', 'motor', 'variations'],
  estudo: ['study_type', 'rules_edition', 'questions', 'link'],
};
const COMMON = ['kind', 'title', 'summary', 'objective', 'skills', 'level_min', 'level_max', 'players_min', 'players_max', 'roles', 'duration_min', 'intensity', 'place', 'equipment'];

/** Modelo JSON vazio do tipo — só os campos que o tipo usa. */
export function itemJsonTemplate(kind = ITEM_KIND.DRILL) {
  const k = ITEM_KINDS.includes(kind) ? kind : ITEM_KIND.DRILL;
  const blank = blankItem(k);
  const out = {};
  for (const f of [...COMMON, ...KIND_FIELDS[k]]) out[f] = blank[f] ?? '';
  out.kind = k;
  if (k === ITEM_KIND.TREINO) out.blocks = [{ type: 'aquecimento', title: '', duration_min: 10, item_id: null, notes: '' }];
  return out;
}

const list = (arr) => arr.join(', ');

/**
 * O pedido completo para colar na IA.
 * @param {{ kind?: string, skills?: string[], level?: number|null, players?: number|null,
 *   minutes?: number|null, place?: string, equipment?: string[], notes?: string }} p
 */
export function buildAiPrompt({ kind = ITEM_KIND.DRILL, skills = [], level = null, players = null, minutes = null, place = '', equipment = [], notes = '' } = {}) {
  const k = ITEM_KINDS.includes(kind) ? kind : ITEM_KIND.DRILL;
  const fmt = (n) => (Number.isFinite(n) ? String(n).replace('.', ',') : 'a definir');
  const habilidades = skills.length ? skills.map((s) => SKILLS[s] || s).join(', ') : 'a definir';
  return [
    'Você escreve conteúdo de treino de pickleball para uma plataforma brasileira.',
    'Escreva em português do Brasil, linguagem de quadra, frases curtas, sem jargão em inglês solto (se usar, traduza entre parênteses na primeira vez).',
    '',
    `Gere UM item do tipo "${k}" (${ITEM_KIND_LABELS[k]}) e responda SÓ com o JSON, no formato do modelo abaixo. Regras:`,
    '',
    'CONTEÚDO',
    '- "title": até 60 caracteres, diz o que se faz.',
    '- "summary": 1–2 frases (até 280 caracteres): o que é e para quem serve.',
    '- "objective": UMA frase observável começando por "Ao final, o atleta consegue".',
    `- "skills": 1–3 valores desta lista, a principal primeiro: ${list([...SKILL_AREAS, ...Object.keys(SKILLS)])}.`,
    '- "level_min"/"level_max": régua 2.0–8.0 com uma casa; se servir a todos, null.',
    `- "place": valores de ${list(PLACES)}. "equipment": valores de ${list(EQUIPMENT)}.`,
    '- "steps": 3–8 passos, um verbo no imperativo por passo, na ordem; o último diz quando trocar de lado ou de papel. Até 300 caracteres cada.',
    '- "setup": onde cada jogador fica, onde ficam cones/alvos, quem começa.',
    '- "cues": 2–3 dicas de ATÉ 8 PALAVRAS com foco EXTERNO (bola, alvo, raquete, trajetória, rede). Proibido citar músculo ou articulação. Bom: "Mire o cadarço do pé de dentro". Ruim: "Gire o punho".',
    '- "common_errors": 2–4 itens {error: o que se VÊ, fix: uma dica externa}.',
    '- "variations.easier"/"variations.harder": comece com a alavanca usada — "Espaço:", "Tarefa:", "Equipamento:" ou "Pessoas:" — e mude UMA coisa.',
    `- "metric": "type" de ${list(METRIC_TYPES)} e um alvo contável sozinho ("10 seguidos").`,
    '- "success_criteria": o que conta como acerto e quando subir de nível.',
    `- "practice_mode": ${list(PRACTICE_MODES)} (em bloco para quem começa; variado/aleatório quando já sai consistente; jogo para levar à partida).`,
    '- "safety": o risco real do exercício e como evitar; vazio se não houver. Nunca diagnostique nem prometa resultado de saúde.',
    `- "motor.phases": preparação, execução e finalização, cada uma em uma frase sobre o que o corpo e a raquete FAZEM; "motor.abilities": 2–4 de ${list(MOTOR_ABILITIES)}.`,
    '- "positioning" (fundamento/jogada): pares — primeiro {type:"certo"}, depois o {type:"errado"} correspondente com o PORQUÊ ("… → a bola sobe").',
    '- "diagrams" (drill/jogada): quadra 0–100 nos dois eixos, rede em y=50, cozinha entre y=34 e y=66; setas "bola" para trajetória e "movimento" para deslocamento; rótulos "1","2","3" na ordem dos golpes; no máximo 12 elementos.',
    k === ITEM_KIND.TREINO ? '- "blocks": aquecimento (5–10 min) → técnica/tática → jogo (a maior parte) → volta à calma; "type" de aquecimento, tecnica, tatica, jogo, fisico, volta_calma.' : null,
    k === ITEM_KIND.FISICO ? '- "sets", "reps" (ex.: "12" ou "30 s"), "rest_sec" e "tempo" do exercício.' : null,
    '',
    'PROIBIDO',
    '- Inventar links, vídeos, imagens, estatísticas, nomes de estudos ou números de regra. "media" e "link" ficam vazios.',
    '- Copiar texto de livros ou sites.',
    '- Mais de um objetivo; dicas com negação ("não faça…").',
    '',
    'ANTES DE RESPONDER, confira: o objetivo é observável? Os passos cabem em "duration_min" com o número de jogadores? Cada dica tem até 8 palavras e aponta para fora do corpo? Cada variação diz a alavanca? Todo "errado" tem o seu "certo"?',
    '',
    'MODELO (preencha e devolva só o JSON):',
    JSON.stringify(itemJsonTemplate(k), null, 2),
    '',
    'EXEMPLO DE UM ITEM BEM FEITO:',
    JSON.stringify(AI_EXAMPLE, null, 2),
    '',
    `PEDIDO: ${ITEM_KIND_LABELS[k]} sobre ${habilidades}, para nível ${fmt(level)}, ${players ? `${players} jogadores` : 'número de jogadores a definir'}, ${minutes ? `${minutes} minutos` : 'duração a definir'}${place ? `, em ${place}` : ''}${equipment.length ? `, com ${equipment.join(', ')}` : ''}.${notes ? ` Observações: ${String(notes).slice(0, 500)}` : ''}`,
  ].filter((l) => l !== null).join('\n');
}

/** Tira cercas de código (```json … ```) e texto em volta do JSON. */
function extractJson(text) {
  const t = String(text ?? '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const first = Math.min(...['{', '['].map((c) => t.indexOf(c)).filter((i) => i >= 0));
  if (!Number.isFinite(first)) return t;
  const last = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  return last > first ? t.slice(first, last + 1) : t;
}

/**
 * Lê o JSON colado (um item, uma lista, ou `{ items: [...] }`) e valida cada
 * um. Nada é gravado aqui: a tela mostra a prévia.
 *
 * @param {string} text
 * @param {{ fromAi?: boolean }} [opts] IA: descarta mídia e link (seriam inventados)
 * @returns {{ ok: boolean, error: string, items: Array<{ value: object, valid: boolean,
 *   errors: Record<string,string>, quality: object, warnings: string[] }> }}
 */
export function parseItemsJson(text, { fromAi = false } = {}) {
  let data;
  try {
    data = JSON.parse(extractJson(text));
  } catch {
    return { ok: false, error: 'Não consegui ler o JSON. Confira se você colou a resposta inteira, do primeiro { ao último }.', items: [] };
  }
  const raw = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [data];
  const objs = raw.filter((x) => x && typeof x === 'object' && !Array.isArray(x));
  if (!objs.length) return { ok: false, error: 'O JSON não tem nenhum item.', items: [] };
  if (objs.length > MAX_IMPORT_ITEMS) {
    return { ok: false, error: `São ${objs.length} itens. Importe no máximo ${MAX_IMPORT_ITEMS} por vez.`, items: [] };
  }
  const items = objs.map((o) => {
    const input = fromAi ? { ...o, media: [], link: '' } : o;
    const { valid, errors, value } = normalizeItemInput(input);
    const warnings = [...cueWarnings(value.cues), ...positioningWarnings(value.positioning)];
    return { value, valid, errors, quality: itemQuality(value), warnings };
  });
  return { ok: true, error: '', items };
}
