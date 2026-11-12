/**
 * O bloco "Carreira" do PERFIL PÚBLICO (PR 7, docs/54 §4.13): os torneios de
 * FORA que a pessoa escolheu mostrar (`career_public`, só o servidor grava),
 * com o selo à vista — "Declarado" quer dizer que ninguém conferiu — e as
 * PARCERIAS (as duplas com o nome publicado: confirmaram e permitiram).
 *
 * Parabenizar um pódio de fora é o kudo `positive` de sempre
 * (`CongratulateButton`, `contextId` por participação) — nenhuma conta de
 * pontos nova. O resultado declarado nunca pontua.
 *
 * Sem nada publicado o bloco não aparece; com a leitura falhando, diz que não
 * carregou (nunca "não tem carreira").
 */
import React from 'react';
import { Route, Users } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useCareerPublic } from '@/modules/career/hooks/useCareer';
import { entryLabel, placementText } from '@/modules/career/domain/careerEvent.js';
import { showcasePartnerships, showcasePodium, showcaseTrophyContextId } from '@/modules/career/domain/careerPublic.js';
import { V2Avatar, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import CongratulateButton from '@/v2/components/trophies/CongratulateButton';
import { SealBadge, careerDateLabel } from './careerUi';
import { t, tn } from '@/core/i18n';

/** @param {{ uid: string, nome?: string }} props */
export default function CareerPublicBlock({ uid, nome = '' }) {
  const { user } = useAuth();
  const q = useCareerPublic(uid);
  if (q.isPending) return <V2Surface className="mt-8"><V2Skeleton lines={3} /></V2Surface>;
  // Perfil oculto pela moderação: a regra fecha a vitrine. Não é falha de conexão, não há o que tentar de novo.
  if (q.error?.code === 'permission-denied') return null;
  if (q.isError) {
    return <V2Surface className="mt-8"><V2ErrorState inline title={t('Não carregou a carreira')} description={t('Os torneios de fora continuam lá — a conexão é que falhou.')} onRetry={() => q.refetch()} /></V2Surface>;
  }
  const itens = q.data || [];
  if (!itens.length) return null;
  const parcerias = showcasePartnerships(itens);
  const outraPessoa = user?.uid && user.uid !== uid;

  return (
    <V2Surface as="section" className="mt-8 space-y-4" aria-labelledby="carreira-publica-titulo" data-dica="carreira-publica">
      <div>
        <h2 id="carreira-publica-titulo" className="inline-flex items-center gap-2 font-display text-lg font-bold text-ink"><Route className="h-5 w-5" aria-hidden="true" /> {t('Carreira')}</h2>
        <p className="mt-1 text-xs text-gray-500">{t('Torneios de fora da plataforma que {quem} escolheu mostrar. O selo diz quem conferiu; o declarado não entra em ranking, rating nem XP.', { quem: nome || t('esta pessoa') })}</p>
      </div>

      {parcerias.length > 0 && (
        <div className="space-y-2">
          <h3 className="inline-flex items-center gap-1.5 text-sm font-bold text-ink"><Users className="h-4 w-4" aria-hidden="true" /> {t('Parcerias')}</h3>
          <ul className="flex flex-wrap gap-2">
            {parcerias.map((p) => (
              <li key={p.uid} className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-paper px-3 py-1 text-sm">
                <V2Avatar photoUrl={p.photo_url} name={p.name} size="xs" />
                <span className="font-semibold text-ink">{p.name}</span>
                <span className="text-gray-500">{tn(p.together, '{n} torneio', '{n} torneios')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="space-y-3">
        {itens.map((it) => (
          <li key={it.event_id} className="space-y-2 rounded-2xl border border-gray-100 bg-paper p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-ink">{it.name}</p>
              <span className="flex flex-wrap gap-1"><SealBadge seal={it.seal} /></span>
            </div>
            <p className="text-xs text-gray-500">
              {[careerDateLabel(it.start_date, it.date_precision), [it.city, it.state].filter(Boolean).join('/'), it.federated ? (it.federation_acronym || it.federation_name || t('Federado')) : '', it.stage_tier].filter(Boolean).join(' · ')}
            </p>
            <ul className="space-y-1">
              {(it.entries || []).map((e, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink">
                  <span>
                    {[entryLabel(e), placementText(e)].filter(Boolean).join(' · ')}
                    {e.partner ? ` · ${t('com {nome}', { nome: e.partner.name })}` : e.with_partner ? ` · ${t('com dupla')}` : ''}
                  </span>
                  {outraPessoa && showcasePodium(e) && (
                    <CongratulateButton contextId={showcaseTrophyContextId(it, i)} toUids={[uid]} scope="universal"
                      eventTitle={it.name} placeLabel={placementText(e)} />
                  )}
                </li>
              ))}
            </ul>
            {(it.photos || []).length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {it.photos.map((p) => <img key={p.path} src={p.url} alt={p.alt} loading="lazy" className="aspect-video w-full rounded-xl object-cover" />)}
              </div>
            )}
          </li>
        ))}
      </ul>
    </V2Surface>
  );
}
