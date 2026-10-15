import React, { Suspense, lazy } from 'react';
import { V2Skeleton, V2Page } from '@/v2/ui/primitives';

// A Minha área baixa só quando a pessoa abre o perfil.
const UserArea = lazy(() => import('@/v2/components/userArea/UserArea'));

/**
 * `/perfil` É a Minha área (a central da pessoa). O perfil clássico saiu em
 * 2026-10-10, quando a flag `user_hub` virou permanente — ver docs/41-MINHA-AREA.md.
 */
export default function V2Profile() {
  return (
    <Suspense fallback={<div><V2Skeleton className="h-64 rounded-4xl" /></div>}>
      <UserArea />
    </Suspense>
  );
}
