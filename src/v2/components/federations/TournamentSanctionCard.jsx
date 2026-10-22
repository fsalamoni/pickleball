/**
 * "Federação" na gestão do torneio (Geral): pedir a chancela de uma federação
 * que chancela torneios (módulo `tournaments`), com a categoria proposta (as
 * da federação, com sigla, grupo e requisitos) e se o torneio é só para
 * filiados; acompanhar e retirar o pedido. A federação é quem aprova — e pode
 * mudar categoria e exigência ao aprovar. Chancelado, a
 * tela de resultados ganha "Enviar ao ranking oficial" por categoria.
 *
 * Bloco 2: o pedido leva o diretor credenciado (código da credencial) e a
 * premiação por gênero (com o aviso de isonomia); a tela diz antes o prazo
 * mínimo e a taxa da categoria. O SERVIDOR confere tudo de novo, recusa fora
 * do prazo e cria a cobrança Pix da taxa, que aparece aqui para pagar.
 * Chancelado, o diretor (ou quem pediu) faz o checklist e o relatório.
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
import { useSanctionFee, useTournamentReport } from '@/modules/federations/hooks/useCompetitions';
import { fedModuleOn, normalizeFederationRules } from '@/modules/federations/domain/federation';
import { normalizeDirectorCode, prizeParity, sanctionTiming } from '@/modules/federations/domain/competitions';
import { formatBrlCents, parseBrlCents } from '@/modules/federations/domain/charges';
import { isoDate } from '@/modules/federations/domain/membership';
import { sanctionState } from '@/modules/federations/domain/sanction';
import { SANCTION_STATUS_LABELS } from '@/modules/federations/domain/constants';
import { tierLabel, tierOptions } from '@/modules/federations/domain/officialRanking';
import FedTierRequirements from './FedTierRequirements';
import PixChargeBlock from './PixChargeBlock';
import DirectorReportForm from './competitions/DirectorReportForm';
import PrizeParityNote from './competitions/PrizeParityNote';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Toggle } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

const reaisOuNada = (txt) => (String(txt || '').trim() ? parseBrlCents(txt) : null);

export default function TournamentSanctionCard({ tournament }) {
  const ligado = useFederationsEnabled();
  const { user, userProfile } = useAuth();
  const feds = usePublicFederations({ enabled: ligado });
  const st = sanctionState(tournament);
  const [fedId, setFedId] = useState('');
  const [tier, setTier] = useState('');
  const [soFiliados, setSoFiliados] = useState(false);
  const [retirando, setRetirando] = useState(false);
  const [diretor, setDiretor] = useState('');
  const [premio, setPremio] = useState({ female: '', male: '', note: '' });
  const federacao = (feds.data || []).find((f) => f.id === fedId) || null;
  const fedDoPedido = (feds.data || []).find((f) => f.id === tournament.federation_id) || null;
  const regras = normalizeFederationRules(federacao?.rules);
  const prazo = sanctionTiming(regras, tournament.starts_at, isoDate());
  const premiacao = { female_cents: reaisOuNada(premio.female), male_cents: reaisOuNada(premio.male), note: premio.note };
  // As categorias da federação escolhida (ativas); sem escolha, a primeira.
  const categorias = federacao ? tierOptions(federacao.ranking_config) : [];
  const categoria = categorias.find((c) => c.id === tier) || categorias[0] || null;
  const pedir = useFederationMutation(() => requestSanction(tournament, {
    federation: federacao, uid: user?.uid, uidName: userProfile?.full_name || user?.displayName || '', tier: categoria?.id, requiresMembership: soFiliados, directorCode: diretor, prize: premiacao,
  }));
  const retirar = useFederationMutation(() => withdrawSanction(tournament, { uid: user?.uid }));
  const opcoes = useMemo(() => (feds.data || []).filter((f) => fedModuleOn(f, 'tournaments')), [feds.data]);
  const s = tournament.federation_sanction || {};
  const taxa = useSanctionFee(s.fee_charge_id, { enabled: ligado && st.pending && Boolean(s.fee_charge_id) && s.requested_by === user?.uid });
  const souDiretor = Boolean(user?.uid) && (s.director_uid === user.uid || s.requested_by === user.uid);
  const relatorio = useTournamentReport(tournament.id, { enabled: ligado && st.approved && souDiretor });
  if (!ligado) return null;
  const conferindo = st.pending && s.checked_at_ms !== s.requested_at_ms;
  const bloqueado = prazo.late || prazo.no_date || (regras.sanction_requires_director && normalizeDirectorCode(diretor).length < 6);
  const taxaAberta = st.pending && s.fee_cents > 0 && !s.fee_paid_at_ms && !s.fee_cancelled_at_ms;
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
            {s.director_name && (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                {t('Diretor do torneio: {nome}', { nome: s.director_name })}
                {s.director_verified ? <V2Badge tone="green">{t('Credenciado')}</V2Badge> : <V2Badge tone="neutral">{t('Sem credencial')}</V2Badge>}
              </p>
            )}
            {s.prize && <div className="mt-2"><PrizeParityNote prize={s.prize} /></div>}
            {conferindo && <p className="mt-1 text-sm text-gray-500">{t('Conferindo prazo, diretor e taxa do pedido…')}</p>}
            {st.pending && s.fee_cents > 0 && (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-gray-700">
                  {s.fee_paid_at_ms
                    ? t('Taxa de chancela paga ({valor}). A federação analisa o pedido.', { valor: formatBrlCents(s.fee_cents) })
                    : s.fee_cancelled_at_ms
                      ? t('A federação dispensou a taxa de chancela.')
                      : t('Taxa de chancela: {valor}. A federação analisa o pedido depois do pagamento.', { valor: formatBrlCents(s.fee_cents) })}
                </p>
                {taxaAberta && taxa.data && fedDoPedido && <PixChargeBlock charge={taxa.data} federation={fedDoPedido} compact />}
                {taxaAberta && taxa.isError && <V2ErrorState inline title={t('Não carregou a cobrança da taxa')} onRetry={() => taxa.refetch()} />}
              </div>
            )}
            {s.reason && !st.approved && <p className="mt-1 text-sm text-red-600">{t('Motivo: {motivo}', { motivo: s.reason })}</p>}
            {st.approved && <p className="mt-1 text-sm text-gray-600">{t('Ao encerrar cada categoria, envie o resultado em Resultados → "Enviar ao ranking oficial".')}</p>}
            {st.approved && souDiretor && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                {relatorio.isError && <V2ErrorState inline title={t('Não carregou o relatório do torneio')} onRetry={() => relatorio.refetch()} />}
                {relatorio.isLoading && <V2Skeleton lines={2} />}
                {relatorio.isSuccess && (relatorio.data ? <DirectorReportForm report={relatorio.data} /> : <p className="text-sm text-gray-500">{t('O checklist do diretor aparece aqui em instantes.')}</p>)}
              </div>
            )}
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
              <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (!fedId || bloqueado) return; pedir.mutate(undefined, { onSuccess: () => { toast.success(t('Pedido de chancela enviado. A federação foi avisada.')); setFedId(''); }, onError: (er) => toast.error(er.message) }); }}>
                <div className="grid gap-3 md:grid-cols-2">
                  <V2Field label={t('Pedir a chancela de')} htmlFor="sanc-fed">
                    <V2Select id="sanc-fed" value={fedId} onChange={(e) => { setFedId(e.target.value); setTier(''); }} options={[{ value: '', label: t('Escolha a federação') }, ...opcoes.map((f) => ({ value: f.id, label: `${f.acronym} · ${f.name}` }))]} />
                  </V2Field>
                  <V2Field label={t('Categoria do torneio (proposta)')} htmlFor="sanc-tier" hint={t('A federação confirma a categoria ao aprovar.')}>
                    <V2Select id="sanc-tier" value={categoria?.id || ''} disabled={!federacao} onChange={(e) => setTier(e.target.value)} options={federacao ? categorias.map((c) => ({ value: c.id, label: tierLabel(c) })) : [{ value: '', label: t('Escolha a federação primeiro') }]} />
                  </V2Field>
                </div>
                {categoria && <FedTierRequirements tier={categoria} />}
                {federacao && prazo.min_days > 0 && (
                  <p className={prazo.late || prazo.no_date ? 'text-sm text-red-600' : 'text-sm text-gray-600'}>
                    {prazo.no_date
                      ? t('A {sigla} pede {dias} dias de antecedência: marque a data de início do torneio antes de pedir.', { sigla: federacao.acronym, dias: prazo.min_days })
                      : prazo.late
                        ? t('A {sigla} pede a chancela com pelo menos {dias} dias de antecedência; o torneio começa em {faltam} dias.', { sigla: federacao.acronym, dias: prazo.min_days, faltam: Math.max(0, prazo.days_ahead) })
                        : t('Prazo da {sigla}: pedir com pelo menos {dias} dias de antecedência. Dentro do prazo.', { sigla: federacao.acronym, dias: prazo.min_days })}
                  </p>
                )}
                {categoria?.sanction_fee_cents > 0 && <p className="text-sm text-gray-600">{t('Taxa de chancela desta categoria: {valor}, cobrada por Pix depois do pedido.', { valor: formatBrlCents(categoria.sanction_fee_cents) })}</p>}
                {federacao && (
                  <>
                    <V2Field
                      label={t('Código da credencial do diretor do torneio')}
                      htmlFor="sanc-diretor"
                      required={regras.sanction_requires_director}
                      hint={regras.sanction_requires_director
                        ? t('A {sigla} exige um diretor credenciado. O código está na credencial dele (Minha área → Federações).', { sigla: federacao.acronym })
                        : t('Opcional. Sem diretor credenciado, você responde como diretor do torneio.')}
                    >
                      <V2Input id="sanc-diretor" value={diretor} onChange={(e) => setDiretor(e.target.value)} maxLength={20} autoComplete="off" />
                    </V2Field>
                    <div className="grid gap-3 md:grid-cols-3">
                      <V2Field label={t('Premiação feminina (R$)')} htmlFor="sanc-premio-f">
                        <V2Input id="sanc-premio-f" inputMode="decimal" value={premio.female} onChange={(e) => setPremio((x) => ({ ...x, female: e.target.value }))} placeholder="0,00" />
                      </V2Field>
                      <V2Field label={t('Premiação masculina (R$)')} htmlFor="sanc-premio-m">
                        <V2Input id="sanc-premio-m" inputMode="decimal" value={premio.male} onChange={(e) => setPremio((x) => ({ ...x, male: e.target.value }))} placeholder="0,00" />
                      </V2Field>
                      <V2Field label={t('Observação da premiação')} htmlFor="sanc-premio-n">
                        <V2Input id="sanc-premio-n" value={premio.note} maxLength={200} onChange={(e) => setPremio((x) => ({ ...x, note: e.target.value }))} placeholder={t('Troféus, brindes…')} />
                      </V2Field>
                    </div>
                    {prizeParity(premiacao).state !== 'unknown' && <PrizeParityNote prize={premiacao} />}
                  </>
                )}
                <V2Toggle id="sanc-filiados" checked={soFiliados} onChange={setSoFiliados} label={t('Só filiados em dia se inscrevem')} hint={t('A inscrição de quem não está em dia na federação é recusada.')} />
                <div className="flex justify-end"><V2Button type="submit" size="sm" disabled={!fedId || bloqueado || pedir.isPending}><Send className="h-4 w-4" />{t('Pedir a chancela')}</V2Button></div>
              </form>
            ))}
          </>
        )}
      </div>
    </PlatformFormSection>
  );
}
