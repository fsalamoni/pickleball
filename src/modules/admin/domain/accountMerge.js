/**
 * Unificar o histórico de uma conta EXCLUÍDA numa conta que continua — as
 * regras puras do lado do painel admin.
 *
 * O caso real que motivou: no ranking, o nº 20 aparecia como "Atleta", sem
 * cidade, e o perfil "não existia". Era a segunda conta de um atleta que
 * continua na plataforma; ela foi excluída, e a exclusão — de propósito —
 * deixou os jogos no histórico (apagá-los mudaria o resultado dos
 * adversários). Os números eram dele: esta ferramenta os devolve à conta que
 * ficou.
 *
 * A unificação roda no SERVIDOR (`functions/accountMerge.js`). Aqui: quem
 * foi excluído (pela auditoria da exclusão, a única prova de quem era), quem
 * provavelmente é a mesma pessoa, e o que a confirmação exige.
 */

/** A palavra que o admin digita para confirmar. */
export const MERGE_CONFIRM_WORD = 'UNIFICAR';

/** Motivo mínimo — igual à exclusão. */
export const MERGE_REASON_MIN = 5;

const texto = (v) => String(v ?? '').trim();

/** Sem acento, minúsculo, espaços simples — para comparar nomes. */
export function normalizarNome(v) {
  return texto(v).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ');
}

/** Parte antes do @, sem pontos, traços nem números — "leo.silva22" → "leosilva". */
function raizDoEmail(email) {
  const local = texto(email).toLowerCase().split('@')[0] || '';
  return local.replace(/[^a-z]/g, '');
}

/**
 * As contas excluídas, a partir da auditoria (`admin_account_deleted`).
 * Uma linha por uid, a exclusão mais recente primeiro; e as já UNIFICADAS
 * (`admin_account_history_merged`) saem marcadas, com o destino.
 *
 * @param {Array<object>} logs documentos de `audit_logs`
 * @returns {Array<{ uid: string, name: string, email: string, deletedAtMs: number, mergedInto: string|null }>}
 */
export function deletedAccountsFromAudit(logs) {
  const unificadas = new Map();
  (logs || []).forEach((l) => {
    if (l?.action !== 'admin_account_history_merged') return;
    const from = texto(l?.details?.from_uid);
    if (from) unificadas.set(from, texto(l?.details?.into_uid) || texto(l?.user_id));
  });
  const porUid = new Map();
  (logs || []).forEach((l) => {
    if (l?.action !== 'admin_account_deleted') return;
    const uid = texto(l.user_id);
    if (!uid) return;
    const ms = Number(l.created_at_ms) || 0;
    const atual = porUid.get(uid);
    if (atual && atual.deletedAtMs >= ms) return;
    porUid.set(uid, {
      uid,
      name: texto(l.user_name) || '(sem nome)',
      email: texto(l.user_email),
      deletedAtMs: ms,
      mergedInto: unificadas.get(uid) || null,
    });
  });
  return [...porUid.values()].sort((a, b) => b.deletedAtMs - a.deletedAtMs);
}

/**
 * Quem, entre as contas que existem, provavelmente é a MESMA pessoa da conta
 * excluída. É sugestão — o admin confere na prévia do servidor, que mostra os
 * dois nomes e e-mails lado a lado.
 *
 * Pontos: nome completo igual (5), mesmo primeiro nome (2), sobrenome em
 * comum (2), e-mail com a mesma raiz (3). Só entra quem soma 2 ou mais.
 *
 * @param {{ name?: string, email?: string }} excluida
 * @param {Array<object>} usuarios documentos de `users` (com `uid`)
 * @param {{ limit?: number }} [opts]
 * @returns {Array<{ user: object, score: number, motivos: string[] }>}
 */
export function suggestMergeTargets(excluida, usuarios, { limit = 5 } = {}) {
  const nome = normalizarNome(excluida?.name);
  const partes = nome.split(' ').filter((p) => p.length >= 2);
  const primeiro = partes[0] || '';
  const sobrenomes = new Set(partes.slice(1).filter((p) => p.length >= 3));
  const raiz = raizDoEmail(excluida?.email);

  return (usuarios || [])
    .map((u) => {
      const candidato = normalizarNome(u?.full_name || u?.platform_name || u?.display_name);
      const partesC = candidato.split(' ').filter(Boolean);
      const motivos = [];
      let score = 0;
      if (nome && candidato === nome) { score += 5; motivos.push('mesmo nome'); }
      else {
        if (primeiro && partesC[0] === primeiro) { score += 2; motivos.push('mesmo primeiro nome'); }
        if (partesC.slice(1).some((p) => sobrenomes.has(p))) { score += 2; motivos.push('sobrenome em comum'); }
      }
      const raizC = raizDoEmail(u?.email);
      if (raiz.length >= 3 && raizC.length >= 3 && (raiz === raizC || raiz.includes(raizC) || raizC.includes(raiz))) {
        score += 3; motivos.push('e-mail parecido');
      }
      return { user: u, score, motivos };
    })
    .filter((x) => x.score >= 2 && x.user?.uid)
    .sort((a, b) => b.score - a.score
      || normalizarNome(a.user.full_name || a.user.platform_name).localeCompare(normalizarNome(b.user.full_name || b.user.platform_name)))
    .slice(0, limit);
}

/**
 * Valida o pedido antes de chamar o servidor.
 * @returns {{ isValid: boolean, errors: Record<string,string> }}
 */
export function validateMergeRequest({ fromUid = '', intoUid = '', reason = '', confirmText = '' } = {}) {
  const erros = {};
  if (!texto(fromUid)) erros.fromUid = 'Escolha a conta excluída.';
  if (!texto(intoUid)) erros.intoUid = 'Escolha a conta que fica.';
  if (texto(fromUid) && texto(fromUid) === texto(intoUid)) erros.intoUid = 'As duas contas são a mesma.';
  if (texto(reason).length < MERGE_REASON_MIN) {
    erros.reason = `Descreva o motivo (mínimo ${MERGE_REASON_MIN} caracteres).`;
  }
  if (texto(confirmText).toUpperCase() !== MERGE_CONFIRM_WORD) {
    erros.confirmText = `Digite ${MERGE_CONFIRM_WORD} para confirmar.`;
  }
  return { isValid: Object.keys(erros).length === 0, errors: erros };
}
