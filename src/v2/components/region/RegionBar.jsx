/**
 * A barra da MINHA REGIÃO numa tela de descoberta (flag `my_region`).
 *
 * Diz o que a tela está mostrando e deixa mudar — sem que nada suma calado:
 *  - "📍 Porto Alegre + 50 km" (toque: muda a região, no diálogo);
 *  - "3 em outras regiões · Ver também" quando a região deixou gente de fora
 *    (o "ver também" vale só nesta tela, nesta visita);
 *  - "Buscando em todo lugar" quando a pessoa está procurando pelo nome;
 *  - "Informe a sua cidade" quando o perfil não tem cidade.
 *
 * Recebe o resultado de `useRegionalList`. Desligada a flag, não desenha nada.
 */
import React, { Suspense, lazy, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, MapPin } from 'lucide-react';
import { REGION_MISSING, REGION_MODE } from '@/core/domain/region';
import { cn } from '@/core/lib/utils';

const RegionDialog = lazy(() => import('./RegionDialog'));

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

export default function RegionBar({
  regional, className, compacta = false, nomeItens = ['item', 'itens'], mostrarFora = true,
}) {
  const [aberto, setAberto] = useState(false);
  if (!regional?.ativa) return null;
  const {
    rotuloCurto, rotulo, buscando, region, mapaFalhou,
  } = regional;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm',
        compacta ? 'text-xs' : '',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={`Região: ${rotulo}. Alterar`}
        title="Alterar a minha região"
        data-dica="regiao-alterar"
        className={cn(
          'btn-press inline-flex max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-paper-pure font-semibold text-ink shadow-sm transition-colors hover:border-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30',
          compacta ? 'px-2.5 py-1' : 'px-3.5 py-1.5',
        )}
      >
        <MapPin className="h-3.5 w-3.5 shrink-0 text-acid-dark" aria-hidden="true" />
        <span className="truncate">{rotuloCurto}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
      </button>

      {buscando ? (
        <span className="text-gray-500">Buscando em todo lugar</span>
      ) : mostrarFora ? (
        <RegionForaNote regional={regional} nomeItens={nomeItens} />
      ) : null}

      {region?.falta === REGION_MISSING.CIDADE && (
        <span className="text-gray-500">
          <Link to="/perfil/editar" className="font-semibold text-ink underline underline-offset-2">Informe a sua cidade</Link>
          {' '}para ver primeiro o que está perto.
        </span>
      )}
      {mapaFalhou && region?.modo === REGION_MODE.RAIO && (
        <span className="text-amber-700">Sem o mapa das cidades agora — valendo só {region.cidade}.</span>
      )}

      {aberto && (
        <Suspense fallback={null}>
          <RegionDialog open={aberto} onOpenChange={setAberto} />
        </Suspense>
      )}
    </div>
  );
}

/**
 * O vazio QUE A REGIÃO CAUSOU: "Nada em Porto Alegre e até 50 km agora" —
 * com o caminho, em vez de uma parede. Só aparece quando a região limitou e
 * havia algo fora dela; senão a tela usa o vazio de sempre.
 */
export function RegionEmptyHint({ regional, oque = 'nada', className }) {
  const [aberto, setAberto] = useState(false);
  if (!regional?.ativa || regional.fora === 0 || regional.itens.length > 0) return null;
  return (
    <div className={cn('rounded-3xl border border-dashed border-gray-200 bg-paper p-4 text-sm text-gray-600', className)}>
      <p>
        {oque === 'nada' ? 'Nada' : oque} {regional.frase} agora — mas há {regional.fora} em outras regiões.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={regional.ampliar}
          className="btn-press rounded-full bg-ink px-3.5 py-1.5 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
        >
          Ver os de outras regiões
        </button>
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="btn-press rounded-full border border-gray-200 bg-paper-pure px-3.5 py-1.5 text-xs font-semibold text-ink hover:border-ink focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
        >
          Aumentar a região
        </button>
      </div>
      {aberto && (
        <Suspense fallback={null}>
          <RegionDialog open={aberto} onOpenChange={setAberto} />
        </Suspense>
      )}
    </div>
  );
}

/**
 * Só a linha do que ficou de fora: "3 em outras regiões · Ver também" (ou,
 * ampliado, "Incluindo outras regiões · Só a minha região"). Para uma seção
 * dentro de uma tela que já mostra a barra da região no topo.
 */
export function RegionForaNote({ regional, nomeItens = ['item', 'itens'], className }) {
  if (!regional?.ativa || regional.buscando) return null;
  const { fora, ampliado, ampliadoCom, ampliar, recolher } = regional;
  if (fora > 0) {
    return (
      <span className={cn('text-gray-500', className)}>
        {plural(fora, nomeItens[0], nomeItens[1])} em outras regiões ·{' '}
        <button type="button" onClick={ampliar} className="font-semibold text-ink underline underline-offset-2 hover:text-acid-dark">
          Ver também
        </button>
      </span>
    );
  }
  if (ampliado && ampliadoCom > 0) {
    return (
      <span className={cn('text-gray-500', className)}>
        Incluindo outras regiões ·{' '}
        <button type="button" onClick={recolher} className="font-semibold text-ink underline underline-offset-2 hover:text-acid-dark">
          Só a minha região
        </button>
      </span>
    );
  }
  return null;
}
