/**
 * Configurações → **Dicas** (flag `guided_tips`): ligar ou desligar as dicas,
 * abrir os guias e mostrar de novo os pontos que já foram vistos.
 *
 * Some com a flag desligada — nenhuma opção que não faz nada.
 */
import React from 'react';
import { Lightbulb, PlayCircle, RotateCcw } from 'lucide-react';
import { V2Button, V2Surface } from '@/v2/ui/primitives';
import { useDicas } from './DicasContext';
import InterruptorDicas from './InterruptorDicas';

export default function DicasSettingsCard() {
  const d = useDicas();
  if (!d.on) return null;
  const feitos = d.feitos.length;
  return (
    <V2Surface id="dicas" data-dica="config-dicas" className="scroll-mt-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-ink" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold text-ink">Dicas</h2>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {d.ligadas
              ? 'Ligadas: pontos pulsando nas telas mostram o que cada botão faz.'
              : 'Desligadas: nada aparece sozinho. Os guias continuam a um toque no botão "Dicas" do topo.'}
          </p>
        </div>
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
      <p className="mt-3 text-xs text-gray-400">A escolha fica salva neste aparelho, na sua conta.</p>
    </V2Surface>
  );
}
