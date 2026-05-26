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
  MODALITY_FORMAT,
  MODALITY_FORMAT_LABELS,
  SKILL_LEVEL_LABELS,
  GENDER_CATEGORY_LABELS,
  AGE_CATEGORY_LABELS,
  TOURNAMENT_STAGE_TYPE,
  TOURNAMENT_STAGE_TYPE_LABELS,
  RULESET_LABELS,
} from '@/modules/tournament/domain/constants';
import { normalizeScoringConfig } from '@/modules/tournament/domain/scoring';

const STAGE_DESCRIPTION = {
  [TOURNAMENT_STAGE_TYPE.ROUND_ROBIN]:
    'Pontos corridos: todos jogam contra todos uma vez. A classificação final é dada pelo desempenho geral de cada participante.',
  [TOURNAMENT_STAGE_TYPE.GROUPS]:
    'Fase de grupos: participantes divididos em grupos, todos contra todos dentro do grupo, e os melhores avançam.',
  [TOURNAMENT_STAGE_TYPE.KNOCKOUT]:
    'Chaves (mata-mata): jogos eliminatórios — quem perde está fora. As partidas seguem o chaveamento sorteado.',
  [TOURNAMENT_STAGE_TYPE.DOUBLE_KNOCKOUT]:
    'Dupla eliminação: cada participante tem direito a duas derrotas antes de ser eliminado. Quem perde uma vez vai para a chave dos perdedores.',
  [TOURNAMENT_STAGE_TYPE.SWISS]:
    'Sistema suíço: a cada rodada, participantes com pontuação semelhante são pareados. Sem eliminação direta.',
  [TOURNAMENT_STAGE_TYPE.AMERICANO]:
    'Americana (rotação): formato em duplas onde cada jogador joga com cada outro jogador exatamente uma vez. O total de jogos é exato: N·(N−1)/4. Para N múltiplo de 4 os jogos são organizados primeiro dentro de cada bloco de 4 e depois nos cruzamentos entre blocos.',
};

const FORMAT_DESCRIPTION = {
  [MODALITY_FORMAT.SINGLES]: 'Simples (1 contra 1): cada inscrição é individual.',
  [MODALITY_FORMAT.DOUBLES]: 'Duplas (2 contra 2): cada inscrição precisa de jogador A e jogador B definidos no momento da inscrição.',
  [MODALITY_FORMAT.AMERICANO]: 'Americana: inscrição individual; as duplas são montadas por rotação para que cada jogador jogue ao menos uma vez com cada outro jogador.',
};

function formatBRL(cents) {
  const value = Number(cents || 0) / 100;
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

export default function ModalityInfoModal({ modality, tournament, registrationsCount, open, onClose }) {
  if (!modality) return null;
  const scoring = normalizeScoringConfig(modality.scoring_override || tournament?.scoring);
  const stageType = modality.stages?.[0]?.type;
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
            <p>{FORMAT_DESCRIPTION[modality.format]}</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              <li><strong>Vagas:</strong> até {modality.max_entries} inscrições. Atualmente {registrationsCount} confirmada(s).</li>
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
              <p>{STAGE_DESCRIPTION[stageType] || 'Formato definido pelo organizador.'}</p>
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
