/**
 * Preferências de notificação — a CÓPIA do servidor.
 *
 * O pacote de Functions é publicado isolado e não enxerga `src/`, então a
 * regra existe duas vezes: aqui e em `src/modules/notifications/domain/
 * preferences.js` (o sino e a central) + `noticeFeed.js` (a área do aviso).
 * `notificationPrefs.parity.test.js` roda as duas sobre os mesmos avisos e
 * preferências e exige o mesmo resultado — mexer num lado só quebra o teste.
 *
 * Por que existe: a pessoa silencia uma categoria nas Configurações e o sino
 * obedece, mas o push no celular era enviado assim mesmo. "Desliguei e
 * continua chegando" é o pior tipo de aviso.
 */

/** Tipo → categoria silenciável. Mesma tabela de `NOTIFICATION_CATEGORIES`. */
const CATEGORY_TYPES = Object.freeze({
  social: ['chat_message', 'chat_invite', 'forum_reply', 'forum_mention'],
  clubs: [
    'event_invite', 'club_join_request', 'club_join_approved',
    'club_join_rejected', 'club_invite', 'club_invite_accepted',
    'club_event_published',
  ],
  tournaments: ['tournament_open', 'tournament_announcement'],
  partners: ['partner_invite', 'partner_response'],
  training: ['training_share', 'training_review', 'training_comment', 'training_question', 'training_answer'],
  gamification: ['gamification'],
  reminders: ['profile_reminder', 'leveling_reminder'],
});

const TYPE_TO_CATEGORY = Object.freeze(Object.entries(CATEGORY_TYPES)
  .reduce((m, [cat, tipos]) => { tipos.forEach((t) => { m[t] = cat; }); return m; }, {}));

/** Id da categoria de um tipo, ou `null` (genérico/desconhecido). */
function categoryOfType(type) {
  return TYPE_TO_CATEGORY[type] || null;
}

/**
 * Silenciado quando a categoria do tipo está EXPLICITAMENTE desligada
 * (`false`). Tipo sem categoria nunca é silenciado; valor que não é booleano
 * vale "ligado", como no cliente.
 */
function isNotificationMuted(prefs, type) {
  const cat = categoryOfType(type);
  if (!cat) return false;
  return Boolean(prefs) && typeof prefs === 'object' && prefs[cat] === false;
}

/* ------------------------------------------------ a ÁREA do aviso ------ */

const AREA_DO_TIPO = Object.freeze({
  chat_message: 'social',
  chat_invite: 'social',
  forum_reply: 'social',
  forum_mention: 'social',
  event_invite: 'clubes',
  club_join_request: 'clubes',
  club_join_approved: 'clubes',
  club_join_rejected: 'clubes',
  club_invite: 'clubes',
  club_invite_accepted: 'clubes',
  club_event_published: 'clubes',
  tournament_open: 'torneios',
  tournament_announcement: 'torneios',
  partner_invite: 'torneios',
  partner_response: 'torneios',
  profile_reminder: 'conta',
  leveling_reminder: 'conta',
  profile_admin_edit: 'conta',
  gamification: 'gamificacao',
  training_share: 'treino',
  training_review: 'treino',
  training_comment: 'treino',
  training_question: 'treino',
  training_answer: 'treino',
});

const AREA_DO_CAMINHO = Object.freeze({
  'minhas-reservas': 'arenas',
  campanhas: 'promocoes',
  promocoes: 'promocoes',
  'dia-de-jogo': 'jogos',
  'procura-jogo': 'jogos',
  'encontrar-jogadores': 'jogos',
  'meus-jogos': 'jogos',
  parceiros: 'jogos',
  ranking: 'jogos',
  'meu-desempenho': 'jogos',
  torneios: 'torneios',
  p: 'torneios',
  circuits: 'torneios',
  clubes: 'clubes',
  c: 'clubes',
  aulas: 'aulas',
  'minhas-aulas': 'aulas',
  coaches: 'aulas',
  treino: 'treino',
  chat: 'social',
  atleta: 'social',
  atletas: 'social',
  novidades: 'social',
  buscar: 'social',
  vinculos: 'gamificacao',
  conquistas: 'gamificacao',
  gamification: 'gamificacao',
  'hall-da-fama': 'gamificacao',
  configuracoes: 'conta',
  nivelamento: 'conta',
  legal: 'conta',
  'politica-uso': 'conta',
});

const AREA_DA_ARENA = Object.freeze({
  campanhas: 'promocoes',
  'open-match': 'jogos',
  matchmaking: 'jogos',
  aulas: 'aulas',
  torneios: 'torneios',
});

function areaFromLink(link) {
  if (typeof link !== 'string') return null;
  const t = link.trim();
  if (!t.startsWith('/') || t.startsWith('//')) return null;
  const seg = t.split(/[?#]/)[0].split('/').filter(Boolean);
  if (seg.length === 0) return null;
  const [primeiro, , terceiro] = seg;
  if (primeiro === 'arenas') {
    if (seg.length >= 3 && terceiro !== 'gerir') return AREA_DA_ARENA[terceiro] || 'arenas';
    return 'arenas';
  }
  if (primeiro === 'perfil') return seg[1] === 'torneios' ? 'torneios' : 'conta';
  return AREA_DO_CAMINHO[primeiro] || null;
}

/** A área do aviso: o tipo, quando específico; senão o destino; senão "outros". */
function noticeArea(notice) {
  if (!notice) return 'outros';
  return AREA_DO_TIPO[notice.type] || areaFromLink(notice.link) || 'outros';
}

module.exports = {
  CATEGORY_TYPES,
  categoryOfType,
  isNotificationMuted,
  noticeArea,
};
