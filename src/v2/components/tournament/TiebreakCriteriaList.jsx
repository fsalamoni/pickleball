/**
 * Os critérios de desempate que VALEM numa modalidade — a mesma ordem que a
 * tabela, o avanço de fase e o pódio usam (`tournamentTiebreak.js`). Usado nas
 * informações da modalidade (modal e página). Antes era texto fixo, sem o
 * confronto direto e sem a ordem que o organizador escolhia.
 */
import React from 'react';
import { describeTiebreakOrder } from '@/core/domain/tiebreak';
import { isTeamModality, tournamentTiebreakSummary } from '@/modules/tournament/domain/tournamentTiebreak';
import { t } from '@/core/i18n';

export default function TiebreakCriteriaList({ tournament, modality, strongClassName = '' }) {
  if (isTeamModality(modality)) {
    return <p>{t('Critérios de desempate: vitórias de confronto → saldo de etapas → saldo de pontos → confronto direto.')}</p>;
  }
  const resumo = tournamentTiebreakSummary(tournament, modality ? [modality] : []);
  if (!resumo.uniform) {
    return (
      <>
        <p>{t('Em caso de empate, cada fase desta modalidade segue a sua ordem:')}</p>
        <ul className="list-disc space-y-1 pl-5">
          {resumo.variants.map((v) => (
            <li key={v.order.join('|')}>
              <strong className={strongClassName}>
                {t('Fase {fases}', { fases: v.where.map((w) => w.stageIndex + 1).join(', ') })}
              </strong>
              {': '}{describeTiebreakOrder(v.order).map((c) => c.label).join(' → ')}
            </li>
          ))}
        </ul>
      </>
    );
  }
  return (
    <>
      <p>{t('A ordem vale para todas as modalidades do torneio. Em caso de empate valem, nesta ordem:')}</p>
      <ol className="list-decimal space-y-1 pl-5">
        {describeTiebreakOrder(resumo.order).map((c) => (
          <li key={c.key}><strong className={strongClassName}>{c.label}</strong> — {c.help}</li>
        ))}
      </ol>
      <p className="text-xs text-gray-500">{t('Nas chaves (mata-mata), passa quem vence o jogo.')}</p>
    </>
  );
}
