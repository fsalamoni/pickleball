/**
 * V2Legal — Central de documentos legais (/legal). Lista todos os documentos
 * jurídicos por categoria, com estado de aceite. Flag legal_center.
 */

import React from 'react';
import { Navigate, Link } from 'react-router-dom';
import { CheckCircle2, ChevronRight, ScrollText, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { LEGAL_DOCUMENTS, LEGAL_CATEGORY } from '@/modules/legal/domain/legalDocuments';
import { isDocAccepted } from '@/modules/legal/domain/consent';
import { useMyConsents } from '@/modules/legal/hooks/useConsents';
import { V2Badge, V2ContentHero, V2Surface } from '@/v2/ui/primitives';
import { legalIcon } from '@/v2/components/legal/legalIcons';

const CATEGORY_ORDER = [LEGAL_CATEGORY.ESSENTIAL, LEGAL_CATEGORY.COMPLEMENTARY, LEGAL_CATEGORY.ROLE];
const CATEGORY_DESC = {
  [LEGAL_CATEGORY.ESSENTIAL]: 'Aceite obrigatório para usar a plataforma.',
  [LEGAL_CATEGORY.COMPLEMENTARY]: 'Regras e políticas que valem para todos.',
  [LEGAL_CATEGORY.ROLE]: 'Termos específicos de quem organiza torneios, tem arena ou dá aulas.',
};

function formatMs(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function V2Legal() {
  const enabled = true;
  const { user } = useAuth();
  const { consentMap } = useMyConsents();

  if (!enabled) return <Navigate to="/politica-uso" replace />;

  const pendingEssentials = LEGAL_DOCUMENTS
    .filter((d) => d.gate)
    .filter((d) => user && !isDocAccepted(consentMap, d)).length;

  return (
    <div className="mx-auto max-w-[900px]">
      <V2ContentHero
        eyebrow="Transparência"
        title="Termos, Documentos e Políticas"
        description="Todos os termos, contratos, documentos e políticas de uso da plataforma, com o registro do seu aceite. Leia com atenção — ao usar a PickleRush você concorda com os documentos essenciais."
        meta={user && pendingEssentials > 0
          ? `Você tem ${pendingEssentials} documento(s) essencial(is) pendente(s) de aceite.`
          : undefined}
      />

      {user && pendingEssentials > 0 && (
        <V2Surface className="mb-4 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800">
              Há documentos essenciais aguardando seu aceite. Abra cada um e confirme &quot;Li e concordo&quot;.
            </p>
          </div>
        </V2Surface>
      )}

      <div className="space-y-8">
        {CATEGORY_ORDER.map((cat) => {
          const docs = LEGAL_DOCUMENTS.filter((d) => d.category === cat);
          if (docs.length === 0) return null;
          return (
            <section key={cat}>
              <div className="mb-3 flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-gray-400" />
                <h2 className="font-display text-lg font-bold text-ink">{cat}</h2>
              </div>
              <p className="mb-3 text-sm text-gray-500">{CATEGORY_DESC[cat]}</p>
              <div className="space-y-2">
                {docs.map((d) => {
                  const Icon = legalIcon(d.icon);
                  const accepted = user && isDocAccepted(consentMap, d);
                  const acceptedMs = consentMap[d.key]?.accepted_at_ms;
                  return (
                    <Link
                      key={d.key}
                      to={`/legal/${d.route}`}
                      className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-paper-pure p-4 transition-all hover:shadow-organic-sm"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-ink text-acid">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink">{d.title}</span>
                          {d.gate && <V2Badge tone="neutral">Essencial</V2Badge>}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-gray-500">{d.description}</p>
                      </div>
                      {user && (
                        accepted
                          ? <V2Badge tone="green"><CheckCircle2 className="mr-1 h-3 w-3" /> {acceptedMs ? formatMs(acceptedMs) : 'Aceito'}</V2Badge>
                          : <V2Badge tone={d.gate ? 'amber' : 'neutral'}>Pendente</V2Badge>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
