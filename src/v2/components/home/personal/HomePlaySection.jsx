/**
 * "Jogar" na tela inicial — os jogos com vaga dos próximos dias.
 *
 * 🐞 Antes, esta seção lia só os convites de "Procura-se jogo" e os jogos
 * abertos das arenas. Os DIAS DE JOGO QUE AS ARENAS MARCAM no calendário —
 * públicos, com vagas — nunca apareciam aqui (nem no Procura-se jogo), e o
 * card prometia justamente "dias de jogo e jogos com vaga, das arenas e dos
 * atletas". Agora a lista é uma só (`usePlayDiscovery` → `buildPlayList`):
 *  - dias de jogo públicos do ATLETA e da ARENA, com as vagas que sobram;
 *  - jogos abertos das arenas;
 *  - convites de "Procura-se jogo".
 *
 * Tocar num dia de jogo leva para DENTRO dele (`/dia-de-jogo/:id`), onde a
 * pessoa vê o formato, quem vai, e se inscreve — não para a página da arena.
 *
 * Só o que ainda vale: o que já terminou some, o que a pessoa já tem (o dia em
 * que ela está, o que ela criou) também — ele mora na agenda.
 *
 * Com a MINHA REGIÃO (flag `my_region`), só o que está na região da pessoa,
 * com a barra dizendo qual é e quantos ficaram de fora. Sem ela, o mais perto
 * primeiro (cidade, depois estado), como antes.
 */
import React, { useMemo } from 'react';
import {
  Building2, Dices, Megaphone, Plus, Swords, Users,
} from 'lucide-react';
import { usePlayDiscovery } from '@/modules/games/hooks/usePlayDiscovery';
import { PLAY_KIND } from '@/modules/games/domain/playDiscovery';
import { proximidade } from '@/modules/home/domain/homeTournaments';
import { useRegionalList } from '@/core/lib/useMyRegion';
import { distanceLabel } from '@/core/domain/region';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import RegionBar, { RegionEmptyHint } from '@/v2/components/region/RegionBar';
import { HomeAction, HomeEmpty, HomeRow, HomeSection } from './HomeSection';

/** Quantos jogos a tela inicial mostra (o resto está em Procura-se jogo). */
const NO_INICIO = 5;

const lugarDe = (item) => item.place;

function iconeDe(item) {
  if (item.kind === PLAY_KIND.CONVITE) return Megaphone;
  return item.daArena ? Building2 : Dices;
}

export default function HomePlaySection({ reason, hoje, agora, perfil }) {
  const jogos = usePlayDiscovery({ hoje, agora });
  const regional = useRegionalList(jogos.itens, lugarDe);

  // Sem a Minha região: o mais perto primeiro, sem perder a ordem por data.
  const lista = useMemo(() => {
    if (regional.ativa) return regional.itens;
    return regional.itens
      .map((item, i) => ({ item, i, perto: proximidade(item.place, perfil) }))
      .sort((a, b) => b.perto - a.perto || a.i - b.i)
      .map(({ item }) => item);
  }, [regional.ativa, regional.itens, perfil]);

  const falhou = jogos.isError;
  const carregando = jogos.carregando || regional.carregando;
  // "Nenhum jogo" só com TODAS as fontes em mãos: com uma fora do ar, pode
  // haver jogo esperando gente.
  const nada = !carregando && !falhou && lista.length === 0;
  const mostrados = lista.slice(0, NO_INICIO);
  const resto = lista.length - mostrados.length;

  return (
    <HomeSection id="jogar" icon={Swords} title="Jogar" reason={reason} action={{ to: '/procura-jogo', label: 'Procura-se jogo' }}>
      <div className="space-y-4">
        <RegionBar regional={regional} compacta nomeItens={['jogo', 'jogos']} />
        {jogos.falhas.dias && (
          <V2ErrorState inline title="Não carregou os dias de jogo" description="Pode haver dia de jogo esperando gente." onRetry={jogos.recarregar.dias} />
        )}
        {jogos.falhas.convites && (
          <V2ErrorState inline title="Não carregou os convites" description="Pode haver jogo esperando gente." onRetry={jogos.recarregar.convites} />
        )}
        {jogos.falhas.vagas && (
          <V2ErrorState inline title="Não carregou os jogos das arenas" description="Tente de novo em instantes." onRetry={jogos.recarregar.vagas} />
        )}
        {carregando ? (
          <V2Skeleton lines={3} />
        ) : nada ? (
          <>
            <RegionEmptyHint regional={regional} oque="Nenhum jogo com vaga" />
            {!(regional.ativa && regional.fora > 0) && (
              <HomeEmpty icon={Dices} actions={<HomeAction to="/dia-de-jogo?criar=1" primary><Plus className="h-3.5 w-3.5" aria-hidden="true" /> Criar dia de jogo</HomeAction>}>
                Nenhum jogo com vaga nos próximos dias{regional.limita ? ` ${regional.frase}` : ''}. Monte o seu — público, ele aparece para quem procura jogo.
              </HomeEmpty>
            )}
          </>
        ) : mostrados.length > 0 ? (
          <ul className="space-y-1">
            {mostrados.map((item) => {
              const km = regional.ativa ? distanceLabel(regional.infoDe(item)?.km) : null;
              return (
                <li key={item.key}>
                  <HomeRow
                    to={item.link}
                    icon={iconeDe(item)}
                    title={item.title}
                    subtitle={[item.subtitle, km].filter(Boolean).join(' · ')}
                    badge={item.badge || (!regional.ativa
                      ? (proximidade(item.place, perfil) === 2 ? 'Na sua cidade' : proximidade(item.place, perfil) === 1 ? 'No seu estado' : null)
                      : null)}
                    badgeTone={item.badge ? 'green' : 'acid'}
                  />
                </li>
              );
            })}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {resto > 0 && (
            <HomeAction to="/procura-jogo" primary>Ver todos os {lista.length} jogos</HomeAction>
          )}
          {!nada && (
            <HomeAction to="/dia-de-jogo?criar=1"><Dices className="h-3.5 w-3.5" aria-hidden="true" /> Criar dia de jogo</HomeAction>
          )}
          <HomeAction to="/encontrar-jogadores"><Users className="h-3.5 w-3.5" aria-hidden="true" /> Encontrar jogadores</HomeAction>
        </div>
      </div>
    </HomeSection>
  );
}
