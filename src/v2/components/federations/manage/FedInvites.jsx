/**
 * Convites para filiar (permissão `members`). A secretaria escolhe pessoas na
 * lista de usuários da plataforma e um plano; o servidor (`federationMembership`,
 * ações `invite`/`invite_cancel`) grava o convite e avisa cada pessoa. Ninguém
 * vira filiado sem querer: quem aceita pede a filiação no plano do convite, e
 * esse pedido entra sem esperar a secretaria.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { MailPlus, Send, X } from 'lucide-react';
import { membershipAction } from '@/modules/federations/services/federationService';
import { useFederationInvites, useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { FED_INVITE_DAYS, FED_INVITE_MAX, MEMBER_STATUS, isInvitePending } from '@/modules/federations/domain/constants';
import { isFederationPublic } from '@/modules/federations/domain/federation';
import { V2Avatar, V2Button, V2ErrorState, V2Field, V2Select, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { quando } from '../federationUi';
import FedPersonPicker from './FedPersonPicker';

const VIVOS = [MEMBER_STATUS.PENDING, MEMBER_STATUS.AWAITING_PAYMENT, MEMBER_STATUS.ACTIVE, MEMBER_STATUS.EXPIRED, MEMBER_STATUS.SUSPENDED];

/** Convidar pessoas da plataforma para um plano. */
export function ConvidarPessoas({ federation, membros, plansQ }) {
  const invitesQ = useFederationInvites(federation.id);
  const [aberto, setAberto] = useState(false);
  const [pessoas, setPessoas] = useState([]);
  const [nota, setNota] = useState('');
  const planos = (plansQ?.data || []).filter((p) => p.active !== false);
  const [planId, setPlanId] = useState('');
  const plano = planos.find((p) => p.id === planId) || planos[0];
  const excluir = useMemo(() => {
    const m = new Map();
    for (const mb of membros) if (mb.user_id && VIVOS.includes(mb.status)) m.set(mb.user_id, mb.status === MEMBER_STATUS.PENDING ? t('Pediu filiação') : t('Já filiado(a)'));
    for (const inv of invitesQ.data || []) if (isInvitePending(inv) && !m.has(inv.user_id)) m.set(inv.user_id, t('Já convidado(a)'));
    return m;
  }, [membros, invitesQ.data]);
  const enviar = useFederationMutation(() => membershipAction({ federationId: federation.id, action: 'invite', userIds: pessoas.map((p) => p.id), planId: plano.id, note: nota.trim() }));

  const publica = isFederationPublic(federation);
  return (
    <V2Surface className="space-y-4" data-dica="federacao-convidar">
      <div className="flex flex-wrap items-center gap-3">
        <MailPlus className="h-5 w-5 text-ink" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold text-ink">{t('Convidar pessoas da plataforma')}</h3>
          <p className="text-sm text-gray-500">{t('Escolha quem já tem conta no PickleRush. Cada pessoa recebe um aviso e decide: aceitando, a filiação entra no plano escolhido sem esperar aprovação. O convite vale {dias} dias.', { dias: FED_INVITE_DAYS })}</p>
        </div>
        <V2Button type="button" variant="secondary" aria-expanded={aberto} onClick={() => setAberto(!aberto)}>{aberto ? t('Fechar') : t('Convidar')}</V2Button>
      </div>
      {aberto && (!publica ? <p className="text-sm text-amber-700">{t('A federação ainda não está publicada. Publique a página (Página pública → Publicação) para poder convidar: o convite leva à página de filiação.')}</p>
        : plansQ?.isError ? <V2ErrorState inline title={t('Não carregaram os planos')} onRetry={() => plansQ.refetch()} />
          : !plansQ?.isSuccess || invitesQ.isLoading ? <V2Skeleton lines={3} />
            : !planos.length ? <p className="text-sm text-amber-700">{t('Cadastre um plano ativo em Configurações → Planos antes de convidar.')}</p>
              : (
                <div className="space-y-4">
                  {invitesQ.isError && <V2ErrorState inline title={t('Não carregaram os convites já enviados: quem já foi convidado não aparece marcado.')} onRetry={() => invitesQ.refetch()} />}
                  <V2Field label={t('Pessoas')} htmlFor="convite-busca" hint={t('Até {n} por vez.', { n: FED_INVITE_MAX })}>
                    <FedPersonPicker id="convite-busca" multiple max={FED_INVITE_MAX} selecionados={pessoas} onChange={setPessoas} excluir={excluir} />
                  </V2Field>
                  <V2Field label={t('Plano do convite')} htmlFor="convite-plano">
                    <V2Select id="convite-plano" value={plano.id} onChange={(e) => setPlanId(e.target.value)}>
                      {planos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </V2Select>
                  </V2Field>
                  <V2Field label={t('Recado (opcional)')} htmlFor="convite-nota">
                    <V2Textarea id="convite-nota" rows={2} maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} placeholder={t('Ex.: venha jogar o circuito estadual com a gente.')} />
                  </V2Field>
                  <div className="flex justify-end">
                    <V2Button
                      type="button"
                      disabled={!pessoas.length || enviar.isPending}
                      onClick={() => enviar.mutate(undefined, {
                        onSuccess: (r) => {
                          const pulados = r?.skipped?.length || 0;
                          toast.success(pulados ? tn(r.invited || 0, '{n} convite enviado. {p} de fora (já filiado ou já convidado).', '{n} convites enviados. {p} de fora (já filiado ou já convidado).', { p: pulados }) : tn(r?.invited || 0, '{n} convite enviado.', '{n} convites enviados.'));
                          setPessoas([]); setNota(''); setAberto(false);
                        },
                        onError: (e) => toast.error(e.message),
                      })}
                    >
                      <Send className="h-4 w-4" />{pessoas.length ? tn(pessoas.length, 'Enviar {n} convite', 'Enviar {n} convites') : t('Enviar convites')}
                    </V2Button>
                  </div>
                </div>
              ))}
    </V2Surface>
  );
}

function ConviteRow({ federation, inv }) {
  const cancelar = useFederationMutation(() => membershipAction({ federationId: federation.id, action: 'invite_cancel', userId: inv.user_id }));
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <V2Avatar name={inv.user_name} photoUrl={inv.photo_url} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{inv.user_name}</p>
        <p className="text-xs text-gray-500">{t('Plano {plano} · vale até {data}', { plano: inv.plan_name, data: quando(inv.expires_at_ms) })}</p>
      </div>
      <V2Button type="button" size="sm" variant="ghost" disabled={cancelar.isPending} onClick={() => cancelar.mutate(undefined, { onSuccess: () => toast.success(t('Convite cancelado.')), onError: (e) => toast.error(e.message) })}>
        <X className="h-4 w-4" />{t('Cancelar')}
      </V2Button>
    </li>
  );
}

/** Os convites que ainda esperam resposta. Some quando não há nenhum. */
export function ConvitesEnviados({ federation }) {
  const invitesQ = useFederationInvites(federation.id);
  if (invitesQ.isError) return <V2ErrorState inline title={t('Não carregaram os convites enviados')} onRetry={() => invitesQ.refetch()} />;
  const abertos = (invitesQ.data || []).filter((inv) => isInvitePending(inv));
  if (!abertos.length) return null;
  return (
    <section className="space-y-2" aria-label={t('Convites enviados')}>
      <h3 className="font-display text-lg font-bold text-ink">{t('Convites esperando resposta')}</h3>
      <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white">
        {abertos.map((inv) => <ConviteRow key={inv.id} federation={federation} inv={inv} />)}
      </ul>
    </section>
  );
}
