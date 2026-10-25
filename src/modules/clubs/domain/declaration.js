/**
 * A declaração de associação (escola, empregador, patrocínio, plano de
 * saúde esportivo): o texto que o clube "assina", a partir da filiação — puro,
 * sem React; a tela só desenha e imprime.
 *
 * Só sai para filiação EM DIA (vencida, suspensa ou pendente não é vínculo
 * vigente — declarar o contrário seria a plataforma afirmar o que não é). A
 * autenticidade é o código da carteirinha: a verificação pública
 * (`/c/verificar/:codigo`) confirma nome, clube e validade. O código gira na
 * renovação e na suspensão, então uma declaração antiga deixa de verificar — a
 * folha diz isso. Nada é gravado: zero banco.
 */
import { t, tk, fmtData } from '@/core/i18n';
import { MEMBER_STATUS, membershipState, isoDate, clubVerifyPath, dataCurta } from './association.js';

/** Por que a declaração não sai (a tela mostra o motivo no lugar do botão). */
export const DECLARATION_BLOCK = Object.freeze({
  not_active: tk('A declaração só sai com a associação em dia.'),
  suspended: tk('Associação suspensa: a declaração volta quando a suspensão terminar.'),
  no_code: tk('A associação ainda não tem código de verificação. Ele nasce na ativação.'),
});

/**
 * O modelo da declaração.
 * @param {{ aff: object, club: object, origin?: string, hoje?: string }} input
 */
export function buildClubDeclaration({ aff, club, origin = '', hoje = isoDate() } = {}) {
  const st = membershipState(aff, hoje);
  let block = '';
  if (st.status === MEMBER_STATUS.SUSPENDED) block = t(DECLARATION_BLOCK.suspended);
  else if (st.status !== MEMBER_STATUS.ACTIVE) block = t(DECLARATION_BLOCK.not_active);
  else if (!aff?.card_code) block = t(DECLARATION_BLOCK.no_code);
  const code = aff?.card_code || '';
  const nome = aff?.user_name || t('Associado(a)');
  const numero = aff?.member_number || '—';
  const de = dataCurta(String(aff?.valid_from || '').slice(0, 10));
  // Plano gratuito não vence: a folha diz isso em vez de inventar uma data.
  const ate = st.validUntil ? dataCurta(st.validUntil) : '';
  let corpo;
  if (de !== '—' && ate) corpo = t('Declaramos, para os devidos fins, que {nome} é associado(a) deste clube sob o nº {numero}, com a associação em dia, válida de {de} a {ate}.', { nome, numero, de, ate });
  else if (de !== '—') corpo = t('Declaramos, para os devidos fins, que {nome} é associado(a) deste clube sob o nº {numero}, com a associação em dia, desde {de}, sem data de vencimento.', { nome, numero, de });
  else corpo = t('Declaramos, para os devidos fins, que {nome} é associado(a) deste clube sob o nº {numero}, com a associação em dia.', { nome, numero });
  return {
    canIssue: !block,
    block,
    club: {
      name: club?.name || aff?.club_name || '',
      city: [club?.city, club?.state].filter(Boolean).join(' / '),
      logo: club?.logo_url || '',
    },
    person: { name: nome },
    number: numero,
    body: corpo,
    plan: aff?.plan_name || '',
    issuedOn: fmtData(new Date(`${hoje}T12:00:00`), { day: 'numeric', month: 'long', year: 'numeric' }),
    code,
    verifyUrl: code ? `${origin}${clubVerifyPath(code)}` : '',
  };
}
