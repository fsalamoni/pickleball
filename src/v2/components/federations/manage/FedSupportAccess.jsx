/**
 * O admin da PLATAFORMA entrando na Central de uma federação: antes, motivo
 * (categoria + texto) e prazo (até 8 h). O servidor (`federationAdminAccess`)
 * grava o registro interno (`admin_access_logs`) e só então abre o acesso
 * (`federation_admin_grants`) — que a regra (`fedPlat`), o servidor e esta
 * tela exigem. Enquanto vale, uma faixa diz até quando, com "Encerrar".
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ShieldAlert, TimerOff } from 'lucide-react';
import { federationAdminAccess } from '@/modules/federations/services/federationService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { FED_ADMIN_ACCESS_HOURS } from '@/modules/federations/domain/constants';
import { REVEAL_REASON_META, REVEAL_TEXT_MIN } from '@/modules/admin/domain/supportAccess';
import { V2Button, V2Field, V2Input, V2Select, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { fmtData } from '@/core/i18n/format';
import { t, tn } from '@/core/i18n';

const hora = (ms) => fmtData(new Date(ms), { hour: '2-digit', minute: '2-digit' });

export function FedSupportAccessGate({ federation }) {
  const [categoria, setCategoria] = useState('');
  const [texto, setTexto] = useState('');
  const [ticket, setTicket] = useState('');
  const [horas, setHoras] = useState(2);
  const pedir = useFederationMutation(() => federationAdminAccess(federation.id, 'grant', { reason_category: categoria, reason_text: texto.trim(), ticket_ref: ticket.trim(), hours: Number(horas) }));
  const valido = Boolean(REVEAL_REASON_META[categoria]) && texto.trim().length >= REVEAL_TEXT_MIN;
  return (
    <V2Surface className="mx-auto max-w-2xl space-y-4" data-dica="federacao-acesso-suporte">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-1 h-6 w-6 shrink-0 text-amber-600" aria-hidden="true" />
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{t('Acesso de suporte à {sigla}', { sigla: federation.acronym || federation.name })}</h2>
          <p className="text-sm text-gray-500">{t('Você não faz parte da equipe desta federação. Para entrar na Central como admin da plataforma, diga o motivo e por quanto tempo. O pedido fica no registro interno da plataforma e o acesso termina sozinho no prazo.')}</p>
        </div>
      </div>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); pedir.mutate(undefined, { onSuccess: (r) => toast.success(t('Acesso aberto até {hora}.', { hora: hora(r.expires_ms) })), onError: (er) => toast.error(er.message) }); }}>
        <V2Field label={t('Categoria do motivo')} htmlFor="fed-acesso-cat" required>
          <V2Select id="fed-acesso-cat" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">{t('Escolha…')}</option>
            {Object.entries(REVEAL_REASON_META).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
          </V2Select>
        </V2Field>
        <V2Field label={t('Motivo')} htmlFor="fed-acesso-texto" required hint={t('Mínimo {min} caracteres. Fica só no registro interno.', { min: REVEAL_TEXT_MIN })}>
          <V2Textarea id="fed-acesso-texto" rows={3} maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={t('Ex.: o presidente pediu ajuda para configurar os planos')} />
        </V2Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <V2Field label={t('Por quanto tempo')} htmlFor="fed-acesso-horas">
            <V2Select id="fed-acesso-horas" value={horas} onChange={(e) => setHoras(Number(e.target.value))}>
              {FED_ADMIN_ACCESS_HOURS.map((h) => <option key={h} value={h}>{tn(h, '{n} hora', '{n} horas', { n: h })}</option>)}
            </V2Select>
          </V2Field>
          <V2Field label={t('Referência (opcional)')} htmlFor="fed-acesso-ticket" hint={t('E-mail, print ou protocolo do pedido.')}>
            <V2Input id="fed-acesso-ticket" maxLength={200} value={ticket} onChange={(e) => setTicket(e.target.value)} />
          </V2Field>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <V2Button asChild variant="ghost"><Link to="/admin/painel?tab=federacoes">{t('Voltar')}</Link></V2Button>
          <V2Button type="submit" disabled={!valido || pedir.isPending}>{t('Abrir acesso')}</V2Button>
        </div>
      </form>
    </V2Surface>
  );
}

/** A faixa do acesso valendo; no fim do prazo a Central volta a pedir o motivo. */
export function FedSupportAccessBanner({ federationId, grant, onExpired }) {
  const encerrar = useFederationMutation(() => federationAdminAccess(federationId, 'end'));
  useEffect(() => {
    const falta = Number(grant.expires_ms) - Date.now();
    const id = setTimeout(() => onExpired?.(), Math.max(0, Math.min(falta, 2 ** 31 - 1)) + 500);
    return () => clearTimeout(id);
  }, [grant.expires_ms, onExpired]);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
      <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">{t('Acesso de suporte da plataforma até {hora}. Motivo: {motivo}', { hora: hora(grant.expires_ms), motivo: grant.reason_text || '' })}</p>
      <V2Button type="button" size="sm" variant="secondary" disabled={encerrar.isPending} onClick={() => encerrar.mutate(undefined, { onSuccess: () => toast.success(t('Acesso encerrado.')), onError: (er) => toast.error(er.message) })}>
        <TimerOff className="h-4 w-4" />{t('Encerrar acesso')}
      </V2Button>
    </div>
  );
}
