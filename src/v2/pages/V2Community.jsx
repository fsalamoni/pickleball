import React from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, Newspaper, Trophy } from 'lucide-react';
import { useFeed } from '@/modules/social/hooks/useFeed';
import {
  V2Badge,
  V2EmptyState,
  V2ErrorState,
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

function feedTarget(item) {
  if (item.type === 'open_game') return '/procura-jogo';
  const id = String(item.id || '').replace(/^t_/, '');
  return id ? `/torneios/${id}` : (item.link || '/');
}

const SEM_ITENS = [];

export default function V2Community() {
  const { data, isLoading, isError, refetch } = useFeed();
  const items = data?.items ?? SEM_ITENS;
  // Uma das fontes falhou: o que veio aparece, mas o vazio não pode ser afirmado.
  const incompleto = Boolean(data?.incompleto);

  return (
    <div className="mx-auto max-w-[900px]">
      <V2PageIntro title="Comunidade" subtitle="Movimentos recentes de torneios e convites de jogo na plataforma." />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <V2Skeleton key={i} className="h-24 rounded-3xl" />)}
        </div>
      ) : isError || (incompleto && items.length === 0) ? (
        <V2Surface>
          <V2ErrorState
            title="Não foi possível carregar a comunidade"
            description="As novidades continuam lá — só não conseguimos buscá-las agora."
            onRetry={() => refetch()}
          />
        </V2Surface>
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
          {incompleto && (
            <V2ErrorState
              inline
              title="Parte das novidades não carregou"
              description="Mostramos o que chegou — tente de novo para ver o resto."
              onRetry={() => refetch()}
            />
          )}
          {items.map((item) => {
            const Icon = itemIcon(item.type);
            return (
              <Link
                key={item.id}
                to={feedTarget(item)}
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
