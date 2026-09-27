/**
 * O início sem nenhum card — uma escolha válida da pessoa ("só o resumo do
 * dia"), então a tela NÃO trata como erro nem volta ao padrão sozinha. Diz o
 * que está acontecendo e oferece os dois caminhos: escolher cards ou voltar ao
 * padrão (Dias de jogo, Horários da arena e Ranking).
 */
import React from 'react';
import { LayoutGrid, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useHomeCards } from '@/modules/home/hooks/useHomeCards';

export default function HomeCardsEmpty({ onEscolher }) {
  const { restaurar } = useHomeCards();
  return (
    <section
      aria-labelledby="inicio-enxuto-titulo"
      className="flex flex-col items-center gap-4 rounded-4xl border border-dashed border-gray-200 bg-paper-pure px-6 py-10 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-paper text-ink" aria-hidden="true">
        <LayoutGrid className="h-6 w-6" />
      </span>
      <div className="max-w-md">
        <h2 id="inicio-enxuto-titulo" className="font-display text-xl font-bold text-ink">Seu início está enxuto</h2>
        <p className="mt-1.5 text-sm text-gray-500">
          Só o resumo do dia, como você escolheu. Quando quiser, ligue os cards que fazem sentido para você.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onEscolher}
          aria-haspopup="dialog"
          className="btn-press inline-flex items-center gap-1.5 rounded-full bg-acid px-4 py-2 text-sm font-bold text-ink hover:bg-acid-light focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/40"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Escolher o que aparece
        </button>
        <button
          type="button"
          onClick={restaurar}
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-paper-pure px-4 py-2 text-sm font-bold text-ink hover:border-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Voltar ao padrão
        </button>
      </div>
    </section>
  );
}
