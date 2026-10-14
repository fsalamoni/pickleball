/**
 * Aviso em massa pelo admin — o que a tela valida antes de gravar. O envio é
 * o `notifyUsers` de sempre (lotes de 400; a regra de `notifications` aceita
 * qualquer conta logada criando aviso para outra), com o público contado
 * ANTES e auditoria depois. Zero coleção nova.
 */
import { isRuleSafeLink } from '../../../core/domain/internalLink.js';
import { t } from '../../../core/i18n/index.js';

export const BROADCAST_TITLE_MAX = 140;
export const BROADCAST_MESSAGE_MAX = 300;

export function validateBroadcast({ title = '', message = '', link = '', recipients = 0 } = {}) {
  const erros = {};
  const ti = String(title).trim();
  const m = String(message).trim();
  const l = String(link).trim();
  if (ti.length < 3) erros.title = t('Dê um título ao aviso.');
  if (ti.length > BROADCAST_TITLE_MAX) erros.title = t('No máximo {max} caracteres.', { max: BROADCAST_TITLE_MAX });
  if (m.length < 10) erros.message = t('Escreva a mensagem (mínimo 10 caracteres).');
  if (m.length > BROADCAST_MESSAGE_MAX) erros.message = t('No máximo {max} caracteres.', { max: BROADCAST_MESSAGE_MAX });
  if (l && !isRuleSafeLink(l)) erros.link = t('Só caminho interno da plataforma (ex.: /torneios), sem #.');
  if (!(recipients > 0)) erros.recipients = t('Não há ninguém neste público.');
  return { isValid: Object.keys(erros).length === 0, errors: erros };
}
