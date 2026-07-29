import React from 'react';
import { V2BulletList, V2ContentHero, V2ContentSection } from '@/v2/ui/primitives';
import { PLATFORM_NAME } from '@/modules/legal/domain/legalDocuments';
import { legalIcon } from './legalIcons';

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/**
 * Renderiza um documento legal (dado puro do registro) no mesmo padrão de
 * design das páginas de conteúdo. `action` é opcional (ex.: botão de aceite).
 */
export default function LegalDocumentView({ doc, action }) {
  if (!doc) return null;
  const meta = `${PLATFORM_NAME} · Versão ${doc.version} — vigente desde ${formatDate(doc.effectiveDate)}.`;

  return (
    <div className="mx-auto max-w-[900px]">
      <V2ContentHero
        eyebrow={doc.eyebrow}
        title={doc.title}
        description={doc.description}
        meta={meta}
        action={action}
      />
      <div className="space-y-4">
        {doc.sections.map((s, i) => (
          <V2ContentSection key={i} icon={legalIcon(s.icon)} title={s.title} description={s.description}>
            {(s.paragraphs || []).map((p, j) => (
              <p key={j}>{p}</p>
            ))}
            {s.bullets && s.bullets.length > 0 && <V2BulletList items={s.bullets} />}
          </V2ContentSection>
        ))}
      </div>
    </div>
  );
}
