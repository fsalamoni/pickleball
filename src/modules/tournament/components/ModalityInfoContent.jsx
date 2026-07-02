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

function formatBRL(cents) {
  const value = Number(cents || 0) / 100;
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function formatConfirmedCount(count) {
  return `${count} ${count === 1 ? 'inscrição confirmada' : 'inscrições confirmadas'}`;
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
  const fee = Number(modality.entry_fee_cents || 0);

  return (
    <div className="space-y-4 text-sm text-slate-700">
      <section>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">{MODALITY_FORMAT_LABELS[modality.format]}</Badge>
          <Badge variant="secondary">{SKILL_LEVEL_LABELS[modality.skill_level]}</Badge>
          <Badge variant="secondary">{GENDER_CATEGORY_LABELS[modality.gender_category]}</Badge>
          <Badge variant="secondary">{AGE_CATEGORY_LABELS[modality.age_category]}</Badge>
          {isMultiPhase ? (
            <Badge variant="secondary">{stages.length} fases</Badge>
          ) : (
            stageType && <Badge variant="secondary">{TOURNAMENT_STAGE_TYPE_LABELS[stageType]}</Badge>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-600" /> Inscrições e formato
        </h4>
        <p>{describeFormat(modality.format)}</p>
        <ul className="list-disc pl-5 space-y-1 text-slate-700">
          <li>
            <strong>Vagas:</strong>{' '}
            {hasUnlimitedEntries(modality.max_entries)
              ? `abertas. O sistema organizará a modalidade com base nas ${formatConfirmedCount(registrationsCount)} ao encerrar as inscrições.`
              : `até ${modality.max_entries} inscrições. Atualmente ${formatConfirmedCount(registrationsCount)}.`}
          </li>
          <li><strong>Categoria de gênero:</strong> {GENDER_CATEGORY_LABELS[modality.gender_category]}</li>
          <li><strong>Faixa etária:</strong> {AGE_CATEGORY_LABELS[modality.age_category]} <span className="text-xs text-slate-500">(a plataforma é aberta a todas as idades; esta categoria define apenas a faixa elegível para esta modalidade)</span></li>
          <li><strong>Nível recomendado:</strong> {SKILL_LEVEL_LABELS[modality.skill_level]}</li>
          <li className="flex items-center gap-1"><Wallet className="w-3 h-3" /> <strong>Taxa de inscrição:</strong> {fee > 0 ? formatBRL(fee) : 'Gratuita'}</li>
        </ul>
      </section>

      {isMultiPhase ? (
        <section className="space-y-2">
          <h4 className="font-semibold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" /> Como funciona a competição ({stages.length} fases)
          </h4>
          <p className="text-xs text-slate-500">
            A inscrição é única; a cada fase os classificados avançam para a fase seguinte.
          </p>
          <ol className="space-y-2">
            {stages.map((s, i) => (
              <li key={i} className="rounded-md border border-slate-200 p-2">
                <div className="font-medium text-slate-800">
                  Fase {i + 1}: {TOURNAMENT_STAGE_TYPE_LABELS[s.type] || s.type}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">{describeStage(s.type)}</p>
                <p className="mt-1 text-xs font-medium text-emerald-700">
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
            rel="noreferrer"
            className="text-xs text-emerald-700 inline-flex items-center gap-1 hover:underline"
          >
            <BookOpen className="w-3.5 h-3.5" /> Guia completo de formatos e modelos
          </a>
        </section>
      ) : (
        stageType && (
          <section className="space-y-2">
            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" /> Como funciona a competição
            </h4>
            <p>{describeStage(stageType)}</p>
            <StageExplanation
              stageType={stageType}
              playerCount={registrationsCount}
              groupCount={groupCount}
              seedCount={seedCount}
            />
          </section>
        )
      )}

      {(modality.court_count || modality.play_start_time || modality.play_date) && (
        <section className="space-y-2">
          <h4 className="font-semibold text-slate-900 flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-emerald-600" /> Quadras e horários
          </h4>
          <ul className="list-disc pl-5 space-y-1">
            {modality.play_date && (
              <li><strong>Data:</strong> {modality.play_date}</li>
            )}
            {modality.play_start_time && (
              <li>
                <strong>Horário:</strong> a partir das {modality.play_start_time}
                {modality.play_end_time ? ` até ${modality.play_end_time}` : ''}
              </li>
            )}
            {modality.court_count && (
              <li><strong>Quadras disponíveis:</strong> {modality.court_count}</li>
            )}
            {modality.match_duration_minutes && (
              <li><strong>Duração média do jogo:</strong> {modality.match_duration_minutes} minutos</li>
            )}
          </ul>
          <p className="text-xs text-slate-500">
            Após o sorteio, cada jogo é marcado automaticamente em uma quadra e horário, sem
            conflito de jogadores.
          </p>
        </section>
      )}

      <section className="space-y-2">
        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-emerald-600" /> Regras de pontuação
        </h4>
        {stages.length > 0 ? (
          <ul className="list-disc pl-5 space-y-1">
            {stages.map((stage, index) => {
              const scoring = resolveStageScoringConfig(modality, tournament, index);
              return (
                <li key={`${stage.type}-${index}`}>
                  <strong>Fase {index + 1}:</strong> {RULESET_LABELS[scoring.ruleset] || scoring.ruleset} · {formatScoringSummary(scoring)}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">A pontuação desta modalidade ainda não foi configurada.</p>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-emerald-600" /> Critério de classificação
        </h4>
        <p>A classificação é feita pelo número de vitórias. Em caso de empate valem, nesta ordem:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li><strong>Saldo de pontos</strong> — diferença entre pontos a favor e pontos sofridos.</li>
          <li><strong>Maior número de pontos marcados</strong> (a favor).</li>
          <li><strong>Menor número de pontos sofridos</strong>.</li>
        </ol>
      </section>

      {modality.notes && (
        <section className="space-y-1">
          <h4 className="font-semibold text-slate-900">Observações do organizador</h4>
          <p className="whitespace-pre-line">{modality.notes}</p>
        </section>
      )}
    </div>
  );
}
