/**
 * Porta das telas do Centro de Treino: com a flag `training_center` desligada
 * a rota volta ao início (nada de tela pela metade); enquanto as flags
 * carregam, um esqueleto — nunca um "não existe".
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useFeatureFlags } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { V2Skeleton } from '@/v2/ui/primitives';

export default function TrainingGate({ children }) {
  const { flags, isLoading } = useFeatureFlags();
  if (isLoading) return <V2Skeleton className="h-64 rounded-4xl" />;
  if (!flags?.[FEATURE_FLAG.TRAINING_CENTER]) return <Navigate to="/" replace />;
  return children;
}
