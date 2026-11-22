/**
 * A configuração do criador por IA que o ADMIN edita (puro). Os padrões e as
 * qualidades têm cópia no servidor (`functions/avatarAiPolicy.js`, com
 * paridade): quem confere e grava é a callable `avatarAi` — a tela só propõe.
 */
import { tk } from '@/core/i18n';

export const AI_DEFAULT_CONFIG = Object.freeze({
  enabled: false, model: 'gpt-image-2.5-sunburst', quality: 'high', per_day: 3, per_month: 15, platform_month: 2000,
});

export const AI_QUALITIES = Object.freeze(['low', 'medium', 'high']);
export const AI_QUALITY_LABEL = Object.freeze({ low: tk('Baixa (mais barata)'), medium: tk('Média'), high: tk('Alta (a das amostras)') });

/** Por que a pessoa não pode criar agora, em palavras (ou `null`). */
export function limitMessage(status) {
  if (!status || status.ok) return null;
  if (status.reason === 'day') return tk('Você já criou os avatares de hoje. Amanhã tem mais.');
  if (status.reason === 'month') return tk('Você já criou os avatares deste mês.');
  return tk('O criador de avatar atingiu o limite do mês. Volte no mês que vem.');
}
