/**
 * Aviso em massa pelo admin — o que a tela valida antes de gravar. O envio é
 * o `notifyUsers` de sempre (lotes de 400; a regra de `notifications` aceita
 * qualquer conta logada criando aviso para outra), com o público contado
 * ANTES e auditoria depois. Zero coleção nova.
 */
import { isRuleSafeLink } from '../../../core/domain/internalLink.js';

export const BROADCAST_TITLE_MAX = 140;
export const BROADCAST_MESSAGE_MAX = 300;

export function validateBroadcast({ title = '', message = '', link = '', recipients = 0 } = {}) {
  const erros = {};
  const t = String(title).trim();
  const m = String(message).trim();
  const l = String(link).trim();
  if (t.length < 3) erros.title = 'Dê um título ao aviso.';
  if (t.length > BROADCAST_TITLE_MAX) erros.title = `No máximo ${BROADCAST_TITLE_MAX} caracteres.`;
  if (m.length < 10) erros.message = 'Escreva a mensagem (mínimo 10 caracteres).';
  if (m.length > BROADCAST_MESSAGE_MAX) erros.message = `No máximo ${BROADCAST_MESSAGE_MAX} caracteres.`;
  if (l && !isRuleSafeLink(l)) erros.link = 'Só caminho interno da plataforma (ex.: /torneios), sem #.';
  if (!(recipients > 0)) erros.recipients = 'Não há ninguém neste público.';
  return { isValid: Object.keys(erros).length === 0, errors: erros };
}
