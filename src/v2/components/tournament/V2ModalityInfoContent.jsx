import React from 'react';
import { Link } from 'react-router-dom';
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
import StageExplanation from '@/modules/tournament/components/StageExplanation';
import { V2Badge } from '@/v2/ui/primitives';

function formatBRL(cents) {
  const value = Number(cents || 0) / 100;
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function formatConfirmedCount(count) {
  return `${count} ${count === 1 ? 'inscrição confirmada' : 'inscrições confirmadas'}`;
}

export default function V2ModalityInfoContent({ modality, tournament, registrationsCount = 0 }) {
  if (!modality) return null;
  const stages = Array.isArray(modality.stages) && modality.stages.length > 0 ? modality.stages : [];
  const isMultiPhase = stages.length > 1;
  const stageType = stages[0]?.type;
  const groupCount = stages[0]?.group_count || 1;
  const seedCount = stages[0]?.seed_count || 0;
  const fee = Number(modality.entry_fee_cents || 0);

  return (
    <div className="space-y-5 text-sm text-gray-600">
      <section>
        <div className="flex flex-wrap gap-1.5">
          <V2Badge tone="neutral">{MODALITY_FORMAT_LABELS[modality.format]}</V2Badge>
          <V2Badge tone="neutral">{SKILL_LEVEL_LABELS[modality.skill_level]}</V2Badge>
          <V2Badge tone="neutral">{GENDER_CATEGORY_LABELS[modality.gender_category]}</V2Badge>
          <V2Badge tone="neutral">{AGE_CATEGORY_LABELS[modality.age_category]}</V2Badge>
          {isMultiPhase ? (
            <V2Badge tone="neutral">{stages.length} fases</V2Badge>
          ) : (
            stageType && <V2Badge tone="neutral">{TOURNAMENT_STAGE_TYPE_LABELS[stageType]}</V2Badge>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="flex items-center gap-2 font-display font-bold text-ink">
          <Users className="h-4 w-4 text-ink" /> Inscrições e formato
        </h4>
        <p>{describeFormat(modality.format)}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-ink">Vagas:</strong>{' '}
            {hasUnlimitedEntries(modality.max_entries)
              ? `abertas. O sistema organizará a modalidade com base nas ${formatConfirmedCount(registrationsCount)} ao encerrar as inscrições.`
              : `até ${modality.max_entries} inscrições. Atualmente ${formatConfirmedCount(registrationsCount)}.`}
          </li>
          <li><strong className="text-ink">Categoria de gênero:</strong> {GENDER_CATEGORY_LABELS[modality.gender_category]}</li>
          <li><strong className="text-ink">Faixa etária:</strong> {AGE_CATEGORY_LABELS[modality.age_category]} <span className="text-xs text-gray-400">(a plataforma é aberta a todas as idades; esta categoria define apenas a faixa elegível para esta modalidade)</span></li>
          <li><strong className="text-ink">Nível recomendado:</strong> {SKILL_LEVEL_LABELS[modality.skill_level]}</li>
          <li className="flex items-center gap-1"><Wallet className="h-3 w-3" /> <strong className="text-ink">Taxa de inscrição:</strong> {fee > 0 ? formatBRL(fee) : 'Gratuita'}</li>
        </ul>
      </section>

      {isMultiPhase ? (
        <section className="space-y-2">
          <h4 className="flex items-center gap-2 font-display font-bold text-ink">
            <Layers className="h-4 w-4 text-ink" /> Como funciona a competição ({stages.length} fases)
          </h4>
          <p className="text-xs text-gray-400">A inscrição é única; a cada fase os classificados avançam para a fase seguinte.</p>
          <ol className="space-y-2">
            {stages.map((s, i) => (
              <li key={i} className="rounded-2xl border border-gray-100 bg-paper p-3">
                <div className="font-bold text-ink">Fase {i + 1}: {TOURNAMENT_STAGE_TYPE_LABELS[s.type] || s.type}</div>
                <p className="mt-0.5 text-xs text-gray-500">{describeStage(s.type)}</p>
                <p className="mt-1 text-xs font-bold text-ink">
                  {RULESET_LABELS[resolveStageScoringConfig(modality, tournament, i).ruleset] || resolveStageScoringConfig(modality, tournament, i).ruleset}
                  {' · '}
                  {formatScoringSummary(resolveStageScoringConfig(modality, tournament, i))}
                </p>
              </li>
            ))}
          </ol>
          <Link to="/v2/torneios/guia" className="inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline">
            <BookOpen className="h-3.5 w-3.5" /> Guia completo de formatos e modelos
          </Link>
        </section>
      ) : (
        stageType && (
          <section className="space-y-2">
            <h4 className="flex items-center gap-2 font-display font-bold text-ink">
              <Layers className="h-4 w-4 text-ink" /> Como funciona a competição
            </h4>
            <p>{describeStage(stageType)}</p>
            <StageExplanation stageType={stageType} playerCount={registrationsCount} groupCount={groupCount} seedCount={seedCount} />
          </section>
        )
      )}

      {(modality.court_count || modality.play_start_time || modality.play_date) && (
        <section className="space-y-2">
          <h4 className="flex items-center gap-2 font-display font-bold text-ink">
            <CalendarClock className="h-4 w-4 text-ink" /> Quadras e horários
          </h4>
          <ul className="list-disc space-y-1 pl-5">
            {modality.play_date && <li><strong className="text-ink">Data:</strong> {modality.play_date}</li>}
            {modality.play_start_time && (
              <li>
                <strong className="text-ink">Horário:</strong> a partir das {modality.play_start_time}
                {modality.play_end_time ? ` até ${modality.play_end_time}` : ''}
              </li>
            )}
            {modality.court_count && <li><strong className="text-ink">Quadras disponíveis:</strong> {modality.court_count}</li>}
            {modality.match_duration_minutes && <li><strong className="text-ink">Duração média do jogo:</strong> {modality.match_duration_minutes} minutos</li>}
          </ul>
          <p className="text-xs text-gray-400">Após o sorteio, cada jogo é marcado automaticamente em uma quadra e horário, sem conflito de jogadores.</p>
        </section>
      )}

      <section className="space-y-2">
        <h4 className="flex items-center gap-2 font-display font-bold text-ink">
          <BookOpen className="h-4 w-4 text-ink" /> Regras de pontuação
        </h4>
        {stages.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5">
            {stages.map((stage, index) => {
              const scoring = resolveStageScoringConfig(modality, tournament, index);
              return (
                <li key={`${stage.type}-${index}`}>
                  <strong className="text-ink">Fase {index + 1}:</strong> {RULESET_LABELS[scoring.ruleset] || scoring.ruleset} · {formatScoringSummary(scoring)}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">A pontuação desta modalidade ainda não foi configurada.</p>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="flex items-center gap-2 font-display font-bold text-ink">
          <Trophy className="h-4 w-4 text-ink" /> Critério de classificação
        </h4>
        <p>A classificação é feita pelo número de vitórias. Em caso de empate valem, nesta ordem:</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li><strong className="text-ink">Saldo de pontos</strong> — diferença entre pontos a favor e pontos sofridos.</li>
          <li><strong className="text-ink">Maior número de pontos marcados</strong> (a favor).</li>
          <li><strong className="text-ink">Menor número de pontos sofridos</strong>.</li>
        </ol>
      </section>

      {modality.notes && (
        <section className="space-y-1">
          <h4 className="font-display font-bold text-ink">Observações do organizador</h4>
          <p className="whitespace-pre-line">{modality.notes}</p>
        </section>
      )}
    </div>
  );
}
