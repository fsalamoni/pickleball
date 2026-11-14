/**
 * A ordem de desempate que classificou a tabela, numa linha — embaixo da
 * classificação da página pública (`/p/:id`) e da folha impressa. É a mesma
 * resolução da tabela, do avanço de fase e do pódio (`effectiveTiebreakOrder`):
 * quem lê a tabela (no celular ou no papel da mesa da organização) sabe por que
 * um ficou à frente do outro, sem precisar abrir o app.
 */
import React from 'react';
import { describeTiebreakOrder } from '@/core/domain/tiebreak';
import { effectiveTiebreakOrder, isTeamModality } from '@/modules/tournament/domain/tournamentTiebreak';
import { normalizePhases } from '@/modules/tournament/domain/phases';
import { t } from '@/core/i18n';

/** O texto de uma fase (`stageIndex`) da modalidade. */
export function tiebreakCaptionText(tournament, modality, stageIndex) {
  if (isTeamModality(modality)) {
    return t('Critérios de desempate: vitórias de confronto → saldo de etapas → saldo de pontos → confronto direto.');
  }
  const fase = normalizePhases(modality?.stages)[stageIndex] || null;
  const ordem = describeTiebreakOrder(effectiveTiebreakOrder(tournament, fase)).map((c) => c.label).join(' → ');
  return t('Critérios de desempate: {ordem}.', { ordem });
}

/**
 * @param {{ tournament: object, modality: object, stageIndexes: number[], className?: string }} props
 * Uma linha quando todas as fases mostradas seguem a mesma ordem (todo torneio
 * novo); uma por fase só no torneio antigo com ordens diferentes por fase.
 */
export default function TiebreakCaption({ tournament, modality, stageIndexes, className = '' }) {
  const porFase = (stageIndexes || []).map((i) => ({ i, texto: tiebreakCaptionText(tournament, modality, i) }));
  if (!porFase.length) return null;
  const distintos = [...new Set(porFase.map((f) => f.texto))];
  if (distintos.length === 1) return <p className={className}>{distintos[0]}</p>;
  return (
    <ul className={className}>
      {porFase.map((f) => (
        <li key={f.i}>{t('Fase {v1}', { v1: f.i + 1 })} — {f.texto}</li>
      ))}
    </ul>
  );
}
