/**
 * O botão "Dicas" do topo de toda tela — a porta das dicas.
 *
 * É o único pedaço das dicas que existe com elas DESLIGADAS: sem ele, a
 * pessoa não teria como ligar. Abre o painel (ligar/desligar e "O que você
 * quer fazer?"). Ligadas, ganha o fundo ácido — dá para saber de relance.
 */
import React from 'react';
import { Lightbulb } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useDicas } from './DicasContext';

export default function BotaoDicas() {
  const { on, ligadas, abrirPainel, painelAberto } = useDicas();
  if (!on) return null;
  return (
    <button
      type="button"
      data-dica="botao-dicas"
      onClick={abrirPainel}
      aria-haspopup="dialog"
      aria-expanded={painelAberto}
      aria-label={ligadas ? 'Dicas (ligadas)' : 'Dicas (desligadas)'}
      title={ligadas ? 'Dicas ligadas — ver os guias' : 'Dicas — ligar ou ver os guias'}
      className={cn(
        'btn-press flex h-10 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-bold shadow-sm transition-colors md:px-3.5',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/40',
        ligadas ? 'bg-acid text-ink hover:bg-acid-light' : 'bg-white text-gray-500 hover:text-ink',
      )}
    >
      <Lightbulb className="h-5 w-5" aria-hidden="true" />
      <span className="hidden md:inline">Dicas</span>
    </button>
  );
}
