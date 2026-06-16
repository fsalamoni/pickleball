import { FORUM_POLL } from './constants.js';

/**
 * Funções puras das enquetes do fórum — criação, validação e apuração.
 * Sem dependências do Firebase para facilitar testes.
 */

let optionSeq = 0;
function optionId() {
  optionSeq += 1;
  return `opt_${Date.now().toString(36)}_${optionSeq.toString(36)}`;
}

/** Valida um rascunho de enquete. Retorna { valid, error }. */
export function validatePollDraft(draft) {
  if (!draft) return { valid: true, error: null }; // enquete é opcional
  const question = String(draft.question || '').trim();
  const options = (draft.options || []).map((o) => String(o ?? '').trim()).filter(Boolean);
  if (!question) return { valid: false, error: 'Escreva a pergunta da enquete.' };
  if (options.length < FORUM_POLL.MIN_OPTIONS) {
    return { valid: false, error: `A enquete precisa de pelo menos ${FORUM_POLL.MIN_OPTIONS} opções.` };
  }
  if (options.length > FORUM_POLL.MAX_OPTIONS) {
    return { valid: false, error: `A enquete aceita no máximo ${FORUM_POLL.MAX_OPTIONS} opções.` };
  }
  const unique = new Set(options.map((o) => o.toLowerCase()));
  if (unique.size !== options.length) return { valid: false, error: 'As opções não podem se repetir.' };
  return { valid: true, error: null };
}

/**
 * Constrói o objeto de enquete persistível a partir de um rascunho do formulário.
 * Retorna null quando não há enquete.
 */
export function buildPoll(draft) {
  if (!draft) return null;
  const validation = validatePollDraft(draft);
  if (!validation.valid) throw new Error(validation.error);

  const question = String(draft.question).trim().slice(0, FORUM_POLL.QUESTION_MAX_CHARS);
  const options = (draft.options || [])
    .map((o) => String(o ?? '').trim())
    .filter(Boolean)
    .slice(0, FORUM_POLL.MAX_OPTIONS)
    .map((text) => ({ id: optionId(), text: text.slice(0, FORUM_POLL.OPTION_MAX_CHARS) }));

  let closesAtMs = null;
  if (draft.closesAt) {
    const ms = new Date(draft.closesAt).getTime();
    if (Number.isFinite(ms)) closesAtMs = ms;
  }

  return {
    question,
    options,
    multiple: !!draft.multiple,
    closes_at_ms: closesAtMs,
  };
}

/** Indica se a enquete está encerrada no instante informado. */
export function isPollClosed(poll, nowMs = Date.now()) {
  if (!poll || !poll.closes_at_ms) return false;
  return nowMs >= poll.closes_at_ms;
}

/**
 * Apura os votos de uma enquete.
 * @param poll  objeto de enquete { options: [{id,text}], ... }
 * @param votes lista de documentos de voto [{ user_id, option_ids: [] }]
 * @returns { results: [{id,text,count,percentage}], totalVotes, totalVoters }
 */
export function tallyVotes(poll, votes) {
  const options = poll?.options || [];
  const counts = new Map(options.map((o) => [o.id, 0]));
  let totalVotes = 0;
  const voters = new Set();

  (votes || []).forEach((vote) => {
    const ids = Array.isArray(vote?.option_ids) ? vote.option_ids : [];
    let counted = false;
    ids.forEach((id) => {
      if (counts.has(id)) {
        counts.set(id, counts.get(id) + 1);
        totalVotes += 1;
        counted = true;
      }
    });
    if (counted && vote?.user_id) voters.add(vote.user_id);
  });

  const results = options.map((o) => {
    const count = counts.get(o.id) || 0;
    const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    return { id: o.id, text: o.text, count, percentage };
  });

  return { results, totalVotes, totalVoters: voters.size };
}

/** Alterna a seleção de uma opção respeitando o modo (única ou múltipla). */
export function toggleOption(selectedIds, optionIdValue, multiple) {
  const set = new Set(selectedIds || []);
  if (multiple) {
    if (set.has(optionIdValue)) set.delete(optionIdValue);
    else set.add(optionIdValue);
    return Array.from(set);
  }
  // Escolha única: substitui a seleção (ou limpa ao clicar na mesma).
  return set.has(optionIdValue) ? [] : [optionIdValue];
}
