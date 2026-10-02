/**
 * onboarding — "Primeiros passos": o roteiro de quem acabou de chegar.
 *
 * O estudo é enfático: o hábito se forma nos primeiros dias, e a pessoa nova que
 * cai num hub vazio não volta. Aqui o hub ganha um roteiro curto, com XP
 * concreto por etapa e **nenhuma etapa obrigatória** — "Pular por agora" não é
 * escondido, e nada na plataforma depende de ter feito o roteiro.
 *
 * ## Como cada etapa é detectada
 *
 * Nunca por auto-declaração ("já fiz", um botão): a etapa é DETECTADA.
 *  - `fact`  — sai dos registros reais (`activityFacts`): foto, nível, clube...
 *  - `visit` — a pessoa abriu a tela (ranking, um torneio). É o único jeito de
 *    saber que ela "viu"; vale pouco XP justamente por ser o mais fraco.
 *  - `event` — a pessoa fez o ato que o app consegue observar (compartilhar o
 *    convite).
 *
 * ## O XP não regride
 *
 * Etapa detectada é GRAVADA em `user_gamification_prefs.onboarding.done` com a
 * data. O XP vem desse registro (`onboardingXp`), não da detecção ao vivo —
 * senão tirar a foto de perfil tiraria XP, e "ganhei XP" virou "perdi XP".
 * O teto é a soma do catálogo (350): mesmo com o documento editado à mão, o
 * ganho é limitado por construção (só ids conhecidos contam, uma vez cada).
 *
 * Lógica pura, sem I/O.
 */

/**
 * O roteiro. O id é CONTRATO (gravado no documento de preferências): nunca
 * renomeie. `day` é o dia sugerido — o roteiro é espalhado, não despejado.
 *
 * @type {ReadonlyArray<{
 *   id: string, kind: 'fact'|'visit'|'event', label: string, hint: string,
 *   xp: number, day: number, to: string, cta: string, visit?: RegExp,
 * }>}
 */
export const ONBOARDING_STEPS = Object.freeze([
  {
    id: 'level', kind: 'fact', xp: 50, day: 1,
    label: 'Defina o seu nível',
    hint: 'O nível equilibra duplas e sorteios. Leva um minuto.',
    to: '/nivelamento', cta: 'Fazer o nivelamento',
  },
  {
    id: 'photo', kind: 'fact', xp: 30, day: 1,
    label: 'Coloque uma foto de perfil',
    hint: 'Quem joga com você reconhece você na lista.',
    to: '/perfil/editar', cta: 'Adicionar foto',
  },
  {
    id: 'profile', kind: 'fact', xp: 40, day: 1,
    label: 'Complete o seu cadastro',
    hint: 'Cidade, lado da quadra e interesses ajudam a achar jogo perto de você.',
    to: '/perfil/editar', cta: 'Completar cadastro',
  },
  {
    id: 'ranking', kind: 'visit', xp: 20, day: 2, visit: /^\/ranking(\/|$)/,
    label: 'Veja o ranking',
    hint: 'Descubra onde você se encaixa e quem joga no seu nível.',
    to: '/ranking', cta: 'Abrir o ranking',
  },
  {
    id: 'follow', kind: 'fact', xp: 30, day: 2,
    label: 'Siga 3 atletas',
    hint: 'Acompanhe quem joga perto de você e veja os resultados deles.',
    to: '/atletas', cta: 'Encontrar atletas',
  },
  {
    id: 'club', kind: 'fact', xp: 50, day: 3,
    label: 'Entre em um clube',
    hint: 'Clubes têm eventos, dias de jogo e gente para jogar toda semana.',
    to: '/clubes', cta: 'Ver clubes',
  },
  {
    id: 'watch', kind: 'visit', xp: 30, day: 4, visit: /^\/torneios\/[^/]+/,
    label: 'Acompanhe um torneio',
    hint: 'Abra a página de um torneio para ver a tabela, os jogos e o placar.',
    to: '/torneios', cta: 'Ver torneios',
  },
  {
    id: 'tournament', kind: 'fact', xp: 50, day: 5,
    label: 'Inscreva-se num torneio',
    hint: 'Torneio é onde o seu nível vira ranking. Há categorias para iniciantes.',
    to: '/torneios', cta: 'Ver torneios abertos',
  },
  {
    id: 'share', kind: 'event', xp: 50, day: 7,
    label: 'Convide um amigo',
    hint: 'Compartilhe o seu convite — quem entra por ele joga com você.',
    to: '/gamification?aba=convite', cta: 'Compartilhar convite',
  },
]);

export const ONBOARDING_MAX_XP = ONBOARDING_STEPS.reduce((s, p) => s + p.xp, 0);

const POR_ID = Object.freeze(Object.fromEntries(ONBOARDING_STEPS.map((p) => [p.id, p])));

/** O passo existe? */
export function onboardingStep(id) {
  return POR_ID[id] || null;
}

/**
 * Quais etapas dos FATOS estão cumpridas agora.
 *
 * Fonte desconhecida (`facts.known(...) === false`) NÃO cumpre a etapa — e,
 * por consequência, ela não é gravada: quando a fonte voltar, a etapa é
 * detectada e vale. Nunca o contrário (marcar sem saber).
 *
 * @param {ReturnType<import('./activityFacts.js').buildActivityFacts>|null} facts
 * @returns {Set<string>}
 */
export function detectFactSteps(facts) {
  const feitos = new Set();
  if (!facts) return feitos;
  const c = facts.counts || {};
  const p = facts.profile || {};
  if (p.hasLevel) feitos.add('level');
  if (p.hasPhoto) feitos.add('photo');
  if (p.registrationComplete) feitos.add('profile');
  if (facts.known?.('following') !== false && c.follows >= 3) feitos.add('follow');
  if (facts.known?.('clubs') !== false && c.clubsJoined >= 1) feitos.add('club');
  if (facts.known?.('registrations') !== false && c.tournamentRegistrations >= 1) feitos.add('tournament');
  // convidar: quem já teve alguém entrando pelo código cumpriu — o clique de
  // compartilhar é o outro caminho (`event`), gravado quando acontece.
  if (facts.known?.('referral') !== false && c.referralsSignedUp >= 1) feitos.add('share');
  return feitos;
}

/** O passo de visita que esta rota cumpre (ou null). */
export function stepForVisit(pathname) {
  const caminho = String(pathname || '');
  const passo = ONBOARDING_STEPS.find((p) => p.kind === 'visit' && p.visit.test(caminho));
  return passo ? passo.id : null;
}

/**
 * Quantos dias se passaram desde que a pessoa entrou (0 = hoje). Sem data
 * confiável, 0 — o roteiro começa do começo.
 */
export function daysSinceJoined(createdAtMs, now = new Date()) {
  const ms = Number(createdAtMs);
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.max(0, Math.floor((now.getTime() - ms) / 86_400_000));
}

/**
 * O estado do roteiro, pronto para a tela.
 *
 * @param {{
 *   facts: ReturnType<import('./activityFacts.js').buildActivityFacts>|null,
 *   done?: Record<string, number>,    // `prefs.onboarding.done`
 *   dismissed?: boolean,
 *   joinedDays?: number,
 * }} p
 * @returns {{
 *   steps: Array<object>, doneCount: number, total: number, progress: number,
 *   xpEarned: number, xpAvailable: number, complete: boolean, dismissed: boolean,
 *   toRecord: string[], next: object|null, todayIds: string[],
 * }}
 */
export function evaluateOnboarding({ facts, done = {}, dismissed = false, joinedDays = 0 } = {}) {
  const detectadas = detectFactSteps(facts);
  const gravadas = new Set(Object.keys(done || {}).filter((id) => POR_ID[id]));
  const steps = ONBOARDING_STEPS.map((p) => {
    const gravado = gravadas.has(p.id);
    const agora = detectadas.has(p.id);
    return {
      ...p,
      complete: gravado || agora,
      recorded: gravado,
      // o dia sugerido já chegou?
      due: p.day <= joinedDays + 1,
    };
  });
  const doneCount = steps.filter((p) => p.complete).length;
  const xpEarned = steps.filter((p) => p.recorded).reduce((s, p) => s + p.xp, 0);
  const pendentes = steps.filter((p) => !p.complete);
  const complete = doneCount === steps.length;
  return {
    steps,
    doneCount,
    total: steps.length,
    progress: steps.length ? doneCount / steps.length : 0,
    xpEarned,
    xpAvailable: ONBOARDING_MAX_XP - xpEarned,
    complete,
    dismissed: Boolean(dismissed),
    /** etapas detectadas agora que ainda não foram gravadas */
    toRecord: steps.filter((p) => detectadas.has(p.id) && !p.recorded).map((p) => p.id),
    next: pendentes.find((p) => p.due) || pendentes[0] || null,
    todayIds: pendentes.filter((p) => p.due).map((p) => p.id),
  };
}

/**
 * XP do roteiro: só do que está GRAVADO, só ids conhecidos, uma vez cada.
 * @param {Record<string, number>|null|undefined} done
 */
export function onboardingXp(done) {
  if (!done || typeof done !== 'object') return 0;
  return Object.keys(done).reduce((s, id) => s + (POR_ID[id] ? POR_ID[id].xp : 0), 0);
}

/**
 * O card do roteiro deve aparecer? Some quando completo ou dispensado, e para
 * quem já tem bastante história na plataforma (não é "novo": mostrar o roteiro
 * a quem joga há meses é ruído).
 */
export function shouldShowOnboarding(state, { joinedDays = 0, activityCount = 0 } = {}) {
  if (!state || state.complete || state.dismissed) return false;
  if (joinedDays > 60 && activityCount >= 25 && state.doneCount >= 4) return false;
  return true;
}
