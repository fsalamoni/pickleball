/**
 * Competições (Central → Competições, permissão `competitions`):
 *  - Chancelas: os pedidos (aprovar com peso e exigência de filiação, recusar)
 *    e os torneios chancelados (revogar);
 *  - Resultados: o que os organizadores enviaram (recusar / readmitir);
 *  - Ranking: a configuração da pontuação e o ranking da temporada.
 * Toda escrita é o patch estreito que a regra aceita; o ranking em si é do
 * servidor (`federationRankingRecompute`).
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Ban, CheckCircle2, ClipboardList, Download, FileText, Lock, Medal, Plus, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { decideSanction, reviewFederationResult, updateRankingConfig } from '@/modules/federations/services/federationService';
import { useFederationMutation, useFederationPlatformSettings } from '@/modules/federations/hooks/useFederations';
import { SANCTION_ORIGIN, pendingSanctions, sanctionState, sanctionedTournaments } from '@/modules/federations/domain/sanction';
import { legacyTiers, normalizeRankingConfig, seasonClosed, tierLabel, tierOptions, validateTiers } from '@/modules/federations/domain/officialRanking';
import { RESULT_STATUS, RESULT_STATUS_LABELS, SANCTION_STATUS_LABELS, SANCTION_TIER, SANCTION_TIER_LABELS } from '@/modules/federations/domain/constants';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2FilterChip, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { FedRankingBlock, classeLabel } from '../FedPublicBlocks';
import { quando } from '../federationUi';
import { BuscaLista, MostrarMais, useBuscaLista, useFiltroNaUrl } from './listTools';
import { baixarCsv, useAvisoNaoSalvo } from './naoSalvo';
import { resultsCsv } from '@/modules/federations/domain/exports';
import FedTiersEditor from './FedTiersEditor';
import FedTierRequirements from '../FedTierRequirements';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { formatBrlCents } from '@/modules/federations/domain/charges';
import { useFederationTournamentReports, useSanctionFees } from '@/modules/federations/hooks/useCompetitions';
import DirectorReportForm from '../competitions/DirectorReportForm';
import FinalCircuitDialog from '../competitions/FinalCircuitDialog';
import PrizeParityNote from '../competitions/PrizeParityNote';

const TIERS = Object.values(SANCTION_TIER).map((v) => ({ value: v, label: SANCTION_TIER_LABELS[v] }));

/* ----------------------------------------------------------- chancelas -- */

function DecisaoDialog({ tournament, federation, acao, onClose }) {
  const { user } = useAuth();
  const st = sanctionState(tournament);
  const opcoes = tierOptions(federation?.ranking_config, st.tier);
  const [tier, setTier] = useState(opcoes.some((o) => o.id === st.tier) ? st.tier : opcoes[0]?.id || st.tier);
  const [soFiliados, setSoFiliados] = useState(st.requiresMembership);
  // Quem pediu é da própria equipe? Então o mais provável é ser um torneio DA federação.
  const [daFederacao, setDaFederacao] = useState(tournament.federation_sanction?.origin === SANCTION_ORIGIN.FEDERATION);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const m = useFederationMutation(() => decideSanction(tournament, acao, {
    uid: user?.uid, reason: motivo, tier, requiresMembership: soFiliados, federation,
    origin: daFederacao ? SANCTION_ORIGIN.FEDERATION : SANCTION_ORIGIN.SANCTIONED,
  }));
  const escolhida = opcoes.find((o) => o.id === tier) || null;
  const aprovar = acao === 'approve';
  const nome = tournament.name || '';
  const textos = {
    approve: {
      title: t('Chancelar {torneio}?', { torneio: nome }),
      description: t('O torneio ganha o selo da federação e passa a enviar resultados ao ranking oficial. Quem organiza recebe um aviso.'),
      confirmLabel: t('Chancelar'),
    },
    reject: {
      title: t('Recusar a chancela de {torneio}?', { torneio: nome }),
      description: t('Quem organiza recebe um aviso com o motivo e pode pedir a chancela de novo depois.'),
      confirmLabel: t('Recusar'),
    },
    revoke: {
      title: t('Revogar a chancela de {torneio}?', { torneio: nome }),
      description: t('O torneio perde o selo da federação e os resultados que ele já enviou saem do ranking oficial, que é refeito na hora. Quem organiza recebe um aviso com o motivo. Para voltar, é preciso pedir a chancela de novo.'),
      confirmLabel: t('Revogar'),
    },
  }[acao];
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => { if (!o) onClose(); }}
      destructive={!aprovar}
      loading={m.isPending}
      confirmDisabled={!aprovar && motivo.trim().length < 3}
      title={textos.title}
      description={textos.description}
      confirmLabel={textos.confirmLabel}
      cancelLabel={t('Voltar')}
      onConfirm={() => m.mutate(undefined, { onSuccess: () => { toast.success(aprovar ? t('Torneio chancelado. O organizador foi avisado.') : t('Decisão gravada. O organizador foi avisado.')); onClose(); }, onError: (er) => setErro(er.message) })}
    >
      <div className="space-y-4">
        {aprovar ? (
          <>
            <V2Field label={t('Categoria do torneio')} htmlFor="ch-tier" hint={fedModuleOn(federation, 'ranking') ? t('Os pontos do ranking saem da tabela desta categoria. As categorias se configuram em Competições → Ranking.') : t('As categorias se configuram em Competições → Categorias.')}>
              <V2Select id="ch-tier" value={tier} onChange={(e) => setTier(e.target.value)} options={opcoes.map((o) => ({ value: o.id, label: tierLabel(o) }))} />
            </V2Field>
            <FedTierRequirements tier={escolhida} />
            <V2Toggle id="ch-origem" checked={daFederacao} onChange={setDaFederacao} label={t('Torneio realizado pela própria federação')} hint={t('O selo diz "Realizado pela" em vez de "Chancelado". Desligado, o torneio é de um organizador e a federação só o autoriza.')} />
            <V2Toggle id="ch-filiados" checked={soFiliados} onChange={setSoFiliados} label={t('Só filiados em dia se inscrevem')} hint={t('A inscrição de quem não está em dia nesta federação é recusada.')} />
            {erro && <p className="text-sm text-red-600" role="alert">{erro}</p>}
          </>
        ) : (
          <V2Field label={t('Motivo')} htmlFor="ch-motivo" error={erro} hint={t('Quem organiza lê este texto. Mínimo 3 caracteres.')}>
            <V2Textarea id="ch-motivo" rows={3} maxLength={500} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro(''); }} />
          </V2Field>
        )}
      </div>
    </ConfirmDialog>
  );
}

/**
 * A taxa de chancela do pedido: aberta trava o "Chancelar" (o financeiro
 * confirma o Pix ou dispensa); `fee` indefinido = não carregou, e aí não trava
 * nem afirma nada. Sem taxa na categoria, `none`.
 */
function estadoDaTaxa(s, fee) {
  if (!(s.fee_cents > 0)) return 'none';
  if (s.fee_paid_at_ms || fee?.status === 'paid') return 'paid';
  if (s.fee_cancelled_at_ms || fee?.status === 'cancelled') return 'waived';
  return fee === undefined ? 'unknown' : 'open';
}

function TorneioRow({ tournament: tt, federation, fee, report }) {
  const [acao, setAcao] = useState(null);
  const [vendoRelatorio, setVendoRelatorio] = useState(false);
  const [final, setFinal] = useState(false);
  const st = sanctionState(tt);
  const s = tt.federation_sanction || {};
  const taxa = estadoDaTaxa(s, fee);
  const conferindo = st.pending && s.checked_at_ms !== s.requested_at_ms;
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-paper text-gray-500"><Trophy className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
              <Link to={`/torneios/${tt.id}`} className="hover:underline">{tt.name}</Link>
              <V2Badge tone={st.approved ? 'green' : st.pending ? 'amber' : 'red'}>{t(SANCTION_STATUS_LABELS[st.status] || st.status)}</V2Badge>
              {st.byFederation && <V2Badge tone="ink">{t('Da federação')}</V2Badge>}
              {st.approved && st.requiresMembership && <V2Badge tone="purple">{t('Só filiados')}</V2Badge>}
            </p>
            <p className="text-xs text-gray-500">
              {[tt.starts_at ? quando(tt.starts_at) : '', tt.city || tt.location, st.tierLabel].filter(Boolean).join(' · ')}
              {s.requested_at_ms ? ` · ${t('pedido em {data}', { data: quando(s.requested_at_ms) })}` : ''}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              {s.director_name && <span className="text-gray-600">{t('Diretor: {nome}', { nome: s.director_name })}</span>}
              {s.director_name && (s.director_verified ? <V2Badge tone="green">{t('Credenciado')}</V2Badge> : <V2Badge tone="neutral">{t('Sem credencial')}</V2Badge>)}
              {st.pending && typeof s.days_ahead === 'number' && <span className="text-gray-500">{tn(s.days_ahead, 'pedido {n} dia antes', 'pedido {n} dias antes')}</span>}
              {taxa === 'open' && <V2Badge tone="amber">{t('Taxa de {valor} aguardando pagamento', { valor: formatBrlCents(s.fee_cents) })}</V2Badge>}
              {taxa === 'paid' && <V2Badge tone="green">{t('Taxa paga')}</V2Badge>}
              {taxa === 'waived' && <V2Badge tone="neutral">{t('Taxa dispensada')}</V2Badge>}
              {st.approved && report && (
                <>
                  <V2Badge tone={report.checklist?.complete ? 'green' : 'amber'}>{report.checklist?.complete ? t('Checklist completo') : t('Checklist pendente')}</V2Badge>
                  <V2Badge tone={report.report ? 'green' : 'neutral'}>{report.report ? t('Relatório entregue') : t('Relatório pendente')}</V2Badge>
                </>
              )}
            </div>
            {s.prize && <div className="mt-2"><PrizeParityNote prize={s.prize} /></div>}
            {conferindo && <p className="mt-1 text-xs text-gray-500">{t('O servidor está conferindo prazo, diretor e taxa.')}</p>}
            {s.reason && !st.approved && <p className="mt-1 text-sm text-red-600">{t('Motivo: {motivo}', { motivo: s.reason })}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {st.pending && (
            <>
              <V2Button type="button" size="sm" disabled={taxa === 'open' || conferindo} title={taxa === 'open' ? t('Aguardando o pagamento da taxa. O financeiro confirma o Pix ou dispensa a taxa.') : undefined} onClick={() => setAcao('approve')}><CheckCircle2 className="h-4 w-4" />{t('Chancelar')}</V2Button>
              <V2Button type="button" size="sm" variant="danger" onClick={() => setAcao('reject')}><XCircle className="h-4 w-4" />{t('Recusar')}</V2Button>
            </>
          )}
          {st.approved && report && <V2Button type="button" size="sm" variant="ghost" onClick={() => setVendoRelatorio((v) => !v)}><FileText className="h-4 w-4" />{vendoRelatorio ? t('Fechar relatório') : t('Ver relatório')}</V2Button>}
          {st.approved && report && <V2Button type="button" size="sm" variant="ghost" onClick={() => setFinal(true)}><Medal className="h-4 w-4" />{t('Final do circuito')}</V2Button>}
          {st.approved && <V2Button type="button" size="sm" variant="danger" onClick={() => setAcao('revoke')}><Ban className="h-4 w-4" />{t('Revogar')}</V2Button>}
        </div>
        {taxa === 'open' && st.pending && <p className="text-xs text-gray-500">{t('O "Chancelar" libera quando o financeiro confirmar o Pix da taxa (ou dispensá-la) em Financeiro → Cobranças.')}</p>}
        {vendoRelatorio && report && <div className="border-t border-gray-100 pt-3"><DirectorReportForm report={report} readOnly /></div>}
      </V2Surface>
      {acao && <DecisaoDialog tournament={tt} federation={federation} acao={acao} onClose={() => setAcao(null)} />}
      {final && <FinalCircuitDialog tournament={tt} federation={federation} report={report} onClose={() => setFinal(false)} />}
    </li>
  );
}

const FILTROS_CHANCELA = ['todos', 'pendentes', 'chancelados'];
const CAMPOS_TORNEIO = (tt) => [tt.name, tt.city, tt.location].join(' ');

function ChancelasTab({ tournamentsQ, federation }) {
  const [filtro, setFiltro] = useFiltroNaUrl('filtro', 'todos', FILTROS_CHANCELA);
  const pendentes = useMemo(() => pendingSanctions(tournamentsQ.data || []), [tournamentsQ.data]);
  const chancelados = useMemo(() => sanctionedTournaments(tournamentsQ.data || []), [tournamentsQ.data]);
  const lista = useMemo(() => (filtro === 'pendentes' ? pendentes : filtro === 'chancelados' ? chancelados : [...pendentes, ...chancelados]), [filtro, pendentes, chancelados]);
  const busca = useBuscaLista(lista, CAMPOS_TORNEIO);
  // Taxas e relatórios são acessórios da linha: falhando, a linha segue sem eles (não trava o "Chancelar").
  const feesQ = useSanctionFees(federation?.id);
  const reportsQ = useFederationTournamentReports(federation?.id);
  const taxaDe = (tt) => (feesQ.isSuccess ? (feesQ.data || []).find((c) => c.id === tt.federation_sanction?.fee_charge_id) || null : undefined);
  const relatorioDe = (tt) => (reportsQ.data || []).find((r) => r.id === tt.id) || null;
  if (tournamentsQ.isError) return <V2ErrorState title={t('Não carregaram os torneios')} onRetry={() => tournamentsQ.refetch()} />;
  if (!tournamentsQ.isSuccess) return <V2Skeleton lines={5} />;
  // A busca e o "Mostrar mais" valem sobre a lista inteira; os grupos saem do que está visível.
  const visPendentes = busca.visiveis.filter((tt) => sanctionState(tt).pending);
  const visChancelados = busca.visiveis.filter((tt) => !sanctionState(tt).pending);
  const achPendentes = busca.filtrados.filter((tt) => sanctionState(tt).pending).length;
  const achChancelados = busca.filtrados.length - achPendentes;
  const buscando = Boolean(busca.termo.trim());
  const rotulos = { todos: t('Todos'), pendentes: t('Pendentes'), chancelados: t('Chancelados') };
  const contagem = { todos: pendentes.length + chancelados.length, pendentes: pendentes.length, chancelados: chancelados.length };
  return (
    <section className="space-y-6" aria-label={t('Chancelas')} data-dica="federacao-aba-chancelas">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="min-w-0 flex-1 text-sm text-gray-600">{t('O organizador pede a chancela em Gestão do torneio → Geral → Federação. Chancelado, o torneio ganha o selo, pode exigir filiação na inscrição e envia resultados ao ranking oficial. O torneio da própria federação nasce aqui e já sai chancelado.')}</p>
        {federation?.id && (
          <V2Button asChild size="sm" data-dica="federacao-criar-torneio">
            <Link to={`/torneios/criar?federacao=${federation.id}`}><Plus className="h-4 w-4" />{t('Criar torneio da federação')}</Link>
          </V2Button>
        )}
      </div>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">{FILTROS_CHANCELA.map((id) => <V2FilterChip key={id} active={filtro === id} onClick={() => setFiltro(id)}>{`${rotulos[id]} (${contagem[id]})`}</V2FilterChip>)}</div>
        {lista.length > 0 && <BuscaLista id="ch-busca" value={busca.termo} onChange={busca.setTermo} placeholder={t('Buscar torneio por nome ou cidade')} total={lista.length} achados={busca.filtrados.length} />}
      </div>
      {buscando && lista.length > 0 && !busca.filtrados.length && <V2EmptyState icon={Trophy} title={t('Nenhum torneio com esse termo')} />}
      {filtro !== 'chancelados' && !(buscando && !achPendentes) && (
        <div>
          <h3 className="mb-2 font-display text-lg font-bold text-ink">{tn(buscando ? achPendentes : pendentes.length, '{n} pedido aguardando', '{n} pedidos aguardando')}</h3>
          {pendentes.length === 0 ? <p className="text-sm text-gray-500">{t('Nenhum pedido de chancela aguardando.')}</p> : <ul className="space-y-3">{visPendentes.map((tt) => <TorneioRow key={tt.id} tournament={tt} federation={federation} fee={taxaDe(tt)} report={relatorioDe(tt)} />)}</ul>}
        </div>
      )}
      {filtro !== 'pendentes' && !(buscando && !achChancelados) && (visChancelados.length > 0 || chancelados.length === 0) && (
        <div>
          <h3 className="mb-2 font-display text-lg font-bold text-ink">{tn(buscando ? achChancelados : chancelados.length, '{n} torneio chancelado', '{n} torneios chancelados')}</h3>
          {chancelados.length === 0 ? <V2EmptyState icon={Trophy} title={t('Nenhum torneio chancelado ainda')} description={t('Os pedidos aprovados aparecem aqui.')} /> : <ul className="space-y-3">{visChancelados.map((tt) => <TorneioRow key={tt.id} tournament={tt} federation={federation} fee={taxaDe(tt)} report={relatorioDe(tt)} />)}</ul>}
        </div>
      )}
      <MostrarMais restam={busca.restam} onClick={busca.mostrarMais} />
    </section>
  );
}

/* ---------------------------------------------------------- resultados -- */

function ResultadoRow({ result: r }) {
  const { user } = useAuth();
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const m = useFederationMutation((acao) => reviewFederationResult(r, acao, { uid: user?.uid, reason: motivo }));
  const recusado = r.status === RESULT_STATUS.REJECTED;
  const fechado = seasonClosed(r.season);
  const podio = (r.rows || []).filter((x) => x.position && x.position <= 3).map((x) => `${x.position}º ${x.name}`).join(' · ');
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-2 p-4">
        <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
          <Link to={`/torneios/${r.tournament_id}`} className="hover:underline">{r.tournament_name}</Link>
          <span className="text-gray-500">·</span><span>{r.modality_name}</span>
          <V2Badge tone={recusado ? 'red' : 'green'}>{t(RESULT_STATUS_LABELS[r.status] || r.status)}</V2Badge>
        </p>
        <p className="text-xs text-gray-500">{[classeLabel(r), r.date ? quando(r.date) : '', r.tier_label || t(SANCTION_TIER_LABELS[r.tier] || '') || r.tier, tn((r.rows || []).length, '{n} atleta', '{n} atletas'), t('enviado em {data}', { data: quando(r.sent_at) })].filter(Boolean).join(' · ')}</p>
        {podio && <p className="text-sm text-gray-700">{podio}</p>}
        {recusado && r.review?.reason && <p className="text-sm text-red-600">{t('Motivo: {motivo}', { motivo: r.review.reason })}</p>}
        {fechado && <p className="flex items-center gap-1 text-xs text-gray-500"><Lock className="h-3.5 w-3.5" aria-hidden="true" />{t('Temporada {ano} encerrada: este resultado não muda mais.', { ano: r.season })}</p>}
        {!fechado && <div className="flex flex-wrap items-end gap-2">
          {!recusado && !recusando && <V2Button type="button" size="sm" variant="danger" onClick={() => setRecusando(true)}><XCircle className="h-4 w-4" />{t('Recusar')}</V2Button>}
          {!recusado && recusando && (
            <form className="flex w-full flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); m.mutate('reject', { onSuccess: () => { toast.success(t('Resultado recusado. O organizador foi avisado.')); setRecusando(false); }, onError: (er) => toast.error(er.message) }); }}>
              <V2Field label={t('Motivo')} htmlFor={`res-motivo-${r.id}`} hint={t('Quem organiza lê este texto. Os pontos saem do ranking na hora.')} className="flex-1"><V2Input id={`res-motivo-${r.id}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} autoFocus /></V2Field>
              <V2Button type="submit" size="sm" variant="danger" disabled={m.isPending || motivo.trim().length < 3}>{t('Recusar resultado')}</V2Button>
              <V2Button type="button" size="sm" variant="ghost" onClick={() => setRecusando(false)}>{t('Voltar')}</V2Button>
            </form>
          )}
          {recusado && <V2Button type="button" size="sm" variant="secondary" disabled={m.isPending} onClick={() => m.mutate('readmit', { onSuccess: () => toast.success(t('Resultado readmitido no ranking.')), onError: (er) => toast.error(er.message) })}><RotateCcw className="h-4 w-4" />{t('Readmitir')}</V2Button>}
        </div>}
      </V2Surface>
    </li>
  );
}

const CAMPOS_RESULTADO = (r) => [r.tournament_name, r.modality_name, ...(r.rows || []).filter((x) => x.position && x.position <= 3).map((x) => x.name)].join(' ');

function ResultadosTab({ resultsQ }) {
  const lista = useMemo(() => [...(resultsQ.data || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))), [resultsQ.data]);
  const busca = useBuscaLista(lista, CAMPOS_RESULTADO);
  if (resultsQ.isError) return <V2ErrorState title={t('Não carregaram os resultados')} onRetry={() => resultsQ.refetch()} />;
  if (!resultsQ.isSuccess) return <V2Skeleton lines={5} />;
  return (
    <section className="space-y-4" aria-label={t('Resultados')} data-dica="federacao-aba-resultados">
      <p className="text-sm text-gray-600">{t('Cada categoria encerrada de um torneio chancelado chega aqui quando o organizador envia, e os pontos de quem pontua são lançados no histórico de cada atleta. Recusar cancela esses lançamentos na hora (com o motivo); readmitir lança de novo. Depois de 31/01 do ano seguinte, o ano fecha e nada muda.')}</p>
      {lista.length === 0 ? <V2EmptyState icon={ClipboardList} title={t('Nenhum resultado enviado ainda')} description={t('O organizador envia na tela de resultados do torneio, categoria a categoria.')} /> : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <BuscaLista id="res-busca" value={busca.termo} onChange={busca.setTermo} placeholder={t('Buscar por torneio, categoria ou atleta do pódio')} total={lista.length} achados={busca.filtrados.length} className="flex-1" />
            {busca.filtrados.length > 0 && <V2Button type="button" size="sm" variant="secondary" data-dica="federacao-resultados-csv" onClick={() => baixarCsv(resultsCsv(busca.filtrados), 'resultados-federacao.csv')}><Download className="h-4 w-4" />{t('Baixar planilha (CSV)')}</V2Button>}
          </div>
          {!busca.filtrados.length ? <V2EmptyState icon={ClipboardList} title={t('Nenhum resultado com esse termo')} /> : <ul className="space-y-3">{busca.visiveis.map((r) => <ResultadoRow key={r.id} result={r} />)}</ul>}
          <MostrarMais restam={busca.restam} onClick={busca.mostrarMais} />
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------- ranking -- */

function RankingTab({ federation }) {
  const { user } = useAuth();
  const [salvo, setSalvo] = useState(() => normalizeRankingConfig(federation.ranking_config));
  const [cfg, setCfg] = useState(salvo);
  const [confirmando, setConfirmando] = useState(false);
  const alterado = JSON.stringify(cfg) !== JSON.stringify(salvo);
  useAvisoNaoSalvo(alterado);
  const m = useFederationMutation(() => updateRankingConfig(federation.id, cfg, { uid: user?.uid }));
  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const num = (v) => (v === '' ? 0 : Number(v));
  const proprias = cfg.tiers_explicit;
  // Só torneios ligados (sem ranking): a aba é "Categorias" — o que pontua no ranking fica guardado e some da tela.
  const comRanking = fedModuleOn(federation, 'ranking');
  // Os modelos da plataforma (Painel admin → Federações → Configuração): só um ponto de partida.
  const { tierTemplates } = useFederationPlatformSettings();
  // Sem categorias próprias, as três padrão saem da tabela e dos pesos que estão na tela (ao vivo).
  const categorias = proprias ? cfg.tiers : legacyTiers(cfg);
  const salvar = () => m.mutate(undefined, { onSuccess: () => { setSalvo(cfg); setConfirmando(false); toast.success(t('Pontuação salva. Vale para os próximos resultados enviados.')); }, onError: (er) => toast.error(er.message) });
  const pedirConfirmacao = (e) => {
    e.preventDefault();
    if (proprias) {
      const v = validateTiers(cfg.tiers);
      if (!v.ok) { toast.error(Object.values(v.erros)[0] || v.geral); return; }
    }
    setConfirmando(true);
  };
  return (
    <section className="space-y-6" aria-label={comRanking ? t('Ranking oficial') : t('Categorias de torneio')} data-dica="federacao-aba-ranking">
      <V2Surface className="space-y-4">
        <div>
          <h3 className="font-display text-lg font-bold text-ink">{comRanking ? t('Como o ranking pontua') : t('Categorias de torneio')}</h3>
          <p className="text-sm text-gray-500">{comRanking ? t('Cada resultado enviado lança os pontos no histórico do atleta com a tabela do dia; mudar a tabela vale para os próximos envios e não reescreve o que já foi lançado. O ano soma os lançamentos e fecha em 31/01 do ano seguinte: depois disso não muda mais.') : t('A sigla e o grupo de cada categoria aparecem no selo dos torneios chancelados e realizados pela federação. A tabela de pontos de cada categoria é a do ranking oficial, se o módulo Ranking for ligado.')}</p>
        </div>
        <form className="space-y-6" onSubmit={pedirConfirmacao}>
          <FedTiersEditor tiers={categorias} explicit={proprias} templates={tierTemplates} acronym={federation.acronym || ''} onChange={(lista) => set({ tiers: lista, tiers_explicit: lista.length > 0 })} />
          {!proprias && <>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">{t('Pontos por colocação')}</legend>
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
                <V2Field key={p} label={`${p}º`} htmlFor={`rk-p${p}`}>
                  <V2Input id={`rk-p${p}`} type="number" min={0} step={1} inputMode="numeric" value={cfg.points_by_place[p]} onChange={(e) => set({ points_by_place: { ...cfg.points_by_place, [p]: num(e.target.value) } })} />
                </V2Field>
              ))}
            </div>
          </fieldset>
          <V2Field label={t('Participação (fora dos 8)')} htmlFor="rk-part" hint={t('Para quem jogou e ficou do 9º em diante.')}><V2Input id="rk-part" type="number" min={0} inputMode="numeric" value={cfg.participation} onChange={(e) => set({ participation: num(e.target.value) })} className="sm:w-40" /></V2Field>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">{t('Peso por tipo de torneio')}</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {TIERS.map((o) => (
                <V2Field key={o.value} label={t(o.label)} htmlFor={`rk-t-${o.value}`}>
                  <V2Input id={`rk-t-${o.value}`} type="number" min={0} step={0.1} inputMode="decimal" value={cfg.tier_multipliers[o.value]} onChange={(e) => set({ tier_multipliers: { ...cfg.tier_multipliers, [o.value]: num(e.target.value) } })} />
                </V2Field>
              ))}
            </div>
          </fieldset>
          </>}
          {comRanking && <>
          <V2Field label={t('Melhores resultados que somam')} htmlFor="rk-best" hint={t('Por classe e temporada. 0 = todos somam. Mudar recalcula só o ano aberto.')}><V2Input id="rk-best" type="number" min={0} inputMode="numeric" value={cfg.best_n} onChange={(e) => set({ best_n: num(e.target.value) })} className="sm:w-40" /></V2Field>
          <V2Toggle id="rk-members" checked={cfg.members_only} onChange={(v) => set({ members_only: v })} label={t('Só filiados em dia pontuam')} hint={t('Conferido na data do torneio. Desligado, todo mundo que jogou pontua.')} />
          </>}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {alterado && <span className="text-sm text-gray-500" aria-live="polite">{t('Há mudanças não salvas.')}</span>}
            {alterado && <V2Button type="button" variant="ghost" onClick={() => setCfg(salvo)}>{t('Desfazer mudanças')}</V2Button>}
            <V2Button type="submit" disabled={m.isPending || !alterado}>{comRanking ? t('Salvar pontuação') : t('Salvar categorias')}</V2Button>
          </div>
        </form>
        <ConfirmDialog
          open={confirmando}
          onOpenChange={setConfirmando}
          loading={m.isPending}
          title={t('Salvar a nova pontuação?')}
          description={t('Os novos valores valem para os resultados enviados daqui em diante. Os pontos já lançados ficam como estão e os anos encerrados não mudam; só o "melhores resultados que somam" é aplicado de novo ao ano aberto.')}
          confirmLabel={t('Salvar pontuação')}
          cancelLabel={t('Voltar')}
          onConfirm={salvar}
        />
      </V2Surface>
      {comRanking && (
        <V2Surface>
          <FedRankingBlock federation={federation} meUid={user?.uid} exportavel />
        </V2Surface>
      )}
    </section>
  );
}

export default function FedCompetitionsPanel({ federation, tournamentsQ, resultsQ, tab }) {
  if (tab === 'resultados') return <ResultadosTab resultsQ={resultsQ} />;
  if (tab === 'ranking') return <RankingTab federation={federation} />;
  return <ChancelasTab tournamentsQ={tournamentsQ} federation={federation} />;
}

