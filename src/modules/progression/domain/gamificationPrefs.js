/**
 * gamificationPrefs — o que CADA PESSOA decide sobre a própria gamificação.
 *
 * Mora em `user_gamification_prefs/{uid}` (privado: só o dono lê e escreve).
 * Está no banco, e não no navegador, por um motivo: o SERVIDOR precisa respeitar
 * a escolha — a função da temporada não pode pôr no placar público quem pediu
 * para não aparecer, e a de notificação não pode mandar a revisão da semana a
 * quem a desligou. Preferência só de tela (modo escuro, cards do início) segue
 * no navegador; preferência que o servidor precisa honrar mora aqui.
 *
 * Padrão = o mais seguro para a pessoa que nunca abriu a tela: ela aparece
 * no placar? Sim — o ranking da plataforma já é público e o Hall só mostra
 * nome e foto de quem tem perfil no diretório. Recebe duelo, avaliação e carta?
 * Sim, mas com saída em um toque. O que cobra atenção (notificação) é pouco e
 * desligável.
 *
 * Lógica pura, sem I/O.
 */

export const GAMIFICATION_PREFS_VERSION = 1;

export const DEFAULT_GAMIFICATION_PREFS = Object.freeze({
  schemaVersion: GAMIFICATION_PREFS_VERSION,
  privacy: Object.freeze({
    /** Aparecer, com nome e foto, no placar público da temporada. */
    showInHallOfFame: true,
    /** Mostrar tier e conquistas no perfil que os outros veem. */
    showOnPublicProfile: true,
  }),
  social: Object.freeze({
    acceptDuels: true,
    acceptReviews: true,
    acceptLetters: true,
  }),
  notifications: Object.freeze({
    weeklyReview: true,
    duels: true,
    challengeResults: true,
  }),
  display: Object.freeze({
    /** Título exibido ao lado do nome: id de conquista ou null (usa o tier). */
    title: null,
    /** Mostrar os avisos de celebração na tela. */
    celebrations: true,
  }),
  onboarding: Object.freeze({
    dismissed: false,
    /** passo → quando foi concluído (ms). Só cresce: XP não regride. */
    done: Object.freeze({}),
  }),
  /** marco → quando foi comemorado (ms). Evita comemorar de novo. */
  celebrated: Object.freeze({}),
});

/** Teto de entradas dos mapas — o mesmo limite vale nas regras do banco. */
export const PREFS_MAP_LIMITS = Object.freeze({ onboardingDone: 24, celebrated: 120 });

const bool = (v, d) => (typeof v === 'boolean' ? v : d);

function mapaDeMarcas(bruto, max) {
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return {};
  const out = {};
  Object.entries(bruto).slice(0, max).forEach(([k, v]) => {
    const ms = Number(v);
    if (/^[a-z0-9_:.-]{1,60}$/i.test(k) && Number.isFinite(ms) && ms > 0) out[k] = Math.round(ms);
  });
  return out;
}

/**
 * Normaliza o documento lido (ou um patch montado pela tela). Nunca lança.
 *
 * @param {object|null|undefined} bruto
 * @param {string} [uid]
 */
export function normalizeGamificationPrefs(bruto, uid) {
  const d = DEFAULT_GAMIFICATION_PREFS;
  const s = bruto && typeof bruto === 'object' ? bruto : {};
  const titulo = typeof s.display?.title === 'string' && /^[a-z0-9_]{1,60}$/.test(s.display.title)
    ? s.display.title : null;
  const out = {
    schemaVersion: GAMIFICATION_PREFS_VERSION,
    privacy: {
      showInHallOfFame: bool(s.privacy?.showInHallOfFame, d.privacy.showInHallOfFame),
      showOnPublicProfile: bool(s.privacy?.showOnPublicProfile, d.privacy.showOnPublicProfile),
    },
    social: {
      acceptDuels: bool(s.social?.acceptDuels, d.social.acceptDuels),
      acceptReviews: bool(s.social?.acceptReviews, d.social.acceptReviews),
      acceptLetters: bool(s.social?.acceptLetters, d.social.acceptLetters),
    },
    notifications: {
      weeklyReview: bool(s.notifications?.weeklyReview, d.notifications.weeklyReview),
      duels: bool(s.notifications?.duels, d.notifications.duels),
      challengeResults: bool(s.notifications?.challengeResults, d.notifications.challengeResults),
    },
    display: {
      title: titulo,
      celebrations: bool(s.display?.celebrations, d.display.celebrations),
    },
    onboarding: {
      dismissed: bool(s.onboarding?.dismissed, d.onboarding.dismissed),
      done: mapaDeMarcas(s.onboarding?.done, PREFS_MAP_LIMITS.onboardingDone),
    },
    celebrated: mapaDeMarcas(s.celebrated, PREFS_MAP_LIMITS.celebrated),
  };
  if (uid) out.uid = uid;
  return out;
}

/**
 * Aplica um patch RASO por seção (`{ privacy: { showInHallOfFame: false } }`).
 * Mapas (`onboarding.done`, `celebrated`) só ganham chaves — nunca perdem: o
 * progresso do onboarding e os marcos já comemorados não regridem.
 */
export function mergeGamificationPrefs(atual, patch, uid) {
  const base = normalizeGamificationPrefs(atual, uid);
  const p = patch && typeof patch === 'object' ? patch : {};
  return normalizeGamificationPrefs({
    privacy: { ...base.privacy, ...(p.privacy || {}) },
    social: { ...base.social, ...(p.social || {}) },
    notifications: { ...base.notifications, ...(p.notifications || {}) },
    display: { ...base.display, ...(p.display || {}) },
    onboarding: {
      dismissed: p.onboarding?.dismissed ?? base.onboarding.dismissed,
      done: { ...(p.onboarding?.done || {}), ...base.onboarding.done },
    },
    celebrated: { ...(p.celebrated || {}), ...base.celebrated },
  }, uid);
}

/**
 * O servidor e as telas perguntam isto — uma pergunta, uma resposta: esta
 * pessoa quer aparecer no placar público?
 */
export function wantsPublicRanking(prefs) {
  return normalizeGamificationPrefs(prefs).privacy.showInHallOfFame;
}
