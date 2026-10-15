import React from 'react';
import { V2Page } from '@/v2/ui/primitives';

/**
 * Porta das telas do Centro de Treino. A flag `training_center` virou
 * permanente em 2026-10-10; a porta dá a moldura de página (V2Page) a todas
 * as telas do treino, e é aqui que mora qualquer condição de entrada futura.
 */
export default function TrainingGate({ children }) {
  return <V2Page>{children}</V2Page>;
}
