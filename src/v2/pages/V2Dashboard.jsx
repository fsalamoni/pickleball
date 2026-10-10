import React, { Suspense, lazy } from 'react';
import { V2Skeleton } from '@/v2/ui/primitives';

// A tela inicial é UMA: a personalizada (por pessoa). A clássica e a
// "orientada a ação" saíram em 2026-10-10, quando as flags viraram código.
const V2PersonalHome = lazy(() => import('@/v2/components/home/personal/V2PersonalHome'));

export default function V2Dashboard() {
  return (
    <Suspense fallback={<HomeCarregando />}>
      <V2PersonalHome />
    </Suspense>
  );
}

function HomeCarregando() {
  return (
    <div className="mx-auto max-w-[1400px] space-y-6" aria-busy="true" aria-label="Carregando a tela inicial">
      <V2Skeleton className="h-52 rounded-4xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <V2Skeleton key={i} className="h-20 rounded-3xl" />)}
      </div>
      <V2Skeleton className="h-64 rounded-4xl" />
    </div>
  );
}
