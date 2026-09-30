/**
 * "Com vaga para você" — no Dia de jogo, a aba em que o "Jogar" abre.
 *
 * Quem toca em "Jogar" chega aqui. Antes a tela mostrava só os dias de jogo
 * que a pessoa já tinha (criados ou em que entrou) — e quem não tinha nenhum
 * encontrava um "Nenhum dia de jogo ainda" e o botão de criar, com dias de
 * jogo abertos esperando gente em outra aba. Agora os dias em que ela pode
 * entrar aparecem logo abaixo dos dela, com o botão de entrar ali mesmo:
 *  - os públicos (dos atletas e das arenas) e os dos CLUBES dela;
 *  - os jogos abertos das arenas em que ela cabe (faixa de nível);
 *  - só o que ela ainda não tem (o que ela tem está na lista de cima) e só o
 *    que ela PODE entrar (`playItemsForMe`).
 *
 * A lista é a MESMA do "Jogar" do início e do Procura-se jogo
 * (`usePlayDiscovery`) — e é para lá que "Ver todos" leva, com os convites.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Dices, Search } from 'lucide-react';
import { usePlayDiscovery } from '@/modules/games/hooks/usePlayDiscovery';
import { PLAY_KIND, playItemsForMe } from '@/modules/games/domain/playDiscovery';
import { useRegionalList } from '@/core/lib/useMyRegion';
import { distanceLabel } from '@/core/domain/region';
import { useRelogio } from '@/core/lib/useRelogio';
import { hojeLocal } from '@/modules/home/domain/freshness';
import { V2Button, V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { RegionForaNote } from '@/v2/components/region/RegionBar';
import PlayGameDayCard from './PlayGameDayCard';

/** Quantos cabem aqui (o resto está em Procura-se jogo). */
const LIMITE = 4;
const lugarDe = (item) => item.place;

export default function OpenGameDaysForMe() {
  const { ms: agora } = useRelogio(60_000);
  const hoje = hojeLocal(new Date(agora));
  const jogos = usePlayDiscovery({ hoje, agora });

  const disponiveis = useMemo(
    () => playItemsForMe(jogos.itens).filter((i) => !i.estou && i.kind !== PLAY_KIND.CONVITE),
    [jogos.itens],
  );
  const regional = useRegionalList(disponiveis, lugarDe);
  const mostrados = regional.itens.slice(0, LIMITE);
  const resto = regional.itens.length - mostrados.length;
  const carregando = jogos.carregando || regional.carregando;
  // "Nenhum com vaga" só com TODAS as fontes em mãos.
  const nada = !carregando && !jogos.isError && regional.itens.length === 0;

  return (
    <section aria-labelledby="com-vaga-titulo" data-dica="dia-de-jogo-com-vaga" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">
            <Dices className="h-3.5 w-3.5" aria-hidden="true" /> Com vaga para você
          </p>
          <h2 id="com-vaga-titulo" className="mt-1 font-display text-xl font-bold text-ink">Dias de jogo para entrar</h2>
          <p className="mt-1 text-sm text-gray-500">
            Os públicos, dos atletas e das arenas, e os dos seus clubes — entre direto.
          </p>
        </div>
        <V2Button asChild variant="ghost" size="sm">
          <Link to="/procura-jogo">Procura-se jogo <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </V2Button>
      </div>

      {jogos.falhas.dias && (
        <V2ErrorState inline title="Não carregou os dias de jogo com vaga" description="Pode haver dia de jogo esperando gente." onRetry={jogos.recarregar.dias} />
      )}
      {jogos.falhas.clubes && (
        <V2ErrorState inline title="Não carregou os dias de jogo dos seus clubes" description="Pode haver dia marcado no seu clube." onRetry={jogos.recarregar.clubes} />
      )}
      {jogos.falhas.vagas && (
        <V2ErrorState inline title="Não carregou os jogos das arenas" description="Tente de novo em instantes." onRetry={jogos.recarregar.vagas} />
      )}

      <RegionForaNote regional={regional} nomeItens={['dia de jogo', 'dias de jogo']} className="block text-sm" />

      {carregando ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => <V2Skeleton key={i} className="h-44 rounded-4xl" />)}
        </div>
      ) : nada ? (
        <p className="flex items-start gap-2 rounded-3xl bg-paper p-4 text-sm text-gray-600">
          <Search className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <span>
            Nenhum dia de jogo com vaga para você nos próximos dias{regional.limita ? ` ${regional.frase}` : ''}.
            Em <Link to="/procura-jogo" className="font-bold text-ink underline">Procura-se jogo</Link> há também os convites de quem procura parceiro.
          </span>
        </p>
      ) : mostrados.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2" data-dica="dia-de-jogo-com-vaga-lista">
          {mostrados.map((item) => (
            <PlayGameDayCard
              key={item.key}
              item={item}
              distancia={regional.ativa ? distanceLabel(regional.infoDe(item)?.km) : null}
            />
          ))}
        </div>
      ) : null}

      {resto > 0 && (
        <V2Button asChild variant="secondary" size="sm">
          <Link to="/procura-jogo">Ver todos os {regional.itens.length} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </V2Button>
      )}
    </section>
  );
}
