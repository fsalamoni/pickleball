/**
 * A declaração de vínculo (Bolsa Atleta, escola, empregador, patrocínio): o
 * texto que a federação assina, a partir da filiação — puro, sem React; a tela
 * só desenha e imprime.
 *
 * Só sai para filiação EM DIA (vencida, suspensa ou pendente não é vínculo
 * vigente — declarar o contrário seria a plataforma afirmar o que não é). A
 * autenticidade é o código da carteirinha: a verificação pública
 * (`/f/verificar/:codigo`) confirma nome, federação e validade. O código gira
 * na renovação e na suspensão, então uma declaração antiga deixa de verificar
 * — a folha diz isso. Nada é gravado: zero banco.
 */
import { t, tk, fmtData } from '@/core/i18n';
import { MEMBER_STATUS, PLAN_PERSON_TYPE_LABELS, PLAN_TIER_LABELS } from './constants.js';
import { isoDate, membershipState } from './membership.js';
import { dataCurta, verifyPath } from './card.js';

/** Por que a declaração não sai (a tela mostra o motivo no lugar do botão). */
export const DECLARATION_BLOCK = Object.freeze({
  not_active: tk('A declaração de vínculo só sai com a filiação em dia.'),
  suspended: tk('Filiação suspensa: a declaração volta quando a suspensão terminar.'),
  no_code: tk('A filiação ainda não tem código de verificação. Ele nasce na ativação.'),
});

/** No máximo tantos resultados oficiais na folha (os mais recentes). */
export const DECLARATION_MAX_RESULTS = 20;

/** Os resultados oficiais DESTA federação em que a pessoa aparece, do mais recente ao mais antigo. */
export function declarationResults(results = [], { federationId, uid } = {}) {
  if (!uid || !federationId) return [];
  return (results || [])
    .filter((r) => r?.federation_id === federationId && r.status !== 'rejected' && Array.isArray(r.rows))
    .map((r) => {
      const row = r.rows.find((x) => x?.uid === uid);
      return row ? { id: r.id, tournament: r.tournament_name || '', modality: r.modality_name || '', date: String(r.date || '').slice(0, 10), position: Number(row.position) || null } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, DECLARATION_MAX_RESULTS);
}

/**
 * O modelo da declaração.
 * @param {{ member: object, federation: object, results?: object[], origin?: string, hoje?: string }} input
 * @returns {{ canIssue: boolean, block: string, ... }}
 */
export function buildMembershipDeclaration({ member, federation, results = [], origin = '', hoje = isoDate() } = {}) {
  const st = membershipState(member, hoje);
  let block = '';
  if (st.status === MEMBER_STATUS.SUSPENDED) block = t(DECLARATION_BLOCK.suspended);
  else if (st.status !== MEMBER_STATUS.ACTIVE) block = t(DECLARATION_BLOCK.not_active);
  else if (!member?.card_code) block = t(DECLARATION_BLOCK.no_code);
  const code = member?.card_code || '';
  const fed = {
    name: federation?.name || member?.federation_name || '',
    acronym: federation?.acronym || member?.federation_acronym || '',
    cnpj: federation?.cnpj_masked || '',
    city: [federation?.city, federation?.state].filter(Boolean).join(' / '),
    logo: federation?.branding?.logo_url || '',
  };
  const nome = member?.user_name || t('Atleta');
  const tipo = t(PLAN_PERSON_TYPE_LABELS[member?.person_type] || PLAN_PERSON_TYPE_LABELS.athlete).toLowerCase();
  const categoria = t(PLAN_TIER_LABELS[member?.tier] || PLAN_TIER_LABELS.federated).toLowerCase();
  const de = dataCurta(String(member?.valid_from || '').slice(0, 10));
  const ate = st.validUntil ? dataCurta(st.validUntil) : '—';
  const corpo = de !== '—'
    ? t('Declaramos, para os devidos fins, que {nome}, filiado(a) a esta federação sob o nº {numero}, como {tipo} na categoria {categoria}, está com a filiação em dia, válida de {de} a {ate}.', { nome, numero: member?.member_number || '—', tipo, categoria, de, ate })
    : t('Declaramos, para os devidos fins, que {nome}, filiado(a) a esta federação sob o nº {numero}, como {tipo} na categoria {categoria}, está com a filiação em dia, válida até {ate}.', { nome, numero: member?.member_number || '—', tipo, categoria, ate });
  const uid = member?.user_id || '';
  return {
    canIssue: !block,
    block,
    federation: fed,
    person: { name: nome },
    number: member?.member_number || '—',
    body: corpo,
    plan: member?.plan_name || '',
    guardian: member?.guardian_name || '',
    results: uid ? declarationResults(results, { federationId: federation?.id || member?.federation_id, uid }) : [],
    issuedOn: fmtData(new Date(`${hoje}T12:00:00`), { day: 'numeric', month: 'long', year: 'numeric' }),
    code,
    verifyUrl: code ? `${origin}${verifyPath(code)}` : '',
  };
}
