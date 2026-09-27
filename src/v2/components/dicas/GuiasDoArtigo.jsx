/**
 * "Mostre na tela" no fim de um artigo da central de ajuda (flag
 * `guided_tips`): ler e, em seguida, FAZER — o guia leva à tela e aponta o
 * botão de verdade.
 *
 * Só aparecem os guias que valem para a pessoa (flags e papel): oferecer
 * "Cadastrar quadras" a quem não tem arena levaria a uma tela que ela não
 * abre. Com as dicas desligadas não renderiza nada — e nem consulta nada.
 */
import React, { useMemo } from 'react';
import { PlayCircle } from 'lucide-react';
import { V2Button } from '@/v2/ui/primitives';
import { dicaVisivel, guiaPorId } from '@/modules/help/domain/guias';
import { useDicas } from './DicasContext';
import { useContextoDasDicas } from './useContextoDasDicas';

function Botoes({ ids }) {
  const { iniciarGuia } = useDicas();
  const ctx = useContextoDasDicas();
  const guias = useMemo(
    () => ids.map(guiaPorId).filter((g) => g && dicaVisivel(g, ctx)),
    [ids, ctx],
  );
  if (guias.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-acid/10 px-3 py-2.5">
      <span className="text-xs font-semibold text-ink">Quer fazer agora?</span>
      {guias.map((g) => (
        <V2Button key={g.id} type="button" size="sm" variant="secondary" onClick={() => iniciarGuia(g.id)}>
          <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
          {guias.length === 1 ? 'Mostre na tela' : g.title}
        </V2Button>
      ))}
    </div>
  );
}

export default function GuiasDoArtigo({ ids }) {
  const { on } = useDicas();
  if (!on || !ids?.length) return null;
  return <Botoes ids={ids} />;
}
