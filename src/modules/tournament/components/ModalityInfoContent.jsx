import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Wallet, BookOpen, Layers, CalendarClock } from 'lucide-react';
import {
  MODALITY_FORMAT_LABELS,
  SKILL_LEVEL_LABELS,
  GENDER_CATEGORY_LABELS,
  AGE_CATEGORY_LABELS,
  TOURNAMENT_STAGE_TYPE_LABELS,
  RULESET_LABELS,
} from '@/modules/tournament/domain/constants';
import { hasUnlimitedEntries } from '@/modules/tournament/domain/capacity';
import { formatScoringSummary, resolveStageScoringConfig } from '@/modules/tournament/domain/scoring';
import { describeFormat, describeStage } from '@/modules/tournament/domain/formatExplain';
import StageExplanation from './StageExplanation';
import { t } from '@/core/i18n';

function formatBRL(cents) {
  const value = Number(cents || 0) / 100;
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function formatConfirmedCount(count) {
  return `${count} ${count === 1 ? t('inscrição confirmada') : t('inscrições confirmadas')}`;
}

/**
 * Conteúdo de "informações gerais" de uma modalidade — reutilizado pelo modal
 * (ModalityInfoModal) e pela página própria da modalidade (aba Informações).
 */
export default function ModalityInfoContent({ modality, tournament, registrationsCount = 0 }) {
  if (!modality) return null;
  const stages = Array.isArray(modality.stages) && modality.stages.length > 0 ? modality.stages : [];
  const isMultiPhase = stages.length > 1;
  const stageType = stages[0]?.type;
  const groupCount = stages[0]?.group_count || 1;
  const seedCount = stages[0]?.seed_count || 0;
  const qualifiersPerGroup = Number(stages[0]?.qualifiers_per_group ?? 2);
  const legs = Number(stages[0]?.round_robin_legs) === 2 ? 2 : 1;
  const fee = Number(modality.entry_fee_cents || 0);

  return (
    <div className="space-y-4 text-sm text-gray-600">
      <section>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">{MODALITY_FORMAT_LABELS[modality.format]}</Badge>
          <Badge variant="secondary">{SKILL_LEVEL_LABELS[modality.skill_level]}</Badge>
          <Badge variant="secondary">{GENDER_CATEGORY_LABELS[modality.gender_category]}</Badge>
          <Badge variant="secondary">{AGE_CATEGORY_LABELS[modality.age_category]}</Badge>
          {isMultiPhase ? (
            <Badge variant="secondary">{t('{n} fases', { n: stages.length })}</Badge>
          ) : (
            stageType && <Badge variant="secondary">{TOURNAMENT_STAGE_TYPE_LABELS[stageType]}</Badge>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="font-semibold text-ink flex items-center gap-2">
          <Users className="w-4 h-4 text-green-600" /> {t('Inscrições e formato')}
        </h4>
        <p>{describeFormat(modality.format)}</p>
        <ul className="list-disc pl-5 space-y-1 text-gray-600">
          <li>
            <strong>{t('Vagas:')}</strong>{' '}
            {hasUnlimitedEntries(modality.max_entries)
              ? t('abertas. O sistema organizará a modalidade com base nas {registrationsCount} ao encerrar as inscrições.', { registrationsCount: formatConfirmedCount(registrationsCount) })
              : t('até {max_entries} inscrições. Atualmente {registrationsCount}.', { max_entries: modality.max_entries, registrationsCount: formatConfirmedCount(registrationsCount) })}
          </li>
          <li><strong>{t('Categoria de gênero:')}</strong> {GENDER_CATEGORY_LABELS[modality.gender_category]}</li>
          <li><strong>{t('Faixa etária:')}</strong> {AGE_CATEGORY_LABELS[modality.age_category]} <span className="text-xs text-gray-500">{t('(a plataforma é aberta a todas as idades; esta categoria define apenas a faixa elegível para esta modalidade)')}</span></li>
          <li><strong>{t('Nível recomendado:')}</strong> {SKILL_LEVEL_LABELS[modality.skill_level]}</li>
          <li className="flex items-center gap-1"><Wallet className="w-3 h-3" /> <strong>{t('Taxa de inscrição:')}</strong> {fee > 0 ? formatBRL(fee) : t('Gratuita')}</li>
        </ul>
      </section>

      {isMultiPhase ? (
        <section className="space-y-2">
          <h4 className="font-semibold text-ink flex items-center gap-2">
            <Layers className="w-4 h-4 text-green-600" /> {t('Como funciona a competição ({n} fases)', { n: stages.length })}
          </h4>
          <p className="text-xs text-gray-500">
            {t('A inscrição é única; a cada fase os classificados avançam para a fase seguinte.')}
          </p>
          <ol className="space-y-2">
            {stages.map((s, i) => (
              <li key={i} className="rounded-md border border-gray-200 p-2">
                <div className="font-medium text-ink">
                  {t('Fase')} {i + 1}: {TOURNAMENT_STAGE_TYPE_LABELS[s.type] || s.type}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{describeStage(s.type)}</p>
                <p className="mt-1 text-xs font-medium text-green-700">
                  {RULESET_LABELS[resolveStageScoringConfig(modality, tournament, i).ruleset] || resolveStageScoringConfig(modality, tournament, i).ruleset}
                  {' · '}
                  {formatScoringSummary(resolveStageScoringConfig(modality, tournament, i))}
                </p>
              </li>
            ))}
          </ol>
          <a
            href={`${import.meta.env.BASE_URL}torneios/guia`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-700 inline-flex items-center gap-1 hover:underline"
          >
            <BookOpen className="w-3.5 h-3.5" /> {t('Guia completo de formatos e modelos')}
          </a>
        </section>
      ) : (
        stageType && (
          <section className="space-y-2">
            <h4 className="font-semibold text-ink flex items-center gap-2">
              <Layers className="w-4 h-4 text-green-600" /> {t('Como funciona a competição')}
            </h4>
            <p>{describeStage(stageType)}</p>
            {/* Para o atleta a pergunta é "como vai ser": as alternativas de
                divisão são da tela de quem organiza. */}
            <StageExplanation
              stageType={stageType}
              playerCount={registrationsCount}
              groupCount={groupCount}
              seedCount={seedCount}
              qualifiersPerGroup={qualifiersPerGroup}
              legs={legs}
              etapaCount={stages[0]?.etapa_count}
              maxPerGroup={stages[0]?.max_per_group}
              showAlternatives={false}
            />
          </section>
        )
      )}

      {(modality.court_count || modality.play_start_time || modality.play_date) && (
        <section className="space-y-2">
          <h4 className="font-semibold text-ink flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-green-600" /> {t('Quadras e horários')}
          </h4>
          <ul className="list-disc pl-5 space-y-1">
            {modality.play_date && (
              <li><strong>{t('Data:')}</strong> {modality.play_date}</li>
            )}
            {modality.play_start_time && (
              <li>
                <strong>{t('Horário:')}</strong> {t('a partir das {play_start_time}', { play_start_time: modality.play_start_time })}
                {modality.play_end_time ? t('até {play_end_time}', { play_end_time: modality.play_end_time }) : ''}
              </li>
            )}
            {modality.court_count && (
              <li><strong>{t('Quadras disponíveis:')}</strong> {modality.court_count}</li>
            )}
            {modality.match_duration_minutes && (
              <li><strong>{t('Duração média do jogo:')}</strong> {t('{match_duration_minutes} minutos', { match_duration_minutes: modality.match_duration_minutes })}</li>
            )}
          </ul>
          <p className="text-xs text-gray-500">
            {t('Após o sorteio, cada jogo é marcado automaticamente em uma quadra e horário, sem conflito de jogadores.')}
          </p>
        </section>
      )}

      <section className="space-y-2">
        <h4 className="font-semibold text-ink flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-green-600" /> {t('Regras de pontuação')}
        </h4>
        {stages.length > 0 ? (
          <ul className="list-disc pl-5 space-y-1">
            {stages.map((stage, index) => {
              const scoring = resolveStageScoringConfig(modality, tournament, index);
              return (
                <li key={`${stage.type}-${index}`}>
                  <strong>{t('Fase')} {index + 1}:</strong> {RULESET_LABELS[scoring.ruleset] || scoring.ruleset} · {formatScoringSummary(scoring)}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-500">{t('A pontuação desta modalidade ainda não foi configurada.')}</p>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="font-semibold text-ink flex items-center gap-2">
          <Trophy className="w-4 h-4 text-green-600" /> {t('Critério de classificação')}
        </h4>
        <p>{t('A classificação é feita pelo número de vitórias. Em caso de empate valem, nesta ordem:')}</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li><strong>{t('Saldo de pontos')}</strong> {t('— diferença entre pontos a favor e pontos sofridos.')}</li>
          <li><strong>{t('Maior número de pontos marcados')}</strong> {t('(a favor).')}</li>
          <li><strong>{t('Menor número de pontos sofridos')}</strong>.</li>
        </ol>
      </section>

      {modality.notes && (
        <section className="space-y-1">
          <h4 className="font-semibold text-ink">{t('Observações do organizador')}</h4>
          <p className="whitespace-pre-line">{modality.notes}</p>
        </section>
      )}
    </div>
  );
}
