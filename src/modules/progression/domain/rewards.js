/**
 * rewards — recompensas reais, liberadas por marcos (NÃO compradas com XP).
 *
 * Aula experimental, desconto numa arena, prioridade em lista de espera: o
 * "Pilar 6" do estudo — a gamificação com algo que existe fora da tela.
 *
 * ## Por que NÃO se compra com XP
 *
 * O estudo propõe uma loja, e o documento de estado da gamificação a trava de
 * propósito: o XP é DERIVADO (recalculado do que a pessoa fez), não um saldo.
 * Gastar exige saldo, saldo exige livro-razão com defesa contra duplicidade, e
 * isso reabre a pergunta do antifarm — tudo no mesmo dia. A saída que entrega o
 * valor sem a economia: a recompensa é uma PORTA que se abre ao cruzar um marco
 * (ser Expert, ter a conquista X, estar entre os 10% da temporada) — o XP
 * continua medindo a trajetória, não funcionando como moeda. Quando e se houver
 * economia de gasto, é uma decisão própria, com seu ledger.
 *
 * ## Quem emite e quem confere
 *
 * Plataforma, arena, clube e professor criam recompensas para o PÚBLICO deles.
 * A pessoa elegível PEDE (o pedido leva um código); o emissor CONFERE com os
 * dados públicos de progressão e marca como usada. Nada é entregue sozinho —
 * o mesmo desenho do pedido de pacote de horas da arena: quem entrega confirma.
 *
 * Lógica pura, sem I/O.
 */
import { TIER_NAMES } from './tiers.js';
import { t, tk, fmtLista } from '@/core/i18n';

export const REWARD_KIND = Object.freeze({
  DISCOUNT: 'discount',
  FREE_CLASS: 'free_class',
  PRIORITY: 'priority',
  GIFT: 'gift',
  ACCESS: 'access',
  OTHER: 'other',
});

export const REWARD_KIND_META = Object.freeze({
  discount: { label: tk('Desconto'), emoji: '🏷️' },
  free_class: { label: tk('Aula grátis'), emoji: '🎓' },
  priority: { label: tk('Prioridade'), emoji: '⏩' },
  gift: { label: tk('Brinde'), emoji: '🎁' },
  access: { label: tk('Acesso'), emoji: '🔑' },
  other: { label: tk('Benefício'), emoji: '⭐' },
});

export const REWARD_ISSUER_LABEL = Object.freeze({
  platform: 'PickleRush', arena: tk('Arena'), club: tk('Clube'), coach: tk('Professor'),
});

export const CLAIM_STATUS = Object.freeze({
  REQUESTED: 'requested',
  APPROVED: 'approved',
  REDEEMED: 'redeemed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
});

export const CLAIM_STATUS_LABEL = Object.freeze({
  requested: tk('Pedido enviado'),
  approved: tk('Liberada — apresente o código'),
  redeemed: tk('Usada'),
  rejected: tk('Recusada'),
  cancelled: tk('Cancelada'),
});

/** Os critérios que uma recompensa pode exigir (todos opcionais, todos somam). */
export const ELIGIBILITY_FIELDS = Object.freeze(['minTier', 'minLevel', 'achievementId', 'topPercent', 'minStreakWeeks', 'minGames']);

const tierRank = (nome) => Math.max(0, TIER_NAMES.indexOf(nome));

/**
 * Normaliza os critérios de elegibilidade (descarta o inválido).
 * @param {object} e
 */
export function normalizeEligibility(e = {}) {
  const out = {};
  if (TIER_NAMES.includes(e.minTier)) out.minTier = e.minTier;
  const nivel = Math.round(Number(e.minLevel));
  if (nivel >= 2 && nivel <= 200) out.minLevel = nivel;
  if (typeof e.achievementId === 'string' && /^[a-z0-9_]{3,60}$/.test(e.achievementId)) out.achievementId = e.achievementId;
  const top = Number(e.topPercent);
  if (top > 0 && top <= 100) out.topPercent = Math.round(top);
  const sem = Math.round(Number(e.minStreakWeeks));
  if (sem >= 2 && sem <= 52) out.minStreakWeeks = sem;
  const jogos = Math.round(Number(e.minGames));
  if (jogos >= 5 && jogos <= 5000) out.minGames = jogos;
  return out;
}

/**
 * A fotografia de quem pede, no formato que os critérios leem.
 * @param {{ tier?: string, level?: number, achievementIds?: Iterable<string>, seasonPercent?: number|null, streakWeeks?: number, games?: number }} s
 */
export function buildEligibilitySnapshot(s = {}) {
  return {
    tier: s.tier || 'Calouro',
    level: Number(s.level) || 1,
    achievementIds: new Set(s.achievementIds || []),
    seasonPercent: s.seasonPercent != null && Number.isFinite(Number(s.seasonPercent)) ? Number(s.seasonPercent) : null,
    streakWeeks: Number(s.streakWeeks) || 0,
    games: Number(s.games) || 0,
  };
}

/**
 * A pessoa se qualifica? E, se não, o que falta — por critério, em palavras.
 *
 * @returns {{ eligible: boolean, checks: Array<{ field: string, ok: boolean, label: string, have: string, need: string }> }}
 */
export function evaluateEligibility(eligibility, snapshot, { achievementName = (id) => id } = {}) {
  const e = normalizeEligibility(eligibility);
  const snap = snapshot || buildEligibilitySnapshot();
  const checks = [];
  if (e.minTier) {
    checks.push({ field: 'minTier', ok: tierRank(snap.tier) >= tierRank(e.minTier), label: t('Tier mínimo'), have: t(snap.tier), need: t(e.minTier) });
  }
  if (e.minLevel) {
    checks.push({ field: 'minLevel', ok: snap.level >= e.minLevel, label: t('Nível mínimo'), have: t('nível {n}', { n: snap.level }), need: t('nível {n}', { n: e.minLevel }) });
  }
  if (e.achievementId) {
    checks.push({ field: 'achievementId', ok: snap.achievementIds.has(e.achievementId), label: t('Conquista'), have: snap.achievementIds.has(e.achievementId) ? t('desbloqueada') : t('ainda não'), need: achievementName(e.achievementId) });
  }
  if (e.topPercent) {
    const ok = snap.seasonPercent != null && snap.seasonPercent <= e.topPercent;
    checks.push({ field: 'topPercent', ok, label: t('Posição na temporada'), have: snap.seasonPercent == null ? t('sem posição') : t('top {n}%', { n: Math.max(1, Math.ceil(snap.seasonPercent)) }), need: t('top {n}%', { n: e.topPercent }) });
  }
  if (e.minStreakWeeks) {
    checks.push({ field: 'minStreakWeeks', ok: snap.streakWeeks >= e.minStreakWeeks, label: t('Sequência'), have: t('{n} semanas', { n: snap.streakWeeks }), need: t('{n} semanas', { n: e.minStreakWeeks }) });
  }
  if (e.minGames) {
    checks.push({ field: 'minGames', ok: snap.games >= e.minGames, label: t('Jogos'), have: `${snap.games}`, need: `${e.minGames}` });
  }
  return { eligible: checks.every((c) => c.ok), checks };
}

/** "Expert, 50 jogos e a conquista Constância" — o critério em uma frase. */
export function describeEligibility(eligibility, { achievementName = (id) => id } = {}) {
  const e = normalizeEligibility(eligibility);
  const partes = [];
  if (e.minTier) partes.push(t('tier {tier} ou acima', { tier: t(e.minTier) }));
  if (e.minLevel) partes.push(t('nível {n}', { n: e.minLevel }));
  if (e.minGames) partes.push(t('{n} jogos', { n: e.minGames }));
  if (e.minStreakWeeks) partes.push(t('{n} semanas seguidas', { n: e.minStreakWeeks }));
  if (e.topPercent) partes.push(t('estar entre os {n}% da temporada', { n: e.topPercent }));
  if (e.achievementId) partes.push(t('a conquista {nome}', { nome: achievementName(e.achievementId) }));
  if (partes.length === 0) return t('Aberta a todos os atletas');
  if (partes.length === 1 && e.topPercent) return t('Para quem está entre os {n}% da temporada', { n: e.topPercent });
  return t('Para quem tem {criterios}', { criterios: fmtLista(partes) });
}

/** Valida/normaliza a definição de uma recompensa. */
export function validateReward(input = {}, issuer = {}) {
  const errors = {};
  const titulo = String(input.title || '').trim();
  if (titulo.length < 4) errors.title = t('Dê um nome à recompensa (ao menos 4 letras).');
  if (titulo.length > 80) errors.title = t('O nome pode ter até 80 letras.');
  const kind = REWARD_KIND_META[input.kind] ? input.kind : 'other';
  const qtd = input.quantity === null || input.quantity === '' || input.quantity === undefined
    ? null : Math.round(Number(input.quantity));
  if (qtd !== null && !(qtd >= 1 && qtd <= 10000)) errors.quantity = t('Informe uma quantidade entre 1 e 10.000 (ou deixe sem limite).');
  const validade = input.validUntil ? Number(input.validUntil) : null;
  if (validade !== null && !Number.isFinite(validade)) errors.validUntil = t('Data de validade inválida.');
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      issuerType: issuer.type,
      issuerId: issuer.id,
      // nome do emissor para a vitrine ("Arena Sol", "Clube X"): cosmético, o vínculo é issuerId
      issuerName: String(issuer.name || '').trim().slice(0, 80),
      title: titulo,
      description: String(input.description || '').trim().slice(0, 400),
      instructions: String(input.instructions || '').trim().slice(0, 300),
      kind,
      eligibility: normalizeEligibility(input.eligibility),
      quantity: qtd,
      approvedCount: Math.max(0, Math.round(Number(input.approvedCount) || 0)),
      validUntil: validade,
      status: input.status === 'paused' ? 'paused' : 'active',
      createdBy: issuer.uid,
      schemaVersion: 1,
    },
  };
}

/** A recompensa está disponível para pedido agora? */
export function rewardAvailability(reward, now = Date.now()) {
  if (!reward) return { available: false, reason: t('Recompensa indisponível.') };
  if (reward.status !== 'active') return { available: false, reason: t('Recompensa pausada pelo emissor.') };
  if (reward.validUntil && now > Number(reward.validUntil)) return { available: false, reason: t('A validade acabou.') };
  if (reward.quantity != null && (Number(reward.approvedCount) || 0) >= Number(reward.quantity)) {
    return { available: false, reason: t('Todas as unidades já foram liberadas.') };
  }
  return { available: true, remaining: reward.quantity != null ? Number(reward.quantity) - (Number(reward.approvedCount) || 0) : null };
}

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I/L

/** Código curto para apresentar ao emissor: 'RWD-7K3QXM'. */
export function generateClaimCode(random = Math.random) {
  let s = '';
  for (let i = 0; i < 6; i += 1) s += ALFABETO[Math.floor(random() * ALFABETO.length)];
  return `RWD-${s}`;
}

/** Um pedido por recompensa e por pessoa. */
export function claimDocId(rewardId, uid) {
  return `${rewardId}_${uid}`;
}

/** Transições permitidas — quem pode levar o pedido de qual estado para qual. */
export const CLAIM_TRANSITIONS = Object.freeze({
  requested: { issuer: ['approved', 'rejected'], owner: ['cancelled'] },
  approved: { issuer: ['redeemed', 'rejected'], owner: ['cancelled'] },
  redeemed: { issuer: [], owner: [] },
  rejected: { issuer: [], owner: [] },
  cancelled: { issuer: [], owner: [] },
});

export function canTransitionClaim(from, to, actor) {
  return Boolean(CLAIM_TRANSITIONS[from]?.[actor]?.includes(to));
}
