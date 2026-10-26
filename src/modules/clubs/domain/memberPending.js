/**
 * "Precisa de você" da PESSOA nos clubes-associação (Bloco G) — lógica pura.
 *
 * A entrada é o que o servidor devolve de `clubMine` (`scope: 'pending'`): por clube, a filiação,
 * as cobranças, as sanções, os convites de convocação e as eleições em que a pessoa está no
 * colégio. Fonte que não carregou é `undefined` e o item não entra — nunca vira zero
 * (`docs/27-FALHA-NAO-E-VAZIO.md`).
 */
import { CHARGE_STATUS, MEMBER_STATUS, isoDate, membershipState } from './association.js';

const lista = (x) => (Array.isArray(x) ? x : []);

/** A cobrança espera o Pix da pessoa (a declarada espera o clube, não ela). */
const cobrancaAberta = (c) => c?.status === CHARGE_STATUS.OPEN;
/** A convocação espera resposta e o prazo ainda não venceu. */
const convocacaoAberta = (i, nowMs) => i?.status === 'invited' && Number(i.expires_at_ms) > nowMs;
/** A sanção está em vigor e ainda cabe recurso (uma vez, enquanto vale). */
const cabeRecurso = (s) => s?.status === 'active' && !s.appeal;
/** A votação está aberta e a pessoa ainda não votou. */
const votoPendente = (e) => e?.status === 'voting' && e.voted !== true;

/**
 * O resumo de UM clube para a pessoa: o estado da filiação e o que espera por ela.
 * @returns {{ club_id: string, club_name: string, state: string, label: string, validUntil: string, pagar: number, convocacoes: number, sancoes: number, eleicoes: number, vencendo: boolean, vencida: boolean }}
 */
export function clubSummary(clube, { hoje = isoDate(), nowMs = Date.now() } = {}) {
  const st = clube?.aff ? membershipState(clube.aff, hoje, { nowMs }) : null;
  return {
    club_id: clube?.club_id, club_name: clube?.club_name || '',
    state: st?.status || '', label: st?.label || '', validUntil: st?.validUntil || '',
    pagar: lista(clube?.charges).filter(cobrancaAberta).length,
    convocacoes: lista(clube?.callup_invites).filter((i) => convocacaoAberta(i, nowMs)).length,
    sancoes: lista(clube?.sanctions).filter(cabeRecurso).length,
    eleicoes: lista(clube?.elections).filter(votoPendente).length,
    vencendo: Boolean(st?.expiring),
    vencida: st?.status === MEMBER_STATUS.EXPIRED,
  };
}

/**
 * Os totais para a faixa "Precisa de você" da Minha área. `clubes` `undefined` (não carregou ou
 * falhou) devolve tudo `undefined`: o item some, nunca vira zero.
 * @param {object[]|undefined} clubes
 * @returns {{ pagar?: number, vencendo?: number, vencida?: number, convocacoes?: number, sancoes?: number, eleicoes?: number }}
 */
export function myClubPending(clubes, opts = {}) {
  if (!Array.isArray(clubes)) return { pagar: undefined, vencendo: undefined, vencida: undefined, convocacoes: undefined, sancoes: undefined, eleicoes: undefined };
  const resumos = clubes.map((c) => clubSummary(c, opts));
  const soma = (campo) => resumos.reduce((s, r) => s + (Number(r[campo]) || 0), 0);
  const conta = (campo) => resumos.filter((r) => r[campo]).length;
  return { pagar: soma('pagar'), vencendo: conta('vencendo'), vencida: conta('vencida'), convocacoes: soma('convocacoes'), sancoes: soma('sancoes'), eleicoes: soma('eleicoes') };
}
