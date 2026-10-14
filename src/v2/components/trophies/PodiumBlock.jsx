/**
 * O PÓDIO de uma categoria encerrada: os três degraus com as pessoas, o
 * cartão de cada degrau e do pódio inteiro, e o "Parabenizar". Montado na aba
 * de resultados (organização e atletas) e na página pública — o mesmo bloco,
 * com os mesmos dados da tabela de jogos (`useModalityPodium`).
 *
 * Só aparece com a categoria COMPLETA: pódio parcial anunciaria um campeão
 * que ainda está jogando.
 */
import React, { lazy, Suspense, useState } from 'react';
import { Medal, Share2 } from 'lucide-react';
import { useArena } from '@/modules/arenas/hooks/useArenas';
import { brandingOf } from '@/modules/arenas/domain/whiteLabel';
import { isAllowedImageUrl } from '@/core/domain/storageUrl.js';
import { useModalityPodium } from '@/modules/trophies/hooks/useTrophies';
import { CARD_MODE } from '@/modules/trophies/domain/medalCard.js';
import { V2Avatar, V2Button } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { METAL } from './MedalCard';
import CongratulateButton from './CongratulateButton';
import { t } from '@/core/i18n';

const MedalCardDialog = lazy(() => import('./MedalCardDialog'));

/** O que o cartão sabe de quem sediou: nome e logo (só do Storage do projeto). */
export function useHostOf(tournament) {
  const arena = useArena(tournament?.arena_id || null);
  if (!arena.data) return null;
  const marca = brandingOf(arena.data);
  return { name: arena.data.name || '', logo: isAllowedImageUrl(marca.logo) ? marca.logo : null, kind: 'arena' };
}

export function eventOf(tournament, modality) {
  return {
    title: tournament?.name || t('Torneio'),
    subtitle: modality?.name || '',
    date: tournament?.ends_at || tournament?.starts_at || null,
    city: tournament?.city || '', state: tournament?.state || '',
    kind: 'torneio',
  };
}

const ORDEM = [2, 1, 3];
const ALTURA = { 1: 'h-16 sm:h-20', 2: 'h-11 sm:h-14', 3: 'h-8 sm:h-10' };

export default function PodiumBlock({ tournament, modality, className }) {
  const { podium } = useModalityPodium(tournament, modality);
  const host = useHostOf(tournament);
  const [dialogo, setDialogo] = useState(null);
  if (!podium.complete || podium.places.length === 0) return null;

  const event = eventOf(tournament, modality);
  const porPosicao = new Map(podium.places.map((p) => [p.position, p]));
  const contextId = (pos) => `trofeu:${tournament.id}:${modality.id}:${pos}`;
  const uidsDe = (place) => (place?.entries || []).flatMap((e) => e.people.map((p) => p.user_id)).filter(Boolean);

  return (
    <section className={cn('rounded-3xl border border-gray-100 bg-paper-pure p-4 sm:p-5', className)} aria-label={t('Pódio de {nome}', { nome: modality.name })}>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 font-display text-base font-bold text-ink">
          <Medal className="h-5 w-5 text-ink" aria-hidden="true" /> {t('Pódio')}
        </h3>
        <V2Button size="sm" variant="primary" onClick={() => setDialogo({ mode: CARD_MODE.PODIUM, position: 1 })}>
          <Share2 className="h-4 w-4" /> {t('Cartão do pódio')}
        </V2Button>
      </header>

      <ol className="grid grid-cols-3 items-end gap-2 sm:gap-3">
        {ORDEM.map((pos) => {
          const place = porPosicao.get(pos);
          const metal = METAL[pos];
          if (!place) return <li key={pos} aria-hidden="true" />;
          const pessoas = place.entries.flatMap((e) => e.people);
          return (
            <li key={pos} className="flex min-w-0 flex-col items-center text-center" style={{ order: ORDEM.indexOf(pos) }}>
              <div className="mb-2 flex -space-x-2">
                {pessoas.slice(0, 4).map((p, i) => (
                  <V2Avatar key={p.user_id || `${p.name}-${i}`} name={p.name} photoUrl={p.photo_url} size={pos === 1 ? 'lg' : 'md'} ring />
                ))}
              </div>
              <p className="w-full truncate text-sm font-bold text-ink" title={place.entries.map((e) => e.label).join(' · ')}>
                {place.entries.map((e) => e.label).join(' · ')}
              </p>
              <p className="text-xs font-semibold text-gray-500">{place.label}</p>
              <div
                className={cn('mt-2 flex w-full items-start justify-center rounded-t-2xl pt-2 font-display text-lg font-black text-ink', ALTURA[pos])}
                style={{ background: metal.cor }}
                aria-hidden="true"
              >
                {pos}º
              </div>
              <div className="mt-2 flex w-full flex-col gap-1">
                <V2Button size="sm" variant="ghost" className="w-full" onClick={() => setDialogo({ mode: CARD_MODE.PLACE, position: pos })}>{t('Cartão')}</V2Button>
                <CongratulateButton
                  className="w-full"
                  contextId={contextId(pos)}
                  toUids={uidsDe(place)}
                  scope="tournament"
                  eventTitle={`${tournament.name} · ${modality.name}`}
                  placeLabel={place.label}
                />
              </div>
            </li>
          );
        })}
      </ol>

      {dialogo && (
        <Suspense fallback={null}>
          <MedalCardDialog
            open
            onOpenChange={(v) => { if (!v) setDialogo(null); }}
            places={podium.places}
            event={event}
            host={host}
            link={`/p/${tournament.id}`}
            initialMode={dialogo.mode}
            initialPosition={dialogo.position}
          />
        </Suspense>
      )}
    </section>
  );
}
