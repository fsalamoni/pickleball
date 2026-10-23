/**
 * Os EMBAIXADORES na visão geral da página da federação (módulo
 * `ambassadors`): nome, foto e região, lidos de `federations.ambassadors_public`
 * — a lista que o servidor grava sem uid nem contato. Sem nenhum, a seção some.
 */
import React from 'react';
import { MapPin, User } from 'lucide-react';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { t } from '@/core/i18n';

export default function AmbassadorsPublic({ federation }) {
  const lista = (Array.isArray(federation?.ambassadors_public) ? federation.ambassadors_public : []).filter((a) => a && a.name);
  if (!fedModuleOn(federation, 'ambassadors') || !lista.length) return null;
  return (
    <section aria-labelledby="fed-embaixadores" className="space-y-3" data-dica="federacao-pub-embaixadores">
      <div>
        <h2 id="fed-embaixadores" className="font-display text-xl font-bold text-ink">{t('Embaixadores')}</h2>
        <p className="text-sm text-gray-500">{t('Filiados que representam a federação na região deles.')}</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {lista.map((a) => (
          <li key={a.key || a.name} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3">
            {a.photo_url ? <img src={a.photo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" loading="lazy" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper text-gray-500"><User className="h-5 w-5" aria-hidden="true" /></span>}
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">{a.name}</span>
              <span className="flex items-center gap-1 truncate text-xs text-gray-500"><MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />{a.region}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
