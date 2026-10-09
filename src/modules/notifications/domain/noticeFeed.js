/**
 * A LISTA de notificações — domínio puro (sem I/O, sem React).
 *
 * O sino e a central de notificações (`/notificacoes`) mostram a MESMA lista,
 * e as decisões que dão forma a ela moram aqui, num lugar só:
 *
 *  - **a hora** de cada aviso (`noticeTime`): o servidor grava `created_at`
 *    (Timestamp) e o cliente grava também `created_at_ms`. Logo depois de
 *    criado, o `created_at` local ainda é `null` (o `serverTimestamp` não
 *    voltou), e aviso gravado pelo servidor não tem `created_at_ms` — por isso
 *    os dois, nessa ordem, pelo conversor único (`instanteEmMs`);
 *  - **a ordem** (`sortNotices`): do mais novo ao mais antigo, e o que não tem
 *    data no fim — nunca no topo, fingindo ser novo;
 *  - **o rótulo de tempo** (`noticeTimeLabel`): "há 5 min", "ontem, 14:05",
 *    "seg, 14:05", "28/09" — em dia LOCAL, montado das constantes daqui (não
 *    de `toLocaleDateString`, que depende da configuração da máquina);
 *  - **o grupo do dia** (`groupNotices`): Hoje, Ontem, Nos últimos 7 dias e,
 *    daí para trás, um grupo por mês — é o que torna o histórico navegável;
 *  - **a ÁREA** de cada aviso (`noticeArea`): quase todo aviso da plataforma
 *    é gravado como `generic` (arenas, dia de jogo, aulas, campanhas…), então
 *    o TIPO sozinho não diz nada. A área sai do tipo quando ele é específico
 *    e, senão, do DESTINO do aviso (o `link`). Nada novo no banco: é leitura
 *    do que já está gravado;
 *  - **os filtros** (não lidas, área, busca) e o estado deles na URL.
 */
import { instanteEmMs } from '@/core/domain/instant';

/** Quantos avisos o sino mostra antes do "Ver todas". */
export const BELL_LIMIT = 20;

/** De quantos em quantos a central mostra ao pedir "Mostrar mais". */
export const NOTICE_PAGE_STEP = 30;

export const NOTICE_AREA = Object.freeze({
  TORNEIOS: 'torneios',
  JOGOS: 'jogos',
  ARENAS: 'arenas',
  CLUBES: 'clubes',
  AULAS: 'aulas',
  TREINO: 'treino',
  SOCIAL: 'social',
  PROMOCOES: 'promocoes',
  GAMIFICACAO: 'gamificacao',
  CONTA: 'conta',
  OUTROS: 'outros',
});

/** As áreas, na ordem em que aparecem nos filtros. */
export const NOTICE_AREAS = Object.freeze([
  { id: NOTICE_AREA.JOGOS, label: 'Dias de jogo e jogos', curto: 'Jogos' },
  { id: NOTICE_AREA.TORNEIOS, label: 'Torneios', curto: 'Torneios' },
  { id: NOTICE_AREA.ARENAS, label: 'Arenas e reservas', curto: 'Arenas' },
  { id: NOTICE_AREA.CLUBES, label: 'Clubes', curto: 'Clubes' },
  { id: NOTICE_AREA.AULAS, label: 'Aulas', curto: 'Aulas' },
  { id: NOTICE_AREA.TREINO, label: 'Treino', curto: 'Treino' },
  { id: NOTICE_AREA.SOCIAL, label: 'Mensagens e comunidade', curto: 'Mensagens' },
  { id: NOTICE_AREA.PROMOCOES, label: 'Promoções e campanhas', curto: 'Promoções' },
  { id: NOTICE_AREA.GAMIFICACAO, label: 'Gamificação', curto: 'Gamificação' },
  { id: NOTICE_AREA.CONTA, label: 'Sua conta', curto: 'Conta' },
  { id: NOTICE_AREA.OUTROS, label: 'Outros avisos', curto: 'Outros' },
]);

const AREA_IDS = new Set(NOTICE_AREAS.map((a) => a.id));

export function noticeAreaMeta(id) {
  return NOTICE_AREAS.find((a) => a.id === id) || NOTICE_AREAS[NOTICE_AREAS.length - 1];
}

/** Tipos específicos → área. O `generic` não está aqui de propósito. */
const AREA_DO_TIPO = Object.freeze({
  chat_message: NOTICE_AREA.SOCIAL,
  chat_invite: NOTICE_AREA.SOCIAL,
  forum_reply: NOTICE_AREA.SOCIAL,
  forum_mention: NOTICE_AREA.SOCIAL,
  event_invite: NOTICE_AREA.CLUBES,
  club_join_request: NOTICE_AREA.CLUBES,
  club_join_approved: NOTICE_AREA.CLUBES,
  club_join_rejected: NOTICE_AREA.CLUBES,
  club_invite: NOTICE_AREA.CLUBES,
  club_invite_accepted: NOTICE_AREA.CLUBES,
  club_event_published: NOTICE_AREA.CLUBES,
  tournament_open: NOTICE_AREA.TORNEIOS,
  tournament_announcement: NOTICE_AREA.TORNEIOS,
  partner_invite: NOTICE_AREA.TORNEIOS,
  partner_response: NOTICE_AREA.TORNEIOS,
  profile_reminder: NOTICE_AREA.CONTA,
  leveling_reminder: NOTICE_AREA.CONTA,
  profile_admin_edit: NOTICE_AREA.CONTA,
  gamification: NOTICE_AREA.GAMIFICACAO,
  training_share: NOTICE_AREA.TREINO,
  training_review: NOTICE_AREA.TREINO,
  training_comment: NOTICE_AREA.TREINO,
  training_question: NOTICE_AREA.TREINO,
  training_answer: NOTICE_AREA.TREINO,
});

/** Primeiro segmento do caminho → área (o que não depende do resto). */
const AREA_DO_CAMINHO = Object.freeze({
  'minhas-reservas': NOTICE_AREA.ARENAS,
  campanhas: NOTICE_AREA.PROMOCOES,
  promocoes: NOTICE_AREA.PROMOCOES,
  'dia-de-jogo': NOTICE_AREA.JOGOS,
  'procura-jogo': NOTICE_AREA.JOGOS,
  'encontrar-jogadores': NOTICE_AREA.JOGOS,
  'meus-jogos': NOTICE_AREA.JOGOS,
  parceiros: NOTICE_AREA.JOGOS,
  ranking: NOTICE_AREA.JOGOS,
  'meu-desempenho': NOTICE_AREA.JOGOS,
  torneios: NOTICE_AREA.TORNEIOS,
  p: NOTICE_AREA.TORNEIOS,
  circuits: NOTICE_AREA.TORNEIOS,
  clubes: NOTICE_AREA.CLUBES,
  c: NOTICE_AREA.CLUBES,
  aulas: NOTICE_AREA.AULAS,
  'minhas-aulas': NOTICE_AREA.AULAS,
  coaches: NOTICE_AREA.AULAS,
  treino: NOTICE_AREA.TREINO,
  chat: NOTICE_AREA.SOCIAL,
  atleta: NOTICE_AREA.SOCIAL,
  atletas: NOTICE_AREA.SOCIAL,
  novidades: NOTICE_AREA.SOCIAL,
  buscar: NOTICE_AREA.SOCIAL,
  vinculos: NOTICE_AREA.GAMIFICACAO,
  conquistas: NOTICE_AREA.GAMIFICACAO,
  gamification: NOTICE_AREA.GAMIFICACAO,
  'hall-da-fama': NOTICE_AREA.GAMIFICACAO,
  configuracoes: NOTICE_AREA.CONTA,
  nivelamento: NOTICE_AREA.CONTA,
  legal: NOTICE_AREA.CONTA,
  'politica-uso': NOTICE_AREA.CONTA,
});

/** Dentro de `/arenas/:id/<sub>` (visão de quem joga — a gestão é da arena). */
const AREA_DA_ARENA = Object.freeze({
  campanhas: NOTICE_AREA.PROMOCOES,
  'open-match': NOTICE_AREA.JOGOS,
  matchmaking: NOTICE_AREA.JOGOS,
  aulas: NOTICE_AREA.AULAS,
  torneios: NOTICE_AREA.TORNEIOS,
});

function segmentosDoLink(link) {
  if (typeof link !== 'string') return [];
  const t = link.trim();
  if (!t.startsWith('/') || t.startsWith('//')) return [];
  const caminho = t.split(/[?#]/)[0];
  return caminho.split('/').filter(Boolean);
}

/** A área que o DESTINO do aviso indica, ou `null` sem pista. */
export function noticeAreaFromLink(link) {
  const seg = segmentosDoLink(link);
  if (seg.length === 0) return null;
  const [primeiro, , terceiro] = seg;
  if (primeiro === 'arenas') {
    // `/arenas/:id/gerir…` é o trabalho de quem cuida da arena: fica em
    // Arenas, mesmo quando o assunto é a aula ou o torneio da casa.
    if (seg.length >= 3 && terceiro !== 'gerir') return AREA_DA_ARENA[terceiro] || NOTICE_AREA.ARENAS;
    return NOTICE_AREA.ARENAS;
  }
  if (primeiro === 'perfil') return seg[1] === 'torneios' ? NOTICE_AREA.TORNEIOS : NOTICE_AREA.CONTA;
  return AREA_DO_CAMINHO[primeiro] || null;
}

/**
 * A área de um aviso: o tipo, quando ele é específico; senão o destino; e
 * "Outros" quando nem um nem outro dizem nada.
 */
export function noticeArea(notice) {
  if (!notice) return NOTICE_AREA.OUTROS;
  return AREA_DO_TIPO[notice.type] || noticeAreaFromLink(notice.link) || NOTICE_AREA.OUTROS;
}

/** O instante do aviso, em ms; `NaN` quando ele não tem data legível. */
export function noticeTime(notice) {
  if (!notice) return NaN;
  const doServidor = instanteEmMs(notice.created_at);
  if (Number.isFinite(doServidor)) return doServidor;
  const doCliente = instanteEmMs(notice.created_at_ms);
  return Number.isFinite(doCliente) ? doCliente : NaN;
}

/** Do mais novo ao mais antigo; sem data vai para o fim. Não muda a lista. */
export function sortNotices(list = []) {
  return [...(list || [])]
    .map((n, i) => ({ n, i, t: noticeTime(n) }))
    .sort((a, b) => {
      const aOk = Number.isFinite(a.t);
      const bOk = Number.isFinite(b.t);
      if (aOk && bOk && a.t !== b.t) return b.t - a.t;
      if (aOk !== bOk) return aOk ? -1 : 1;
      return a.i - b.i;
    })
    .map((x) => x.n);
}

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAS_LONGOS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

const dois = (n) => String(n).padStart(2, '0');
const hora = (d) => `${dois(d.getHours())}:${dois(d.getMinutes())}`;
const inicioDoDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Quantos dias de CALENDÁRIO (locais) separam `ms` de `agora`. */
function diasAtras(ms, agora) {
  // `round` absorve dia de 23 ou 25 horas (horário de verão).
  return Math.round((inicioDoDia(new Date(agora)) - inicioDoDia(new Date(ms))) / 86400000);
}

/**
 * O rótulo curto de tempo de um aviso: "agora", "há 5 min", "há 3 h",
 * "ontem, 14:05", "seg, 14:05" (até 6 dias), "28/09" (no ano) ou
 * "28/09/2025". Vazio sem data.
 */
export function noticeTimeLabel(ms, agora = Date.now()) {
  if (!Number.isFinite(ms)) return '';
  const diff = agora - ms;
  // Relógio do aparelho atrasado: alguns minutos "no futuro" são "agora".
  if (diff < 60_000 && diff > -5 * 60_000) return 'agora';
  const d = new Date(ms);
  const dias = diasAtras(ms, agora);
  if (diff > 0 && dias === 0) {
    if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)} min`;
    return `há ${Math.floor(diff / 3_600_000)} h`;
  }
  if (dias === 1) return `ontem, ${hora(d)}`;
  if (dias > 1 && dias <= 6) return `${DIAS_CURTOS[d.getDay()]}, ${hora(d)}`;
  const data = `${dois(d.getDate())}/${dois(d.getMonth() + 1)}`;
  return d.getFullYear() === new Date(agora).getFullYear() ? data : `${data}/${d.getFullYear()}`;
}

/** A data completa, para o `title`/leitor de tela: "segunda-feira, 28 de setembro de 2026, 14:05". */
export function noticeFullDate(ms) {
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  return `${DIAS_LONGOS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}, ${hora(d)}`;
}

/** O grupo do dia em que o aviso cai na central. */
export function noticeGroupOf(ms, agora = Date.now()) {
  if (!Number.isFinite(ms)) return { key: 'sem-data', label: 'Sem data' };
  const dias = diasAtras(ms, agora);
  if (dias <= 0) return { key: 'hoje', label: 'Hoje' };
  if (dias === 1) return { key: 'ontem', label: 'Ontem' };
  if (dias <= 6) return { key: 'semana', label: 'Nos últimos 7 dias' };
  const d = new Date(ms);
  const mes = MESES[d.getMonth()];
  return {
    key: `mes-${d.getFullYear()}-${dois(d.getMonth() + 1)}`,
    label: `${mes.charAt(0).toUpperCase()}${mes.slice(1)} de ${d.getFullYear()}`,
  };
}

/**
 * Agrupa uma lista JÁ ORDENADA por dia, preservando a ordem:
 * `[{ key, label, items }]`.
 */
export function groupNotices(list = [], agora = Date.now()) {
  const grupos = [];
  const porChave = new Map();
  (list || []).forEach((n) => {
    const g = noticeGroupOf(noticeTime(n), agora);
    let grupo = porChave.get(g.key);
    if (!grupo) {
      grupo = { ...g, items: [] };
      porChave.set(g.key, grupo);
      grupos.push(grupo);
    }
    grupo.items.push(n);
  });
  return grupos;
}

/** Minúsculas e sem acento — para a busca casar "reuniao" com "Reunião". */
export function semAcento(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function textoDoAviso(n) {
  return semAcento([n?.title, n?.message, n?.actor_name].filter(Boolean).join(' '));
}

/**
 * Aplica os filtros da central. Vários termos na busca ESTREITAM (todos têm de
 * aparecer), em qualquer ordem, ignorando acento e caixa.
 */
export function filterNotices(list = [], { somenteNaoLidas = false, area = null, busca = '' } = {}) {
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  return (list || []).filter((n) => {
    if (somenteNaoLidas && n?.read) return false;
    if (area && noticeArea(n) !== area) return false;
    if (termos.length > 0) {
      const texto = textoDoAviso(n);
      if (!termos.every((t) => texto.includes(t))) return false;
    }
    return true;
  });
}

/**
 * As áreas que têm aviso, na ordem dos filtros, com o total e as não lidas:
 * `[{ id, label, curto, total, naoLidas }]`. Área sem aviso não vira filtro.
 */
export function noticeAreaCounts(list = []) {
  const contagem = new Map();
  (list || []).forEach((n) => {
    const id = noticeArea(n);
    const c = contagem.get(id) || { total: 0, naoLidas: 0 };
    c.total += 1;
    if (!n?.read) c.naoLidas += 1;
    contagem.set(id, c);
  });
  return NOTICE_AREAS
    .filter((a) => contagem.has(a.id))
    .map((a) => ({ ...a, ...contagem.get(a.id) }));
}

/** O número do selo do sino: '' (nada), '1'…'99' ou '99+'. */
export function formatUnreadBadge(count) {
  const n = Math.trunc(Number(count) || 0);
  if (n <= 0) return '';
  return n > 99 ? '99+' : String(n);
}

/** O nome acessível do sino, com a contagem por extenso. */
export function bellAccessibleLabel(count) {
  const n = Math.trunc(Number(count) || 0);
  if (n <= 0) return 'Notificações';
  return `Notificações (${n} não ${n === 1 ? 'lida' : 'lidas'})`;
}

/**
 * O que cabe no sino: os `limit` mais novos, quantos ficaram de fora e
 * quantos dos de fora ainda não foram lidos (é o que o "Ver todas" precisa
 * dizer — senão o selo conta avisos que a pessoa não acha no sino).
 */
export function bellSlice(list = [], limit = BELL_LIMIT) {
  const todos = list || [];
  const itens = todos.slice(0, limit);
  const fora = todos.slice(limit);
  return {
    itens,
    restantes: fora.length,
    naoLidasFora: fora.filter((n) => !n?.read).length,
  };
}

/** Os filtros da central a partir da URL (valores inválidos caem no padrão). */
export function noticeFiltersFromParams(params) {
  const get = (k) => (params && typeof params.get === 'function' ? params.get(k) : null);
  const area = get('area');
  return {
    somenteNaoLidas: get('filtro') === 'nao-lidas',
    area: AREA_IDS.has(area) ? area : null,
    busca: String(get('q') || '').slice(0, 80),
    silenciados: get('silenciados') === '1',
  };
}

/** Os filtros da central para a URL — só o que difere do padrão. */
export function noticeFiltersToParams({ somenteNaoLidas, area, busca, silenciados } = {}) {
  const out = {};
  if (somenteNaoLidas) out.filtro = 'nao-lidas';
  if (area && AREA_IDS.has(area)) out.area = area;
  // Sem `trim` no valor: a busca é digitada ao vivo, e cortar o espaço do fim
  // faria o campo "comer" o espaço entre duas palavras.
  if (String(busca || '').trim()) out.q = String(busca).slice(0, 80);
  if (silenciados) out.silenciados = '1';
  return out;
}
