/**
 * Seleção e editais na Minha área → Federações (Bloco 3): as convocações da
 * pessoa (aceitar ou recusar no prazo, o tamanho do uniforme, os documentos
 * de viagem que a comissão já conferiu) e as inscrições em editais
 * (situação, motivo da decisão, recurso no prazo, desistência, pagamento).
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  APPEAL_STATUS, APPLICATION_STATUS, APPLICATION_STATUS_LABELS, CALLUP_MEMBER_STATUS, GRANT_STATUS, TRAVEL_DOC_LABELS, UNIFORM_SIZES,
  callupDocsState, callupInviteOpen, canAppeal,
} from '@/modules/federations/domain/selection';
import { FINAL_INVITE_STATUS_LABELS } from '@/modules/federations/domain/competitions';
import { isoDate } from '@/modules/federations/domain/membership';
import { useCallup, useGrant, useSelectionAction } from '@/modules/federations/hooks/useSelection';
import { V2Badge, V2Button, V2Field, V2Select, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { quando } from '../federationUi';
import { reais } from '../accounts/accountsUi';
import { GrantFileButton, TOM_CONVITE, TOM_INSCRICAO, categoriaDoConvite, periodoDoEvento } from './selectionUi';

const tamanhos = () => [{ value: '', label: t('Escolha') }, ...UNIFORM_SIZES.map((s) => ({ value: s, label: s }))];
const fedLink = (fedId, ancora) => `/federacoes/${fedId}?aba=competicoes&ancora=${ancora}`;

function Convocado({ inv }) {
  const cq = useCallup(inv.callup_id);
  const cu = cq.data;
  const [tamanho, setTamanho] = useState(inv.uniform_size || '');
  const [recusando, setRecusando] = useState(false);
  const m = useSelectionAction(inv.federation_id);
  const aberto = callupInviteOpen(inv);
  const docs = cu ? callupDocsState(cu, inv) : null;
  const pedeUniforme = cu?.collect_uniform === true;
  const ok = (msg) => ({ onSuccess: () => toast.success(msg), onError: (e) => toast.error(e.message) });
  return (
    <li className="space-y-2 rounded-2xl border border-gray-100 p-3 text-sm">
      <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
        <Link to={fedLink(inv.federation_id, 'fed-selecao')} className="hover:underline">{inv.callup_title}</Link>
        <V2Badge tone={aberto ? 'amber' : TOM_CONVITE[inv.status] || 'neutral'}>{t(FINAL_INVITE_STATUS_LABELS[inv.status] || inv.status)}</V2Badge>
      </p>
      <p className="text-xs text-gray-500">{[inv.federation_acronym, inv.event_name, categoriaDoConvite(inv), cu ? periodoDoEvento(cu) : ''].filter(Boolean).join(' · ')}</p>
      {inv.substitute && <p className="text-xs text-gray-600">{t('Você foi chamado como suplente: uma vaga abriu.')}</p>}
      {aberto && (
        <>
          <p className="text-xs text-gray-600">{t('Responda até {data}. Sem resposta, a vaga vai para o próximo do ranking.', { data: quando(inv.expires_at_ms) })}</p>
          {pedeUniforme && (
            <V2Field label={t('Tamanho do uniforme')} htmlFor={`uniforme-${inv.id}`}>
              <V2Select id={`uniforme-${inv.id}`} value={tamanho} onChange={(e) => setTamanho(e.target.value)} options={tamanhos()} />
            </V2Field>
          )}
          <div className="flex flex-wrap gap-2">
            <V2Button type="button" size="sm" disabled={m.isPending || (pedeUniforme && !tamanho)} onClick={() => m.mutate({ action: 'callup_answer', memberId: inv.id, accept: true, uniform_size: tamanho }, ok(t('Convocação confirmada.')))}>{t('Aceitar convocação')}</V2Button>
            <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => setRecusando(true)}>{t('Recusar')}</V2Button>
          </div>
        </>
      )}
      {inv.status === CALLUP_MEMBER_STATUS.ACCEPTED && (
        <div className="space-y-2">
          {pedeUniforme && (
            <div className="flex flex-wrap items-end gap-2">
              <V2Field label={t('Tamanho do uniforme')} htmlFor={`uniforme-${inv.id}`}>
                <V2Select id={`uniforme-${inv.id}`} value={tamanho} onChange={(e) => setTamanho(e.target.value)} options={tamanhos()} />
              </V2Field>
              {tamanho && tamanho !== inv.uniform_size && <V2Button type="button" size="sm" disabled={m.isPending} onClick={() => m.mutate({ action: 'callup_member_update', memberId: inv.id, uniform_size: tamanho }, ok(t('Tamanho salvo.')))}>{t('Salvar tamanho')}</V2Button>}
            </div>
          )}
          {docs && docs.required.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('Documentos de viagem')}</p>
              <ul className="text-xs">
                {docs.required.map((k) => <li key={k} className={docs.ok.includes(k) ? 'text-green-700' : 'text-amber-800'}>{docs.ok.includes(k) ? '✓ ' : '• '}{t(TRAVEL_DOC_LABELS[k])}{docs.ok.includes(k) ? '' : ` (${t('falta entregar à comissão')})`}</li>)}
              </ul>
            </div>
          )}
          {cu?.notes && <p className="whitespace-pre-line text-xs text-gray-600">{cu.notes}</p>}
        </div>
      )}
      {inv.status === CALLUP_MEMBER_STATUS.CANCELLED && inv.cancel_reason && <p className="text-xs text-gray-600">{t('Motivo: {motivo}', { motivo: inv.cancel_reason })}</p>}
      <ConfirmDialog
        open={recusando}
        onOpenChange={setRecusando}
        destructive
        loading={m.isPending}
        title={t('Recusar a convocação?')}
        description={t('A vaga vai para o próximo do ranking e não volta para você.')}
        confirmLabel={t('Recusar convocação')}
        cancelLabel={t('Voltar')}
        onConfirm={() => m.mutate({ action: 'callup_answer', memberId: inv.id, accept: false }, { onSuccess: () => { setRecusando(false); toast.success(t('Convocação recusada.')); }, onError: (e) => toast.error(e.message) })}
      />
    </li>
  );
}

export function MyCallupInvites({ invites }) {
  return <ul className="space-y-2">{invites.map((inv) => <Convocado key={inv.id} inv={inv} />)}</ul>;
}

function Inscricao({ app }) {
  const gq = useGrant(app.grant_id);
  const g = gq.data;
  const [recorrendo, setRecorrendo] = useState(false);
  const [texto, setTexto] = useState('');
  const m = useSelectionAction(app.federation_id);
  const hoje = isoDate();
  const podeRecorrer = g && canAppeal(app, g, hoje);
  const podeDesistir = app.status === APPLICATION_STATUS.SUBMITTED && g?.status === GRANT_STATUS.OPEN;
  const recurso = app.appeal;
  // Durante a análise a decisão ainda pode mudar: a pessoa vê "enviada" até o resultado sair.
  const status = g?.status === GRANT_STATUS.REVIEW && app.status !== APPLICATION_STATUS.WITHDRAWN ? APPLICATION_STATUS.SUBMITTED : app.status;
  return (
    <li className="space-y-2 rounded-2xl border border-gray-100 p-3 text-sm">
      <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
        <Link to={fedLink(app.federation_id, 'fed-editais')} className="hover:underline">{app.grant_title}</Link>
        <V2Badge tone={TOM_INSCRICAO[status] || 'neutral'}>{t(APPLICATION_STATUS_LABELS[status] || status)}</V2Badge>
      </p>
      {g?.status === GRANT_STATUS.REVIEW && status === APPLICATION_STATUS.SUBMITTED && <p className="text-xs text-gray-600">{t('As inscrições fecharam e a equipe está analisando.')}</p>}
      {g?.status === GRANT_STATUS.CANCELLED && <p className="text-xs text-gray-600">{t('O edital foi cancelado.')}</p>}
      {app.decision?.reason && [GRANT_STATUS.RESULT, GRANT_STATUS.FINAL].includes(g?.status) && <p className="text-xs text-gray-600">{t('Motivo: {motivo}', { motivo: app.decision.reason })}</p>}
      {app.payment && <p className="text-xs text-green-700">{t('Pago {valor} em {data}.', { valor: reais(app.payment.amount_cents), data: String(app.payment.paid_at || '').split('-').reverse().join('/') })}</p>}
      {recurso && (
        <p className="text-xs text-gray-600">
          {recurso.status === APPEAL_STATUS.PENDING ? t('Recurso enviado, esperando o julgamento.') : recurso.status === APPEAL_STATUS.ACCEPTED ? t('Recurso aceito.') : t('Recurso negado: {motivo}', { motivo: recurso.reason || '' })}
        </p>
      )}
      <div className="flex flex-wrap gap-1">{Object.entries(app.files || {}).map(([k, f]) => <GrantFileButton key={k} applicationId={app.id} fileKey={k} file={f} />)}</div>
      <div className="flex flex-wrap gap-2">
        {podeRecorrer && <V2Button type="button" size="sm" variant="secondary" onClick={() => setRecorrendo(true)}>{t('Entrar com recurso até {data}', { data: String(g.appeal_until).split('-').reverse().join('/') })}</V2Button>}
        {podeDesistir && <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => m.mutate({ action: 'grant_withdraw', applicationId: app.id }, { onSuccess: () => toast.success(t('Inscrição retirada.')), onError: (e) => toast.error(e.message) })}>{t('Desistir da inscrição')}</V2Button>}
      </div>
      <ConfirmDialog
        open={recorrendo}
        onOpenChange={setRecorrendo}
        loading={m.isPending}
        confirmDisabled={texto.trim().length < 10}
        title={t('Recurso: {titulo}', { titulo: app.grant_title })}
        description={t('Explique por que a decisão deve mudar. A equipe julga e você recebe a resposta aqui.')}
        confirmLabel={t('Enviar recurso')}
        cancelLabel={t('Voltar')}
        onConfirm={() => m.mutate({ action: 'grant_appeal', applicationId: app.id, text: texto }, { onSuccess: () => { setRecorrendo(false); toast.success(t('Recurso enviado.')); }, onError: (e) => toast.error(e.message) })}
      >
        <V2Field label={t('Recurso')} htmlFor={`recurso-${app.id}`} hint={t('Mínimo 10 caracteres.')}>
          <V2Textarea id={`recurso-${app.id}`} rows={4} maxLength={2000} value={texto} onChange={(e) => setTexto(e.target.value)} />
        </V2Field>
      </ConfirmDialog>
    </li>
  );
}

export function MyGrantApplications({ applications }) {
  return <ul className="space-y-2">{applications.map((a) => <Inscricao key={a.id} app={a} />)}</ul>;
}
