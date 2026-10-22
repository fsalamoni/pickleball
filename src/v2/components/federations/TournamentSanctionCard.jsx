/**
 * "Federação" na gestão do torneio (Geral): pedir a chancela de uma federação
 * que chancela torneios (módulo `tournaments`), com a categoria proposta (as
 * da federação, com sigla, grupo e requisitos) e se o torneio é só para
 * filiados; acompanhar e retirar o pedido. A federação é quem aprova — e pode
 * mudar categoria e exigência ao aprovar. Chancelado, a
 * tela de resultados ganha "Enviar ao ranking oficial" por categoria.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Landmark, Send, Undo2 } from 'lucide-react';
import { PlatformFormSection } from '@/components/ui/platform-page';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { requestSanction, withdrawSanction } from '@/modules/federations/services/federationService';
import { useFederationMutation, useFederationsEnabled, usePublicFederations } from '@/modules/federations/hooks/useFederations';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { sanctionState } from '@/modules/federations/domain/sanction';
import { SANCTION_STATUS_LABELS } from '@/modules/federations/domain/constants';
import { tierLabel, tierOptions } from '@/modules/federations/domain/officialRanking';
import FedTierRequirements from './FedTierRequirements';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Select, V2Skeleton, V2Toggle } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

export default function TournamentSanctionCard({ tournament }) {
  const ligado = useFederationsEnabled();
  const { user } = useAuth();
  const feds = usePublicFederations({ enabled: ligado });
  const st = sanctionState(tournament);
  const [fedId, setFedId] = useState('');
  const [tier, setTier] = useState('');
  const [soFiliados, setSoFiliados] = useState(false);
  const [retirando, setRetirando] = useState(false);
  const federacao = (feds.data || []).find((f) => f.id === fedId) || null;
  // As categorias da federação escolhida (ativas); sem escolha, a primeira.
  const categorias = federacao ? tierOptions(federacao.ranking_config) : [];
  const categoria = categorias.find((c) => c.id === tier) || categorias[0] || null;
  const pedir = useFederationMutation(() => requestSanction(tournament, { federation: federacao, uid: user?.uid, tier: categoria?.id, requiresMembership: soFiliados }));
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
              <V2Badge tone="neutral">{st.tierLabel}</V2Badge>
              {st.byFederation && <V2Badge tone="ink">{t('Realizado pela federação')}</V2Badge>}
              {st.requiresMembership && <V2Badge tone="purple">{t('Só filiados em dia se inscrevem')}</V2Badge>}
            </p>
            {s.reason && !st.approved && <p className="mt-1 text-sm text-red-600">{t('Motivo: {motivo}', { motivo: s.reason })}</p>}
            {st.approved && <p className="mt-1 text-sm text-gray-600">{t('Ao encerrar cada categoria, envie o resultado em Resultados → "Enviar ao ranking oficial".')}</p>}
            {st.canWithdraw && <V2Button type="button" size="sm" variant="ghost" className="mt-2" disabled={retirar.isPending} onClick={() => setRetirando(true)}><Undo2 className="h-4 w-4" />{t('Retirar pedido')}</V2Button>}
          </div>
        )}
        <ConfirmDialog
          open={retirando}
          onOpenChange={setRetirando}
          destructive
          loading={retirar.isPending}
          title={t('Retirar o pedido de chancela à {sigla}?', { sigla: st.acronym || st.name || '' })}
          description={t('O pedido sai da fila da federação, que deixa de analisá-lo. Para ter o selo depois, é preciso pedir de novo e esperar uma nova análise.')}
          confirmLabel={t('Retirar pedido')}
          cancelLabel={t('Voltar')}
          onConfirm={() => retirar.mutate(undefined, { onSuccess: () => { setRetirando(false); toast.success(t('Pedido retirado.')); }, onError: (e) => toast.error(e.message) })}
        />
        {st.canRequest && (
          <>
            {feds.isError && <V2ErrorState inline title={t('Não carregaram as federações')} onRetry={() => feds.refetch()} />}
            {feds.isLoading && <V2Skeleton lines={2} />}
            {feds.isSuccess && (opcoes.length === 0 ? <p className="text-sm text-gray-500">{t('Nenhuma federação chancela torneios ainda.')}</p> : (
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!fedId) return; pedir.mutate(undefined, { onSuccess: () => { toast.success(t('Pedido de chancela enviado. A federação foi avisada.')); setFedId(''); }, onError: (er) => toast.error(er.message) }); }}>
                <div className="grid gap-3 md:grid-cols-2">
                  <V2Field label={t('Pedir a chancela de')} htmlFor="sanc-fed">
                    <V2Select id="sanc-fed" value={fedId} onChange={(e) => { setFedId(e.target.value); setTier(''); }} options={[{ value: '', label: t('Escolha a federação') }, ...opcoes.map((f) => ({ value: f.id, label: `${f.acronym} · ${f.name}` }))]} />
                  </V2Field>
                  <V2Field label={t('Categoria do torneio (proposta)')} htmlFor="sanc-tier" hint={t('A federação confirma a categoria ao aprovar.')}>
                    <V2Select id="sanc-tier" value={categoria?.id || ''} disabled={!federacao} onChange={(e) => setTier(e.target.value)} options={federacao ? categorias.map((c) => ({ value: c.id, label: tierLabel(c) })) : [{ value: '', label: t('Escolha a federação primeiro') }]} />
                  </V2Field>
                </div>
                {categoria && <FedTierRequirements tier={categoria} />}
                <V2Toggle id="sanc-filiados" checked={soFiliados} onChange={setSoFiliados} label={t('Só filiados em dia se inscrevem')} hint={t('A inscrição de quem não está em dia na federação é recusada.')} />
                <div className="flex justify-end"><V2Button type="submit" size="sm" disabled={!fedId || pedir.isPending}><Send className="h-4 w-4" />{t('Pedir a chancela')}</V2Button></div>
              </form>
            ))}
          </>
        )}
      </div>
    </PlatformFormSection>
  );
}
