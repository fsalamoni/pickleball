/**
 * "Jogar agora": a faixa do topo do início com os jogos com vaga nas próximas
 * 48 h perto da pessoa. Só aparece quando HÁ jogo — e só é montada quando o
 * card Dias de jogo não está escolhido (com ele, a lista já está logo abaixo).
 *
 * Nada novo é consultado: é a mesma lista do Jogar (`usePlayDiscovery`) e a
 * mesma região (`useRegionalList`). Carregando ou falhando, não diz nada — a
 * faixa é um convite, não uma afirmação sobre o vazio.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Swords } from 'lucide-react';
import { usePlayDiscovery } from '@/modules/games/hooks/usePlayDiscovery';
import { jogarAgora } from '@/modules/home/domain/homePlay';
import { useRegionalList } from '@/core/lib/useMyRegion';
import { recordEvent } from '@/core/services/observabilityService';

const lugarDe = (item) => item.place;
const HORAS = 48;

export default function HomePlayNow({ hoje, agora }) {
  const jogos = usePlayDiscovery({ hoje, agora });
  const regional = useRegionalList(jogos.itens, lugarDe);
  const prontos = useMemo(() => jogarAgora(regional.itens, { agora, horas: HORAS }), [regional.itens, agora]);
  if (jogos.carregando || regional.carregando || prontos.length === 0) return null;
  const n = prontos.length;
  const primeiro = prontos[0];
  return (
    <Link
      to="/dia-de-jogo"
      onClick={() => recordEvent('home_play_now_click', { jogos: n })}
      data-secao-inicio="jogar-agora"
      className="group mb-6 flex items-center gap-3 rounded-3xl border border-acid/40 bg-acid/10 px-4 py-3 text-ink transition-colors hover:bg-acid/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/40"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink text-acid" aria-hidden="true">
        <Swords className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-2xs font-bold uppercase tracking-widest text-gray-500">Jogar agora</span>
        <span className="block truncate text-sm font-semibold">
          {n === 1 ? '1 jogo com vaga' : `${n} jogos com vaga`} nas próximas {HORAS} h perto de você
          {primeiro?.title ? ` — o primeiro: ${primeiro.title}` : ''}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}
