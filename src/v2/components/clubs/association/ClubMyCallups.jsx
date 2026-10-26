/**
 * MINHAS CONVOCAÇÕES neste clube (Bloco E3): os convites da seleção do clube para a pessoa — aceitar
 * ou recusar dentro do prazo (e escolher o tamanho do uniforme quando a convocação pede). Só aparece
 * a quem foi convocado; fonte que falha vira "Tentar de novo", nunca "nenhuma convocação".
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { CalendarDays, MapPin, Trophy } from 'lucide-react';
import { useClubSelectionAction, useMyCallups } from '@/modules/clubs/hooks/useClubSelection';
import { CALLUP_ROLE_LABELS, MEMBER_STATUS, MEMBER_STATUS_LABELS, TRAVEL_DOC_LABELS, UNIFORM_SIZES } from '@/modules/clubs/domain/selection';
import { isoDateBR } from '@/modules/federations/domain/referees';
import { dataCurta } from '@/v2/components/federations/referees/refUi';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Select, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

const TOM = { invited: 'amber', accepted: 'green', declined: 'red', expired: 'neutral', cancelled: 'neutral' };
const prazo = (ms) => dataCurta(isoDateBR(ms));

function Convite({ clubId, c }) {
  const [tamanho, setTamanho] = useState('');
  const m = useClubSelectionAction(clubId);
  const responder = (accept) => m.mutate({ action: 'answer', memberId: c.id, accept, ...(accept && c.collect_uniform ? { uniform_size: tamanho } : {}) }, {
    onSuccess: () => toast.success(accept ? t('Convocação aceita. Boa competição!') : t('Convocação recusada.')),
    onError: (er) => toast.error(er.message),
  });
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <div className="space-y-1">
          <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
            {c.title}
            <V2Badge tone={TOM[c.status]}>{t(MEMBER_STATUS_LABELS[c.status] || c.status)}</V2Badge>
          </p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
            <span className="inline-flex items-center gap-1"><Trophy className="h-4 w-4" aria-hidden="true" />{c.event_name}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" aria-hidden="true" />{dataCurta(c.starts_at)}{c.ends_at && c.ends_at !== c.starts_at ? ` – ${dataCurta(c.ends_at)}` : ''}</span>
            {c.place && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden="true" />{c.place}</span>}
          </p>
          <p className="text-xs text-gray-500">{t(CALLUP_ROLE_LABELS[c.role] || c.role)}{c.label ? ` · ${c.label}` : ''}</p>
          {c.message && <p className="whitespace-pre-wrap rounded-2xl bg-gray-50 p-3 text-sm text-gray-700">{c.message}</p>}
          {c.travel_docs.length > 0 && <p className="text-xs text-gray-500">{t('Leve: {docs}.', { docs: c.travel_docs.map((d) => t(TRAVEL_DOC_LABELS[d] || d)).join(', ') })}</p>}
        </div>
        {c.open && (
          <div className="space-y-3 border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500">{t('Responda até {data}.', { data: prazo(c.expires_at_ms) })}</p>
            {c.collect_uniform && (
              <V2Field label={t('Tamanho do uniforme')} htmlFor={`cs-tam-${c.id}`}>
                <V2Select id={`cs-tam-${c.id}`} value={tamanho} onChange={(e) => setTamanho(e.target.value)}>
                  <option value="">{t('Escolha')}</option>
                  {UNIFORM_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                </V2Select>
              </V2Field>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => responder(false)}>{t('Recusar')}</V2Button>
              <V2Button type="button" size="sm" disabled={m.isPending || (c.collect_uniform && !tamanho)} onClick={() => responder(true)} data-dica="clube-selecao-aceitar">{t('Aceitar convocação')}</V2Button>
            </div>
          </div>
        )}
        {c.status === MEMBER_STATUS.ACCEPTED && c.collect_uniform && c.uniform_size && <p className="text-xs text-gray-500">{t('Uniforme {tam}', { tam: c.uniform_size })}</p>}
      </V2Surface>
    </li>
  );
}

export default function ClubMyCallups({ clubId }) {
  const q = useMyCallups(clubId);
  if (q.isError) return <V2ErrorState inline title={t('As suas convocações não carregaram')} onRetry={() => q.refetch()} />;
  if (q.isLoading) return <V2Skeleton lines={2} />;
  const rows = q.data?.rows || [];
  if (!rows.length) return null;
  return (
    <section className="space-y-3" aria-label={t('Minhas convocações')} data-dica="clube-minhas-convocacoes">
      <h3 className="font-display text-lg font-bold text-ink">{t('Minhas convocações')}</h3>
      <ul className="space-y-3">{rows.map((c) => <Convite key={c.id} clubId={clubId} c={c} />)}</ul>
    </section>
  );
}
