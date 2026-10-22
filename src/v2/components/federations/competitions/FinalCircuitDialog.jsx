/**
 * FINAL DO CIRCUITO (Bloco 2, Central → Competições → Chancelas): a equipe de
 * competições convida os melhores do ranking oficial do ano, categoria a
 * categoria, para um torneio chancelado (o Masters). Cada convidado responde
 * no prazo; quem recusa, não responde ou é cancelado dá a vaga ao próximo do
 * ranking — sozinho, pelo servidor (`federationCompetition`). A escolha de
 * quem é chamado é `finalInvitesToSend` (com cópia no servidor).
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Medal, XCircle } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { FINAL_ACCEPT_DAYS, FINAL_INVITE_STATUS, FINAL_INVITE_STATUS_LABELS, finalCategorySummary, finalInvitesToSend } from '@/modules/federations/domain/competitions';
import { competitionAction } from '@/modules/federations/services/competitionsService';
import { useFederationMutation, useFederationRanking } from '@/modules/federations/hooks/useFederations';
import { useFinalInvites } from '@/modules/federations/hooks/useCompetitions';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { classeLabel } from '../FedPublicBlocks';
import { quando } from '../federationUi';

const TOM = { invited: 'amber', accepted: 'green', declined: 'neutral', expired: 'neutral', cancelled: 'red' };

function CancelarConvite({ invite, federationId, onClose }) {
  const [motivo, setMotivo] = useState('');
  const m = useFederationMutation(() => competitionAction(federationId, 'final_cancel', { inviteId: invite.id, reason: motivo }));
  return (
    <ConfirmDialog
      open
      destructive
      onOpenChange={(o) => { if (!o) onClose(); }}
      loading={m.isPending}
      confirmDisabled={motivo.trim().length < 3}
      title={t('Cancelar o convite de {nome}?', { nome: invite.user_name })}
      description={t('A pessoa recebe um aviso com o motivo, e a vaga vai para o próximo do ranking.')}
      confirmLabel={t('Cancelar convite')}
      cancelLabel={t('Voltar')}
      onConfirm={() => m.mutate(undefined, { onSuccess: () => { toast.success(t('Convite cancelado.')); onClose(); }, onError: (e) => toast.error(e.message) })}
    >
      <V2Field label={t('Motivo')} htmlFor="final-cancel-motivo" hint={t('A pessoa lê este texto. Mínimo 3 caracteres.')}>
        <V2Input id="final-cancel-motivo" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
      </V2Field>
    </ConfirmDialog>
  );
}

export default function FinalCircuitDialog({ tournament, federation, report, onClose }) {
  const anoTorneio = Number(String(tournament.starts_at || '').slice(0, 4)) || new Date().getFullYear();
  const salvo = report?.final || null;
  const [ano, setAno] = useState(String(salvo?.season || anoTorneio));
  const [porCategoria, setPorCategoria] = useState(String(salvo?.per_category || 8));
  const [dias, setDias] = useState(String(salvo?.accept_days || FINAL_ACCEPT_DAYS));
  const [cancelando, setCancelando] = useState(null);
  const ranking = useFederationRanking(federation.id, Number(ano));
  const convites = useFinalInvites(federation.id, tournament.id);
  const opcoes = { season: Number(ano), per_category: Number(porCategoria), accept_days: Number(dias) };
  const enviar = useFederationMutation(() => competitionAction(federation.id, 'final_send', { tournamentId: tournament.id, ...opcoes }));
  const categorias = ranking.data?.categories || [];
  const novos = useMemo(() => (convites.isSuccess ? finalInvitesToSend(categorias, convites.data, opcoes) : []), [categorias, convites.isSuccess, convites.data, ano, porCategoria, dias]); // eslint-disable-line react-hooks/exhaustive-deps
  const porCat = useMemo(() => {
    const mapa = new Map();
    (convites.data || []).forEach((i) => { if (!mapa.has(i.category_key)) mapa.set(i.category_key, []); mapa.get(i.category_key).push(i); });
    return mapa;
  }, [convites.data]);
  const anos = [anoTorneio, anoTorneio - 1].map((a) => ({ value: String(a), label: String(a) }));

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto" data-dica="federacao-final-circuito">
        <DialogHeader>
          <DialogTitle>{t('Final do circuito: {torneio}', { torneio: tournament.name })}</DialogTitle>
          <DialogDescription>{t('Convide os melhores do ranking oficial do ano para este torneio. Quem recusar, não responder no prazo ou for cancelado dá a vaga ao próximo do ranking, sem você fazer nada.')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <V2Field label={t('Ranking do ano')} htmlFor="final-ano"><V2Select id="final-ano" value={ano} onChange={(e) => setAno(e.target.value)} options={anos} /></V2Field>
            <V2Field label={t('Vagas por categoria')} htmlFor="final-vagas"><V2Input id="final-vagas" type="number" min={1} max={64} value={porCategoria} onChange={(e) => setPorCategoria(e.target.value)} /></V2Field>
            <V2Field label={t('Dias para responder')} htmlFor="final-dias"><V2Input id="final-dias" type="number" min={1} max={30} value={dias} onChange={(e) => setDias(e.target.value)} /></V2Field>
          </div>
          {(ranking.isError || convites.isError) && <V2ErrorState inline title={t('Não carregaram o ranking ou os convites')} onRetry={() => { ranking.refetch(); convites.refetch(); }} />}
          {(ranking.isLoading || convites.isLoading) && <V2Skeleton lines={3} />}
          {ranking.isSuccess && convites.isSuccess && (
            <>
              {!categorias.length && <p className="text-sm text-gray-500">{t('O ranking de {ano} ainda não tem atletas.', { ano })}</p>}
              {categorias.map((c) => {
                const lista = porCat.get(c.key) || [];
                const resumo = finalCategorySummary(lista, Number(porCategoria));
                return (
                  <section key={c.key} className="space-y-1 rounded-2xl border border-gray-100 p-3">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                      {classeLabel(c)}
                      <V2Badge tone="neutral">{t('{ok} confirmados · {esperando} esperando · {vagas} vagas', { ok: resumo.accepted, esperando: resumo.invited, vagas: resumo.per_category })}</V2Badge>
                    </p>
                    {lista.length > 0 && (
                      <ul className="divide-y divide-gray-100 text-sm">
                        {lista.map((i) => (
                          <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                            <span>{`${i.position || '—'}º · ${i.user_name}`}{i.substitute ? ` · ${t('suplente')}` : ''}</span>
                            <span className="flex items-center gap-2">
                              <V2Badge tone={TOM[i.status] || 'neutral'}>{t(FINAL_INVITE_STATUS_LABELS[i.status] || i.status)}</V2Badge>
                              {i.status === FINAL_INVITE_STATUS.INVITED && <span className="text-xs text-gray-500">{t('até {data}', { data: quando(i.expires_at_ms) })}</span>}
                              {[FINAL_INVITE_STATUS.INVITED, FINAL_INVITE_STATUS.ACCEPTED].includes(i.status) && (
                                <V2Button type="button" size="sm" variant="ghost" aria-label={t('Cancelar convite de {nome}', { nome: i.user_name })} onClick={() => setCancelando(i)}><XCircle className="h-4 w-4" /></V2Button>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-600">{novos.length ? tn(novos.length, '{n} pessoa será convidada agora.', '{n} pessoas serão convidadas agora.') : t('Ninguém a convidar agora.')}</p>
                <V2Button type="button" size="sm" disabled={!novos.length || enviar.isPending} onClick={() => enviar.mutate(undefined, { onSuccess: (r) => toast.success(tn(r?.invited || 0, '{n} convite enviado.', '{n} convites enviados.')), onError: (e) => toast.error(e.message) })}>
                  <Medal className="h-4 w-4" />{t('Enviar convites')}
                </V2Button>
              </div>
            </>
          )}
        </div>
        {cancelando && <CancelarConvite invite={cancelando} federationId={federation.id} onClose={() => setCancelando(null)} />}
      </DialogContent>
    </Dialog>
  );
}
