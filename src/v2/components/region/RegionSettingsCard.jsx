/**
 * Configurações → **Minha região** (flag `my_region`): de onde a plataforma
 * mostra o que acontece — dias de jogo, torneios, arenas, professores, clubes
 * e promoções. `/configuracoes#minha-regiao` cai aqui.
 */
import React from 'react';
import { MapPin } from 'lucide-react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { V2Surface } from '@/v2/ui/primitives';
import RegionPicker from './RegionPicker';

export default function RegionSettingsCard() {
  const on = useFeatureFlag(FEATURE_FLAG.MY_REGION);
  // Desligada, nenhuma opção que não faz nada.
  if (!on) return null;
  return (
    <V2Surface id="minha-regiao" className="scroll-mt-6" data-dica="config-regiao">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-ink" aria-hidden="true" />
        <h2 className="font-display text-lg font-bold text-ink">Minha região</h2>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        A plataforma mostra primeiro o que acontece aqui: dias de jogo e jogos com vaga, torneios, arenas,
        professores, clubes e promoções. O que fica de fora não some — cada tela diz quantos são e deixa ver também.
      </p>
      <RegionPicker className="mt-4" />
    </V2Surface>
  );
}
