/**
 * DUPR OFICIAL — espaço reservado (FASE 2). Ainda SEM rede.
 *
 * Aqui entrará a integração OFICIAL com o DUPR quando houver acesso de
 * PARCEIRO/CLUBE aprovado (credenciais). Objetivos da fase 2:
 *   1) verificar/puxar o rating oficial de um atleta pelo `dupr_id`
 *      (para semear/《verificar》o rating estilo DUPR local);
 *   2) ENVIAR ao DUPR as partidas finalizadas da plataforma, para contarem
 *      oficialmente.
 *
 * IMPORTANTE (segurança/ToS):
 *   - Não existe API pública anônima do DUPR. Ler rating verificado e enviar
 *     partidas exige a API de PARCEIROS (aprovação de clube + credenciais).
 *   - As credenciais DUPR NUNCA podem ir para o cliente. A integração deve
 *     rodar no BACKEND (Cloud Function) com os segredos protegidos.
 *   - Usar login pessoal/token do app para raspar dados viola os Termos do DUPR
 *     e é frágil — não deve ser usado.
 *
 * Enquanto a fase 2 não existe, o ranking "estilo DUPR" é 100% local
 * (`duprRatingService`), semeado pelo nível de nivelamento e/ou pelo rating
 * DUPR informado manualmente no perfil (`dupr_rating`).
 *
 * A flag `DUPR_OFFICIAL_SYNC` (default OFF) fica reservada para ligar esta fase.
 */

/** Estado da integração oficial (fase 2 ainda não implementada). */
export const DUPR_OFFICIAL_STATUS = Object.freeze({
  available: false,
  reason: 'Requer acesso de parceiro/clube DUPR (aprovação) e backend com credenciais protegidas.',
});

/**
 * FASE 2 (stub): puxar o rating oficial pelo ID DUPR. Ainda não implementado —
 * lança para deixar explícito que depende do acesso de parceiro + backend.
 * @param {string} _duprId
 * @returns {Promise<never>}
 */
export async function fetchOfficialDuprRating(_duprId) {
  throw new Error(
    'Integração oficial com o DUPR ainda não configurada. '
    + 'Requer acesso de parceiro/clube DUPR e uma Cloud Function com credenciais protegidas (fase 2).',
  );
}

/**
 * FASE 2 (stub): enviar uma partida finalizada ao DUPR. Ainda não implementado.
 * @param {object} _match
 * @returns {Promise<never>}
 */
export async function submitMatchToDupr(_match) {
  throw new Error(
    'Envio de partidas ao DUPR ainda não configurado. '
    + 'Requer acesso de parceiro/clube DUPR e uma Cloud Function com credenciais protegidas (fase 2).',
  );
}
