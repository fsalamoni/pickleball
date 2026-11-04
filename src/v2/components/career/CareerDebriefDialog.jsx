/**
 * O balanço do torneio de fora (camada 4 da ficha, docs/54 §4.4): o MESMO
 * `DebriefDialog` do Centro de Treino, com a origem `externo` já preenchida.
 * Carregado só quando a pessoa toca em "Fazer o balanço" — a identidade do
 * treino (professores, idade) e a biblioteca de drills não pesam na ficha.
 *
 * Salvo o balanço, o diálogo mostra a semana de drills sugerida
 * (`suggestWeek`); nada entra nos treinos sem o toque em "Adicionar".
 */
import React from 'react';
import { useTrainingIdentity } from '@/modules/training/hooks/useTrainingIdentity';
import DebriefDialog from '@/v2/components/training/debrief/DebriefDialog';

export default function CareerDebriefDialog({ open, onOpenChange, source, history = [], initial = null, sharedCoachId = null }) {
  const identity = useTrainingIdentity();
  return <DebriefDialog open={open} onOpenChange={onOpenChange} identity={identity} source={source} history={history} initial={initial} sharedCoachId={sharedCoachId} />;
}
