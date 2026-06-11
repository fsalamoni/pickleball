import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Info, Trophy, Users, Wallet, BookOpen, Layers } from 'lucide-react';
import {
  MODALITY_FORMAT_LABELS,
  SKILL_LEVEL_LABELS,
  GENDER_CATEGORY_LABELS,
  AGE_CATEGORY_LABELS,
  TOURNAMENT_STAGE_TYPE_LABELS,
  RULESET_LABELS,
} from '@/modules/tournament/domain/constants';
import { hasUnlimitedEntries } from '@/modules/tournament/domain/capacity';
import { normalizeScoringConfig } from '@/modules/tournament/domain/scoring';
import { describeFormat, describeStage } from '@/modules/tournament/domain/formatExplain';
import StageExplanation from './StageExplanation';

function formatBRL(cents) {
  const value = Number(cents || 0) / 100;
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function formatConfirmedCount(count) {
  return `${count} ${count === 1 ? 'inscrição confirmada' : 'inscrições confirmadas'}`;
}

export default function ModalityInfoModal({ modality, tournament, registrationsCount, open, onClose }) {
  if (!modality) return null;
  const scoring = normalizeScoringConfig(modality.scoring_override || tournament?.scoring);
  const stageType = modality.stages?.[0]?.type;
  const groupCount = modality.stages?.[0]?.group_count || 1;
  const seedCount = modality.stages?.[0]?.seed_count || 0;
  const fee = Number(modality.entry_fee_cents || 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-emerald-600" /> {modality.name}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto space-y-4 text-sm text-slate-700">
          <section>
            <div className="flex flex-wrap gap-1">
              <Badge variant="secondary">{MODALITY_FORMAT_LABELS[modality.format]}</Badge>
              <Badge variant="secondary">{SKILL_LEVEL_LABELS[modality.skill_level]}</Badge>
              <Badge variant="secondary">{GENDER_CATEGORY_LABELS[modality.gender_category]}</Badge>
              <Badge variant="secondary">{AGE_CATEGORY_LABELS[modality.age_category]}</Badge>
              {stageType && (
                <Badge variant="secondary">{TOURNAMENT_STAGE_TYPE_LABELS[stageType]}</Badge>
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

          {stageType && (
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
          )}

          <section className="space-y-2">
            <h4 className="font-semibold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" /> Regras de pontuação
            </h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Conjunto de regras:</strong> {RULESET_LABELS[scoring.ruleset] || scoring.ruleset}</li>
              <li><strong>Pontos por game:</strong> {scoring.target_score} (vantagem mínima de 2)</li>
              <li><strong>Sets por partida:</strong> {scoring.sets_per_match === 1 ? '1 set' : `Melhor de ${scoring.sets_per_match}`}</li>
            </ul>
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
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
