/**
 * As sanções da própria pessoa neste clube (advertência, suspensão, multa, exclusão da
 * filiação) e o recurso — um só. Só ela e a diretoria veem; a regra confere (`cases`, dono).
 * Fonte que falha vira "Tentar de novo", nunca "você não tem sanção".
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Gavel } from 'lucide-react';
import { useClubDisciplineAction, useMyClubCases } from '@/modules/clubs/hooks/useClubDiscipline';
import { DISCIPLINE_KIND, DISCIPLINE_KIND_LABELS, DISCIPLINE_STATUS_LABELS } from '@/modules/federations/domain/constants';
import { canAppeal, sanctionInForce, sortSanctions } from '@/modules/federations/domain/discipline';
import { formatBrlCents } from '@/modules/federations/domain/charges';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { quando } from '@/v2/components/federations/federationUi';
import { t } from '@/core/i18n';

function Recurso({ clubId, s }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const m = useClubDisciplineAction(clubId);
  if (!aberto) return <V2Button type="button" size="sm" variant="secondary" onClick={() => setAberto(true)} data-dica="clube-recorrer">{t('Recorrer')}</V2Button>;
  const enviar = (e) => {
    e.preventDefault();
    if (texto.trim().length < 20) { toast.error(t('Escreva o recurso (mínimo 20 caracteres).')); return; }
    m.mutate({ action: 'appeal', sanctionId: s.id, text: texto }, {
      onSuccess: () => { toast.success(t('Recurso enviado. A diretoria do clube decide e avisa pelo sino.')); setAberto(false); },
      onError: (er) => toast.error(er.message),
    });
  };
  return (
    <form className="w-full space-y-2" onSubmit={enviar}>
      <V2Field label={t('Seu recurso (uma vez só)')} htmlFor={`rec-${s.id}`}>
        <V2Textarea id={`rec-${s.id}`} rows={3} maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)} autoFocus />
      </V2Field>
      <div className="flex justify-end gap-2">
        <V2Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>{t('Voltar')}</V2Button>
        <V2Button type="submit" size="sm" disabled={m.isPending}>{t('Enviar recurso')}</V2Button>
      </div>
    </form>
  );
}

export default function ClubMySanctions({ clubId }) {
  const q = useMyClubCases(clubId);
  if (q.isError) return <V2ErrorState inline title={t('Não carregaram as suas sanções')} onRetry={() => q.refetch()} />;
  if (!q.isSuccess) return null;
  const lista = sortSanctions(q.data || []);
  if (!lista.length) return null;
  return (
    <V2Surface variant="compacto" className="space-y-3 p-4" data-dica="clube-minhas-sancoes">
      <p className="flex items-center gap-2 font-bold text-ink"><Gavel className="h-4 w-4" aria-hidden="true" />{t('Sanções disciplinares')}</p>
      <ul className="space-y-3">
        {lista.map((s) => (
          <li key={s.id} className="space-y-2 text-sm">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink">{t(DISCIPLINE_KIND_LABELS[s.kind] || s.kind)}</span>
              <V2Badge tone={sanctionInForce(s) ? 'red' : 'neutral'}>{t(DISCIPLINE_STATUS_LABELS[s.status] || s.status)}</V2Badge>
            </p>
            <p className="text-gray-700">{s.reason}</p>
            <p className="text-xs text-gray-500">
              {quando(s.created_at_ms)}
              {s.kind === DISCIPLINE_KIND.SUSPENSION ? ` · ${t('até {data}', { data: quando(s.ends_at) })}` : ''}
              {s.kind === DISCIPLINE_KIND.FINE ? ` · ${formatBrlCents(s.fine_cents)} · ${t('a cobrança está acima, na sua associação')}` : ''}
            </p>
            {s.appeal_decision?.note && <p className="text-xs text-gray-600">{t('Decisão: {nota}', { nota: s.appeal_decision.note })}</p>}
            {canAppeal(s) && <Recurso clubId={clubId} s={s} />}
          </li>
        ))}
      </ul>
      <p className="text-xs text-gray-500">{t('Só você e a diretoria do clube veem isto.')}</p>
    </V2Surface>
  );
}
