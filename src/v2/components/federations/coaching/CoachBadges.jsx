/**
 * O SELO DE PROFESSOR CREDENCIADO (Bloco 4): no perfil do professor
 * ("Professor credenciado pela FGP · Nível 2") e a lista pública de
 * professores credenciados na página da federação. Ambos leem
 * `federation_coach_badges` (público), que só o servidor grava e que só
 * carrega licença válida, de federação publicada, que o professor deixou
 * aparecer. A tela ainda filtra pela data (o servidor tira o vencido de noite).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck } from 'lucide-react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useCoachBadges, useCredentialedCoaches } from '@/modules/federations/hooks/useCoaching';
import { visibleBadges } from '@/modules/federations/domain/coachLicenses';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { isoDateBR } from '@/modules/federations/domain/referees';
import { V2Avatar, V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { dataCurta } from '../referees/refUi';

/** Os selos no perfil do professor (nada quando não há, nem enquanto carrega). */
export function CoachFederationBadges({ uid }) {
  const on = useFeatureFlag(FEATURE_FLAG.FEDERATIONS);
  const q = useCoachBadges(uid, { enabled: on });
  const selos = on && q.isSuccess ? visibleBadges(q.data, isoDateBR()) : [];
  if (!selos.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2" aria-label={t('Licenças de federação')} data-dica="professor-selo-federacao">
      {selos.map((b) => (
        <li key={b.federation_id}>
          <Link to={b.slug ? `/f/${b.slug}?aba=cursos` : `/federacoes/${b.federation_id}`} className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800 hover:bg-violet-100">
            <BadgeCheck className="h-4 w-4" aria-hidden="true" />
            {t('Professor credenciado pela {sigla}', { sigla: b.acronym })}{b.level_label ? ` · ${b.level_label}` : ''}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Os professores credenciados, na aba Cursos da página da federação. */
export function FedCredentialedCoaches({ federation }) {
  const ligado = fedModuleOn(federation, 'coach_licenses');
  const q = useCredentialedCoaches(federation?.id, { enabled: ligado });
  if (!ligado) return null;
  const hoje = isoDateBR();
  const lista = q.isSuccess
    ? (q.data || []).map((d) => ({ ...d, selo: visibleBadges(d, hoje).find((b) => b.federation_id === federation.id) })).filter((d) => d.selo)
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'))
    : null;
  if (q.isSuccess && !lista.length) return null;
  return (
    <section aria-labelledby="fed-professores" className="space-y-3" data-dica="federacao-professores-credenciados">
      <h2 id="fed-professores" className="font-display text-xl font-bold text-ink">{t('Professores credenciados')}</h2>
      {q.isError && <V2ErrorState inline title={t('Não carregaram os professores credenciados')} onRetry={() => q.refetch()} />}
      {q.isLoading && <V2Skeleton lines={2} />}
      {lista && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {lista.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-paper-pure p-3">
              <V2Avatar name={d.name} photoUrl={d.photo_url} size="sm" />
              <div className="min-w-0 flex-1">
                <Link to={`/coaches/${d.user_id || d.id}`} className="block truncate font-semibold text-ink hover:underline">{d.name}</Link>
                <p className="text-xs text-gray-500">{d.selo.level_label}{d.selo.valid_until ? ` · ${t('licença até {data}', { data: dataCurta(d.selo.valid_until) })}` : ''}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
