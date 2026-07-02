import React from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Newspaper, Trophy } from 'lucide-react';
import { useFeed } from '@/modules/social/hooks/useFeed';
import {
  V2Badge,
  V2EmptyState,
  V2PageIntro,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';

function itemIcon(type) {
  if (type === 'open_game') return Megaphone;
  return Trophy;
}

function itemTone(type) {
  if (type === 'open_game') return 'acid';
  return 'blue';
}

export default function V2Community() {
  const { data: items = [], isLoading } = useFeed();

  return (
    <div className="mx-auto max-w-[900px]">
      <V2PageIntro title="Comunidade" subtitle="Movimentos recentes de torneios e convites de jogo na plataforma." />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <V2Skeleton key={i} className="h-24 rounded-3xl" />)}
        </div>
      ) : items.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={Newspaper}
            title="Nenhuma atividade recente"
            description="Assim que novos torneios e convites forem publicados, eles aparecerão aqui em ordem de relevância."
          />
        </V2Surface>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const Icon = itemIcon(item.type);
            return (
              <Link
                key={item.id}
                to={item.link || '/v2'}
                className="group flex items-center gap-4 rounded-3xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm transition-all hover:shadow-organic"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-paper text-ink transition-colors group-hover:bg-acid">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <V2Badge tone={itemTone(item.type)}>{item.type === 'open_game' ? 'Convite' : 'Torneio'}</V2Badge>
                  </div>
                  <p className="mt-1.5 truncate font-bold text-ink">{item.title}</p>
                  {item.subtitle && <p className="truncate text-sm text-gray-500">{item.subtitle}</p>}
                </div>
                <span className="shrink-0 text-gray-300 transition-transform group-hover:translate-x-1">→</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
