/**
 * O cartão de um dia de jogo com vaga — do atleta, do clube ou da arena —,
 * com o botão de entrar e sair ali mesmo (`PlayItemAction`).
 *
 * Um cartão só para o Procura-se jogo e o "Com vaga para você" do Dia de jogo:
 * "Você vai", "Do seu clube" e "3 vagas" têm de querer dizer a mesma coisa nas
 * duas telas. O título leva para DENTRO do dia de jogo (formato, quem vai).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Building2, Dices, MapPin, Users } from 'lucide-react';
import { PLAY_ORIGIN } from '@/modules/games/domain/playDiscovery';
import { V2Badge } from '@/v2/ui/primitives';
import PlayItemAction from './PlayItemAction';

/** Um dia de jogo com vaga (do atleta, do clube ou da arena), com o botão de entrar. */
export default function PlayGameDayCard({ item, distancia = null }) {
  const Icone = item.origem === PLAY_ORIGIN.CLUBE ? Users : (item.daArena ? Building2 : Dices);
  const origem = {
    [PLAY_ORIGIN.CLUBE]: { tom: 'blue', texto: 'Dia de jogo do seu clube' },
    [PLAY_ORIGIN.ARENA]: { tom: 'acid', texto: 'Dia de jogo da arena' },
    [PLAY_ORIGIN.JOGO_ABERTO]: { tom: 'acid', texto: 'Jogo aberto da arena' },
  }[item.origem] || { tom: 'blue', texto: 'Dia de jogo' };
  return (
    <div
      className={`flex h-full flex-col rounded-4xl border bg-paper-pure p-6 shadow-organic-sm transition-all hover:shadow-organic ${
        item.estou ? 'border-acid/60' : 'border-gray-100'
      }`}
    >
      <Link
        to={item.link}
        className="group flex items-start gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-acid/20 text-ink">
          <Icone className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-lg font-bold leading-tight text-ink group-hover:underline">{item.title}</span>
          <span className="mt-1 block text-sm text-gray-500">{item.subtitle}</span>
        </span>
      </Link>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <V2Badge tone={origem.tom}>
          <Icone className="h-3 w-3" aria-hidden="true" /> {origem.texto}
        </V2Badge>
        {/* "Você vai" já está ao lado do botão de sair — aqui, só as vagas. */}
        {item.badge && !item.estou && item.origem !== PLAY_ORIGIN.CLUBE && (
          <V2Badge tone="green"><Users className="h-3 w-3" aria-hidden="true" /> {item.badge}</V2Badge>
        )}
        {distancia && <V2Badge tone="neutral"><MapPin className="h-3 w-3" aria-hidden="true" /> {distancia}</V2Badge>}
      </div>
      {/* Não preenche um requisito (a faixa de nível do jogo aberto)? A tela
          diz qual — botão desabilitado sem motivo é a pior resposta. */}
      {!item.estou && item.cabe === false && item.motivo && (
        <p className="mt-3 text-xs leading-5 text-amber-700">{item.motivo}</p>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        <PlayItemAction item={item} mostrarAbrir />
      </div>
    </div>
  );
}
