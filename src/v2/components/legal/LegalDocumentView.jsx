import React, { useState } from 'react';
import { Languages } from 'lucide-react';
import { V2BulletList, V2ContentHero, V2ContentSection } from '@/v2/ui/primitives';
import { PLATFORM_NAME } from '@/modules/legal/domain/legalDocuments';
import { legalDocTranslation } from '@/modules/legal/domain/legalTranslation';
import { useLegalTranslations } from '@/modules/legal/hooks/useLegalTranslations';
import { legalIcon } from './legalIcons';
import { t, fmtData } from '@/core/i18n';

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return fmtData(new Date(y, m - 1, d), { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Renderiza um documento legal (dado puro do registro) no mesmo padrão de
 * design das páginas de conteúdo. `status` (opcional) vai no topo; `action`
 * (opcional, o botão de aceite) vai no FIM, depois do texto — nada depois dele.
 * Em en/es mostra a tradução de cortesia, com o aviso de que o português
 * prevalece e o botão para ver o original. O aceite (feito pela página) segue
 * sempre sobre o documento em português: mesma `key`, mesma `version`.
 */
export default function LegalDocumentView({ doc, status, action }) {
  const traduzido = legalDocTranslation(doc, useLegalTranslations(!!doc));
  const [original, setOriginal] = useState(false);
  if (!doc) return null;
  const visto = traduzido && !original ? traduzido : doc;
  const meta = `${PLATFORM_NAME} · ${t('Versão {versao} — vigente desde {data}.', { versao: doc.version, data: formatDate(doc.effectiveDate) })}`;

  return (
    <div>
      {traduzido && (
        <div className="mb-4 flex flex-wrap items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <Languages className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1">
            {t('Esta é uma tradução de cortesia. Em caso de divergência, prevalece a versão em português.')}
          </p>
          <button
            type="button"
            onClick={() => setOriginal((v) => !v)}
            aria-pressed={original}
            className="font-semibold text-ink underline"
          >
            {original ? t('Ver tradução') : t('Ver original em português')}
          </button>
        </div>
      )}
      <V2ContentHero
        eyebrow={visto.eyebrow}
        title={visto.title}
        description={visto.description}
        meta={meta}
        action={status}
      />
      <div className="space-y-4" lang={traduzido && original ? 'pt-BR' : undefined}>
        {visto.sections.map((s, i) => (
          <V2ContentSection key={i} icon={legalIcon(s.icon)} title={s.title} description={s.description}>
            {(s.paragraphs || []).map((p, j) => (
              <p key={j}>{p}</p>
            ))}
            {s.bullets && s.bullets.length > 0 && <V2BulletList items={s.bullets} />}
          </V2ContentSection>
        ))}
      </div>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
