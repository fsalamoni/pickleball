/**
 * PICKLEBALL ADAPTADO na página pública (aba Competições): as categorias que
 * a federação classifica e como pedir. Só o que está no documento da
 * federação — nenhuma classificação de atleta é pública.
 */
import React from 'react';
import { Accessibility } from 'lucide-react';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { adaptedClassesOf } from '@/modules/federations/domain/adapted';
import { t } from '@/core/i18n';

export default function AdaptedPublic({ federation }) {
  if (!fedModuleOn(federation, 'adapted')) return null;
  const classes = adaptedClassesOf(federation);
  return (
    <section id="fed-adaptado" aria-labelledby="fed-adaptado-titulo" className="scroll-mt-4 space-y-3" data-dica="federacao-pub-adaptado">
      <h2 id="fed-adaptado-titulo" className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Accessibility className="h-5 w-5" aria-hidden />{t('Pickleball adaptado')}</h2>
      <p className="text-sm text-gray-600">{t('Os torneios chancelados podem ter modalidades adaptadas. Para jogá-las, o filiado pede a classificação na aba "Minha filiação", com o laudo; a comissão de competições confere e o laudo fica privado.')}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {classes.map((c) => (
          <li key={c.id} className="rounded-2xl border border-gray-100 bg-paper p-3">
            <div className="font-semibold text-ink">{t(c.label)}</div>
            {c.description && <p className="mt-0.5 text-xs text-gray-500">{t(c.description)}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
