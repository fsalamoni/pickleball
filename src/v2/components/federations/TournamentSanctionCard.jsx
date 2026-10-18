/**
 * "Federação" na gestão do torneio (Geral): pedir a chancela de uma federação
 * que chancela torneios (módulo `tournaments`), com o peso proposto e se o
 * torneio é só para filiados; acompanhar e retirar o pedido. A federação é
 * quem aprova — e pode mudar peso e exigência ao aprovar. Chancelado, a
 * tela de resultados ganha "Enviar ao ranking oficial" por categoria.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Landmark, Send, Undo2 } from 'lucide-react';
import { PlatformFormSection } from '@/components/ui/platform-page';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { requestSanction, withdrawSanction } from '@/modules/federations/services/federationService';
import { useFederationMutation, useFederationsEnabled, usePublicFederations } from '@/modules/federations/hooks/useFederations';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { sanctionState } from '@/modules/federations/domain/sanction';
import { SANCTION_STATUS_LABELS, SANCTION_TIER, SANCTION_TIER_LABELS } from '@/modules/federations/domain/constants';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Select, V2Skeleton, V2Toggle } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

export default function TournamentSanctionCard({ tournament }) {
  const ligado = useFederationsEnabled();
  const { user } = useAuth();
  const feds = usePublicFederations({ enabled: ligado });
  const st = sanctionState(tournament);
  const [fedId, setFedId] = useState('');
  const [tier, setTier] = useState(SANCTION_TIER.REGIONAL);
  const [soFiliados, setSoFiliados] = useState(false);
  const pedir = useFederationMutation(() => requestSanction(tournament, { federation: (feds.data || []).find((f) => f.id === fedId), uid: user?.uid, tier, requiresMembership: soFiliados }));
  const retirar = useFederationMutation(() => withdrawSanction(tournament, { uid: user?.uid }));
  const opcoes = useMemo(() => (feds.data || []).filter((f) => fedModuleOn(f, 'tournaments')), [feds.data]);
  if (!ligado) return null;
  const s = tournament.federation_sanction || {};
  return (
    <PlatformFormSection icon={Landmark} title={t('Federação')} description={t('Torneio chancelado ganha o selo da federação, pode exigir filiação na inscrição e manda os resultados para o ranking oficial dela. Quem aprova é a federação.')}>
      <div data-dica="torneio-federacao" className="space-y-3">
        {st.status && (
          <div className="rounded-2xl border border-gray-100 bg-white p-3">
            <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
              <Link to={`/federacoes/${st.federationId}`} className="hover:underline">{st.name || st.acronym}</Link>
              <V2Badge tone={st.approved ? 'green' : st.pending ? 'amber' : 'red'}>{t(SANCTION_STATUS_LABELS[st.status] || st.status)}</V2Badge>
              <V2Badge tone="neutral">{t(SANCTION_TIER_LABELS[st.tier] || SANCTION_TIER_LABELS.regional)}</V2Badge>
              {st.requiresMembership && <V2Badge tone="purple">{t('Só filiados em dia se inscrevem')}</V2Badge>}
            </p>
            {s.reason && !st.approved && <p className="mt-1 text-sm text-red-600">{t('Motivo: {motivo}', { motivo: s.reason })}</p>}
            {st.approved && <p className="mt-1 text-sm text-gray-600">{t('Ao encerrar cada categoria, envie o resultado em Resultados → "Enviar ao ranking oficial".')}</p>}
            {st.canWithdraw && <V2Button type="button" size="sm" variant="ghost" className="mt-2" disabled={retirar.isPending} onClick={() => retirar.mutate(undefined, { onSuccess: () => toast.success(t('Pedido retirado.')), onError: (e) => toast.error(e.message) })}><Undo2 className="h-4 w-4" />{t('Retirar pedido')}</V2Button>}
          </div>
        )}
        {st.canRequest && (
          <>
            {feds.isError && <V2ErrorState inline title={t('Não carregaram as federações')} onRetry={() => feds.refetch()} />}
            {feds.isLoading && <V2Skeleton lines={2} />}
            {feds.isSuccess && (opcoes.length === 0 ? <p className="text-sm text-gray-500">{t('Nenhuma federação chancela torneios ainda.')}</p> : (
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!fedId) return; pedir.mutate(undefined, { onSuccess: () => { toast.success(t('Pedido de chancela enviado. A federação foi avisada.')); setFedId(''); }, onError: (er) => toast.error(er.message) }); }}>
                <div className="grid gap-3 md:grid-cols-2">
                  <V2Field label={t('Pedir a chancela de')} htmlFor="sanc-fed">
                    <V2Select id="sanc-fed" value={fedId} onChange={(e) => setFedId(e.target.value)} options={[{ value: '', label: t('Escolha a federação') }, ...opcoes.map((f) => ({ value: f.id, label: `${f.acronym} · ${f.name}` }))]} />
                  </V2Field>
                  <V2Field label={t('Tipo de torneio (proposta)')} htmlFor="sanc-tier" hint={t('A federação confirma o peso ao aprovar.')}>
                    <V2Select id="sanc-tier" value={tier} onChange={(e) => setTier(e.target.value)} options={Object.values(SANCTION_TIER).map((v) => ({ value: v, label: t(SANCTION_TIER_LABELS[v]) }))} />
                  </V2Field>
                </div>
                <V2Toggle id="sanc-filiados" checked={soFiliados} onChange={setSoFiliados} label={t('Só filiados em dia se inscrevem')} hint={t('A regra do banco recusa a inscrição de quem não está em dia na federação.')} />
                <div className="flex justify-end"><V2Button type="submit" size="sm" disabled={!fedId || pedir.isPending}><Send className="h-4 w-4" />{t('Pedir a chancela')}</V2Button></div>
              </form>
            ))}
          </>
        )}
      </div>
    </PlatformFormSection>
  );
}
