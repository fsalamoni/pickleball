/**
 * Configurações → **Dicas** (flag `guided_tips`): ligar ou desligar as dicas,
 * abrir os guias e mostrar de novo os pontos que já foram vistos.
 *
 * Some com a flag desligada — nenhuma opção que não faz nada.
 */
import React from 'react';
import { Lightbulb, PlayCircle, RotateCcw } from 'lucide-react';
import { V2Button } from '@/v2/ui/primitives';
import SettingsSection from '@/v2/components/settings/SettingsSection';
import { useDicas } from './DicasContext';
import InterruptorDicas from './InterruptorDicas';

export default function DicasSettingsCard() {
  const d = useDicas();
  if (!d.on) return null;
  const feitos = d.feitos.length;
  return (
    <SettingsSection id="dicas" dica="config-dicas" icon={Lightbulb} title="Dicas" summary={d.ligadas ? 'Ligadas' : 'Desligadas'}>
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm text-gray-500">
          {d.ligadas
            ? 'Ligadas: pontos pulsando nas telas mostram o que cada botão faz.'
            : 'Desligadas: nada aparece sozinho. Os guias continuam a um toque no botão "Dicas" do topo.'}
        </p>
        <InterruptorDicas ligadas={d.ligadas} onAlternar={d.alternar} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <V2Button variant="secondary" size="sm" onClick={d.abrirPainel}>
          <PlayCircle className="h-4 w-4" aria-hidden="true" /> Ver os guias
        </V2Button>
        {d.vistos.length > 0 && (
          <V2Button variant="ghost" size="sm" onClick={d.recomecarVistos}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Mostrar de novo os pontos já vistos
          </V2Button>
        )}
        {feitos > 0 && (
          <span className="text-xs text-gray-500">
            {feitos === 1 ? '1 guia concluído' : `${feitos} guias concluídos`}
          </span>
        )}
      </div>
      <p className="mt-3 text-xs text-gray-500">A escolha fica salva neste aparelho, na sua conta.</p>
    </SettingsSection>
  );
}
