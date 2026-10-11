/**
 * Configurações → **Minha região** (flag `my_region`): de onde a plataforma
 * mostra o que acontece — dias de jogo, torneios, arenas, professores, clubes
 * e promoções. `/configuracoes#minha-regiao` cai aqui.
 */
import React from 'react';
import { MapPin } from 'lucide-react';

import { useMyRegion } from '@/core/lib/useMyRegion';
import SettingsSection from '@/v2/components/settings/SettingsSection';
import RegionPicker from './RegionPicker';

export default function RegionSettingsCard() {
  const on = true;
  // Desligada, nenhuma opção que não faz nada.
  const { rotulo } = useMyRegion();
  if (!on) return null;
  return (
    <SettingsSection id="minha-regiao" dica="config-regiao" icon={MapPin} title="Minha região" summary={rotulo}>
      <p className="text-sm text-gray-500">
        A plataforma mostra primeiro o que acontece aqui: dias de jogo e jogos com vaga, torneios, arenas,
        professores, clubes e promoções. O que fica de fora não some — cada tela diz quantos são e deixa ver também.
      </p>
      <RegionPicker className="mt-4" />
    </SettingsSection>
  );
}
