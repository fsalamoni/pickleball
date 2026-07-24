/**
 * Preferências de notificação — domínio puro (sem I/O).
 *
 * Agrupa os tipos de notificação em categorias que o usuário pode silenciar
 * nas configurações. A imposição (enforcement) acontece na leitura do sino:
 * notificações de categorias silenciadas não são exibidas nem contadas.
 *
 * Os valores de tipo espelham `NOTIFICATION_TYPE` em
 * `core/services/notificationService.js`; ficam replicados aqui como strings
 * para manter este módulo puro (sem importar o serviço, que carrega o Firebase).
 */

/** Categorias de preferência, na ordem de exibição. */
export const NOTIFICATION_CATEGORIES = Object.freeze([
  {
    id: 'social',
    label: 'Mensagens e fórum',
    description: 'Mensagens de chat, convites de conversa e respostas ou menções no fórum.',
    types: ['chat_message', 'chat_invite', 'forum_reply', 'forum_mention'],
  },
  {
    id: 'clubs',
    label: 'Clubes e eventos',
    description: 'Convites, pedidos de ingresso, aprovações e novos eventos de clube.',
    types: [
      'event_invite', 'club_join_request', 'club_join_approved',
      'club_join_rejected', 'club_invite', 'club_invite_accepted',
      'club_event_published',
    ],
  },
  {
    id: 'tournaments',
    label: 'Torneios',
    description: 'Abertura de inscrições e avisos dos organizadores.',
    types: ['tournament_open', 'tournament_announcement'],
  },
  {
    id: 'partners',
    label: 'Parcerias de dupla',
    description: 'Convites de dupla e respostas dos parceiros.',
    types: ['partner_invite', 'partner_response'],
  },
  {
    id: 'reminders',
    label: 'Lembretes',
    description: 'Lembretes para completar o perfil e o nivelamento.',
    types: ['profile_reminder', 'leveling_reminder'],
  },
]);

/** Mapa tipo → id de categoria, construído uma vez a partir das categorias. */
const TYPE_TO_CATEGORY = (() => {
  const map = {};
  NOTIFICATION_CATEGORIES.forEach((cat) => {
    cat.types.forEach((t) => { map[t] = cat.id; });
  });
  return map;
})();

/** Retorna o id da categoria de um tipo, ou null (ex.: genérico/desconhecido). */
export function categoryOfType(type) {
  return TYPE_TO_CATEGORY[type] || null;
}

/** Preferências padrão: todas as categorias habilitadas. */
export function defaultNotificationPrefs() {
  const prefs = {};
  NOTIFICATION_CATEGORIES.forEach((cat) => { prefs[cat.id] = true; });
  return prefs;
}

/**
 * Normaliza um mapa cru de preferências para { categoriaId: boolean }, partindo
 * dos padrões (tudo ligado) e sobrescrevendo apenas booleanos explícitos.
 * Ignora chaves desconhecidas e valores não-booleanos.
 */
export function normalizeNotificationPrefs(raw) {
  const prefs = defaultNotificationPrefs();
  if (raw && typeof raw === 'object') {
    NOTIFICATION_CATEGORIES.forEach((cat) => {
      if (typeof raw[cat.id] === 'boolean') prefs[cat.id] = raw[cat.id];
    });
  }
  return prefs;
}

/**
 * Uma notificação está silenciada quando a categoria do seu tipo está
 * explicitamente desligada. Tipos sem categoria (genéricos/desconhecidos)
 * nunca são silenciados.
 */
export function isNotificationMuted(prefs, type) {
  const catId = categoryOfType(type);
  if (!catId) return false;
  const normalized = normalizeNotificationPrefs(prefs);
  return normalized[catId] === false;
}
