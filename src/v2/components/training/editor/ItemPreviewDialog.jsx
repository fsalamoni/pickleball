/**
 * "Ver prévia": a ficha como quem treina vai vê-la, desenhada pela MESMA
 * `TrainingItemView` da página do item — antes de salvar. A ficha chega sob
 * demanda e falha sozinha (boundary próprio): um erro na prévia nunca pode
 * derrubar o formulário com o que a pessoa escreveu.
 */
import React, { Suspense, lazy } from 'react';
import { useVisibleTrainingItems } from '@/modules/training/hooks/useTrainingItems';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import V2RouteBoundary from '@/v2/components/V2RouteBoundary';
import { V2Skeleton } from '@/v2/ui/primitives';

const TrainingItemView = lazy(() => import('@/v2/components/training/item/TrainingItemView'));

/** O treino aponta para outros itens: a prévia recebe o mapa para mostrá-los. */
function PreviaDoTreino({ item, identity }) {
  const { byId } = useVisibleTrainingItems(identity);
  return <TrainingItemView item={item} itemsById={byId} />;
}

export default function ItemPreviewDialog({ open, onOpenChange, item, identity }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Prévia da ficha</DialogTitle>
          <DialogDescription>É assim que quem treina vai ver. Nada foi salvo ainda.</DialogDescription>
        </DialogHeader>
        {open && item && (
          <V2RouteBoundary name="treino-previa">
            <Suspense fallback={<V2Skeleton className="h-64 rounded-3xl" />}>
              {item.kind === 'treino'
                ? <PreviaDoTreino item={item} identity={identity} />
                : <TrainingItemView item={item} />}
            </Suspense>
          </V2RouteBoundary>
        )}
      </DialogContent>
    </Dialog>
  );
}
