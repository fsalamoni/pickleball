import React, { useMemo } from 'react';
import { ExternalLink, Handshake } from 'lucide-react';
import { useAffiliateLinks } from '@/modules/partners/hooks/useAffiliates';
import {
  V2Badge,
  V2EmptyState,
  V2PageIntro,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';

export default function V2Partners() {
  const { data: links = [], isLoading } = useAffiliateLinks();
  const active = useMemo(() => links.filter((l) => l.active !== false), [links]);

  return (
    <div className="mx-auto max-w-[1100px]">
      <V2PageIntro title="Parceiros" subtitle="Marcas, lojas e serviços conectados ao crescimento do jogo." />

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <V2Skeleton key={i} className="h-56 rounded-4xl" />)}
        </div>
      ) : active.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={Handshake}
            title="Ainda não há parceiros"
            description="Assim que novas marcas e serviços parceiros forem publicados, eles aparecerão aqui."
          />
        </V2Surface>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-full flex-col overflow-hidden rounded-4xl border border-gray-100 bg-paper-pure shadow-organic-sm transition-all hover:shadow-organic"
            >
              <div className="h-32 overflow-hidden bg-paper">
                {link.image_url ? (
                  <img src={link.image_url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-ink/20"><Handshake className="h-10 w-10" /></div>
                )}
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h3 className="font-display text-lg font-bold text-ink">{link.title}</h3>
                {link.description && <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-500">{link.description}</p>}
                <div className="mt-auto pt-5">
                  <V2Badge tone="acid"><ExternalLink className="h-3 w-3" /> Visitar parceiro</V2Badge>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
