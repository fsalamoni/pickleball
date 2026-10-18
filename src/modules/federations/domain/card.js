/**
 * A carteirinha digital: tudo o que está escrito nela sai daqui — a tela só
 * desenha. Puro, sem React.
 */
import { t, tk, fmtData } from '@/core/i18n';
import { readableInk, BRAND_DEFAULT_COLOR, normalizeHex } from '@/modules/arenas/domain/whiteLabel.js';
import { MEMBER_STATUS, PLAN_PERSON_TYPE_LABELS, PLAN_TIER_LABELS } from './constants.js';
import { isoDate, membershipState } from './membership.js';

/** A faixa de situação: cor E texto (nunca só a cor). */
export const CARD_BAND = Object.freeze({
  active: { tone: 'green', label: tk('Em dia') },
  expiring: { tone: 'amber', label: tk('Vence em breve') },
  expired: { tone: 'amber', label: tk('Vencida') },
  suspended: { tone: 'red', label: tk('Suspensa') },
  other: { tone: 'gray', label: tk('Sem validade') },
});

/** O caminho público de verificação de um código. */
export const verifyPath = (code) => `/f/verificar/${encodeURIComponent(String(code || ''))}`;

/** "12/03/2027" a partir de 'YYYY-MM-DD'. */
export function dataCurta(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return '—';
  return fmtData(new Date(`${iso}T12:00:00`), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * O modelo da carteirinha de UMA filiação.
 * @param {{ member: object, federation: object, plan?: object|null, origin?: string, hoje?: string }} input
 */
export function buildMemberCard({ member, federation, plan = null, origin = '', hoje = isoDate() } = {}) {
  const st = membershipState(member, hoje);
  let band = CARD_BAND.other;
  if (st.status === MEMBER_STATUS.ACTIVE) band = st.expiring ? CARD_BAND.expiring : CARD_BAND.active;
  else if (st.status === MEMBER_STATUS.EXPIRED) band = CARD_BAND.expired;
  else if (st.status === MEMBER_STATUS.SUSPENDED) band = CARD_BAND.suspended;
  const color = normalizeHex(federation?.branding?.color) || BRAND_DEFAULT_COLOR;
  const code = member?.card_code || '';
  return {
    federation: { name: federation?.name || '', acronym: federation?.acronym || '', logo: federation?.branding?.logo_url || '', color, ink: readableInk(color), official: federation?.official === true },
    person: { name: member?.user_name || t('Atleta'), photo: member?.photo_url || '' },
    kind: t(PLAN_PERSON_TYPE_LABELS[member?.person_type] || PLAN_PERSON_TYPE_LABELS.athlete),
    tier: t(PLAN_TIER_LABELS[member?.tier] || PLAN_TIER_LABELS.federated),
    plan: plan?.name || '',
    number: member?.member_number || '—',
    validUntil: st.validUntil,
    validUntilLabel: dataCurta(st.validUntil),
    band: { tone: band.tone, label: t(band.label) },
    status: st.status,
    code,
    verifyUrl: code ? `${origin}${verifyPath(code)}` : '',
    hasCard: Boolean(code) && [MEMBER_STATUS.ACTIVE, MEMBER_STATUS.EXPIRED, MEMBER_STATUS.SUSPENDED].includes(st.status),
  };
}
