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
import { Ban, CheckCircle2, ClipboardList, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { decideSanction, reviewFederationResult, updateRankingConfig } from '@/modules/federations/services/federationService';
import { useFederationMutation } from '@/modules/federations/hooks/useFederations';
import { pendingSanctions, sanctionState, sanctionedTournaments } from '@/modules/federations/domain/sanction';
import { normalizeRankingConfig } from '@/modules/federations/domain/officialRanking';
import { RESULT_STATUS, RESULT_STATUS_LABELS, SANCTION_STATUS_LABELS, SANCTION_TIER, SANCTION_TIER_LABELS } from '@/modules/federations/domain/constants';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { t, tn } from '@/core/i18n';
import { FedRankingBlock, classeLabel } from '../FedPublicBlocks';
import { quando } from '../federationUi';

const TIERS = Object.values(SANCTION_TIER).map((v) => ({ value: v, label: SANCTION_TIER_LABELS[v] }));

/* ----------------------------------------------------------- chancelas -- */

function DecisaoDialog({ tournament, acao, onClose }) {
  const { user } = useAuth();
  const st = sanctionState(tournament);
  const [tier, setTier] = useState(st.tier);
  const [soFiliados, setSoFiliados] = useState(st.requiresMembership);
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState('');
  const m = useFederationMutation(() => decideSanction(tournament, acao, { uid: user?.uid, reason: motivo, tier, requiresMembership: soFiliados }));
  const aprovar = acao === 'approve';
  const titulos = { approve: t('Chancelar o torneio'), reject: t('Recusar a chancela'), revoke: t('Revogar a chancela') };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-md">
        <DialogTitle>{titulos[acao]}</DialogTitle>
        <DialogDescription>{tournament.name}. {aprovar ? t('O torneio ganha o selo da federação e passa a enviar resultados ao ranking oficial.') : t('Quem organiza lê o motivo.')}</DialogDescription>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(undefined, { onSuccess: () => { toast.success(aprovar ? t('Torneio chancelado. O organizador foi avisado.') : t('Decisão gravada. O organizador foi avisado.')); onClose(); }, onError: (er) => setErro(er.message) }); }}>
          {aprovar && (
            <>
              <V2Field label={t('Peso no ranking')} htmlFor="ch-tier" hint={t('Multiplica os pontos da tabela: regional ×1, estadual ×1,5, principal ×2 (ajustável em Ranking).')}>
                <V2Select id="ch-tier" value={tier} onChange={(e) => setTier(e.target.value)} options={TIERS.map((o) => ({ value: o.value, label: t(o.label) }))} />
              </V2Field>
              <V2Toggle id="ch-filiados" checked={soFiliados} onChange={setSoFiliados} label={t('Só filiados em dia se inscrevem')} hint={t('A regra do banco recusa a inscrição de quem não está em dia nesta federação.')} />
            </>
          )}
          {!aprovar && (
            <V2Field label={t('Motivo')} htmlFor="ch-motivo" error={erro}>
              <V2Textarea id="ch-motivo" rows={3} maxLength={500} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro(''); }} autoFocus />
            </V2Field>
          )}
          {aprovar && erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2">
            <V2Button type="button" variant="ghost" onClick={onClose}>{t('Voltar')}</V2Button>
            <V2Button type="submit" variant={aprovar ? 'primary' : 'danger'} disabled={m.isPending}>{aprovar ? t('Chancelar') : acao === 'reject' ? t('Recusar') : t('Revogar')}</V2Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TorneioRow({ tournament: tt }) {
  const [acao, setAcao] = useState(null);
  const st = sanctionState(tt);
  const s = tt.federation_sanction || {};
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-paper text-gray-500"><Trophy className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
              <Link to={`/torneios/${tt.id}`} className="hover:underline">{tt.name}</Link>
              <V2Badge tone={st.approved ? 'green' : st.pending ? 'amber' : 'red'}>{t(SANCTION_STATUS_LABELS[st.status] || st.status)}</V2Badge>
              {st.approved && st.requiresMembership && <V2Badge tone="purple">{t('Só filiados')}</V2Badge>}
            </p>
            <p className="text-xs text-gray-500">
              {[tt.starts_at ? quando(tt.starts_at) : '', tt.city || tt.location, t(SANCTION_TIER_LABELS[st.tier] || SANCTION_TIER_LABELS.regional)].filter(Boolean).join(' · ')}
              {s.requested_at_ms ? ` · ${t('pedido em {data}', { data: quando(s.requested_at_ms) })}` : ''}
            </p>
            {s.reason && !st.approved && <p className="mt-1 text-sm text-red-600">{t('Motivo: {motivo}', { motivo: s.reason })}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {st.pending && (
            <>
              <V2Button type="button" size="sm" onClick={() => setAcao('approve')}><CheckCircle2 className="h-4 w-4" />{t('Chancelar')}</V2Button>
              <V2Button type="button" size="sm" variant="danger" onClick={() => setAcao('reject')}><XCircle className="h-4 w-4" />{t('Recusar')}</V2Button>
            </>
          )}
          {st.approved && <V2Button type="button" size="sm" variant="danger" onClick={() => setAcao('revoke')}><Ban className="h-4 w-4" />{t('Revogar')}</V2Button>}
        </div>
      </V2Surface>
      {acao && <DecisaoDialog tournament={tt} acao={acao} onClose={() => setAcao(null)} />}
    </li>
  );
}

function ChancelasTab({ tournamentsQ }) {
  const pendentes = useMemo(() => pendingSanctions(tournamentsQ.data || []), [tournamentsQ.data]);
  const chancelados = useMemo(() => sanctionedTournaments(tournamentsQ.data || []), [tournamentsQ.data]);
  if (tournamentsQ.isError) return <V2ErrorState title={t('Não carregaram os torneios')} onRetry={() => tournamentsQ.refetch()} />;
  if (!tournamentsQ.isSuccess) return <V2Skeleton lines={5} />;
  return (
    <section className="space-y-6" aria-label={t('Chancelas')} data-dica="federacao-aba-chancelas">
      <p className="text-sm text-gray-600">{t('O organizador pede a chancela em Gestão do torneio → Geral → Federação. Chancelado, o torneio ganha o selo, pode exigir filiação na inscrição e envia resultados ao ranking oficial.')}</p>
      <div>
        <h3 className="mb-2 font-display text-lg font-bold text-ink">{tn(pendentes.length, '{n} pedido aguardando', '{n} pedidos aguardando')}</h3>
        {pendentes.length === 0 ? <p className="text-sm text-gray-500">{t('Nenhum pedido de chancela aguardando.')}</p> : <ul className="space-y-3">{pendentes.map((tt) => <TorneioRow key={tt.id} tournament={tt} />)}</ul>}
      </div>
      <div>
        <h3 className="mb-2 font-display text-lg font-bold text-ink">{tn(chancelados.length, '{n} torneio chancelado', '{n} torneios chancelados')}</h3>
        {chancelados.length === 0 ? <V2EmptyState icon={Trophy} title={t('Nenhum torneio chancelado ainda')} /> : <ul className="space-y-3">{chancelados.map((tt) => <TorneioRow key={tt.id} tournament={tt} />)}</ul>}
      </div>
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
  const podio = (r.rows || []).filter((x) => x.position && x.position <= 3).map((x) => `${x.position}º ${x.name}`).join(' · ');
  return (
    <li>
      <V2Surface variant="compacto" className="space-y-2 p-4">
        <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
          <Link to={`/torneios/${r.tournament_id}`} className="hover:underline">{r.tournament_name}</Link>
          <span className="text-gray-500">·</span><span>{r.modality_name}</span>
          <V2Badge tone={recusado ? 'red' : 'green'}>{t(RESULT_STATUS_LABELS[r.status] || r.status)}</V2Badge>
        </p>
        <p className="text-xs text-gray-500">{[classeLabel(r), r.date ? quando(r.date) : '', t(SANCTION_TIER_LABELS[r.tier] || SANCTION_TIER_LABELS.regional), tn((r.rows || []).length, '{n} atleta', '{n} atletas'), t('enviado em {data}', { data: quando(r.sent_at) })].filter(Boolean).join(' · ')}</p>
        {podio && <p className="text-sm text-gray-700">{podio}</p>}
        {recusado && r.review?.reason && <p className="text-sm text-red-600">{t('Motivo: {motivo}', { motivo: r.review.reason })}</p>}
        <div className="flex flex-wrap items-end gap-2">
          {!recusado && !recusando && <V2Button type="button" size="sm" variant="danger" onClick={() => setRecusando(true)}><XCircle className="h-4 w-4" />{t('Recusar')}</V2Button>}
          {!recusado && recusando && (
            <form className="flex w-full flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); m.mutate('reject', { onSuccess: () => { toast.success(t('Resultado recusado. O organizador foi avisado.')); setRecusando(false); }, onError: (er) => toast.error(er.message) }); }}>
              <V2Field label={t('Motivo')} htmlFor={`res-motivo-${r.id}`} className="flex-1"><V2Input id={`res-motivo-${r.id}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={500} autoFocus /></V2Field>
              <V2Button type="submit" size="sm" variant="danger" disabled={m.isPending}>{t('Confirmar')}</V2Button>
              <V2Button type="button" size="sm" variant="ghost" onClick={() => setRecusando(false)}>{t('Voltar')}</V2Button>
            </form>
          )}
          {recusado && <V2Button type="button" size="sm" variant="secondary" disabled={m.isPending} onClick={() => m.mutate('readmit', { onSuccess: () => toast.success(t('Resultado readmitido no ranking.')), onError: (er) => toast.error(er.message) })}><RotateCcw className="h-4 w-4" />{t('Readmitir')}</V2Button>}
        </div>
      </V2Surface>
    </li>
  );
}

function ResultadosTab({ resultsQ }) {
  if (resultsQ.isError) return <V2ErrorState title={t('Não carregaram os resultados')} onRetry={() => resultsQ.refetch()} />;
  if (!resultsQ.isSuccess) return <V2Skeleton lines={5} />;
  const lista = [...(resultsQ.data || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return (
    <section className="space-y-4" aria-label={t('Resultados')} data-dica="federacao-aba-resultados">
      <p className="text-sm text-gray-600">{t('Cada categoria encerrada de um torneio chancelado chega aqui quando o organizador envia. Recusar tira os pontos do ranking na hora; readmitir devolve.')}</p>
      {lista.length === 0 ? <V2EmptyState icon={ClipboardList} title={t('Nenhum resultado enviado ainda')} description={t('O organizador envia na tela de resultados do torneio, categoria a categoria.')} /> : <ul className="space-y-3">{lista.map((r) => <ResultadoRow key={r.id} result={r} />)}</ul>}
    </section>
  );
}

/* ------------------------------------------------------------- ranking -- */

function RankingTab({ federation }) {
  const { user } = useAuth();
  const [cfg, setCfg] = useState(() => normalizeRankingConfig(federation.ranking_config));
  const m = useFederationMutation(() => updateRankingConfig(federation.id, cfg, { uid: user?.uid }));
  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const num = (v) => (v === '' ? 0 : Number(v));
  return (
    <section className="space-y-6" aria-label={t('Ranking oficial')} data-dica="federacao-aba-ranking">
      <V2Surface className="space-y-4">
        <div>
          <h3 className="font-display text-lg font-bold text-ink">{t('Como o ranking pontua')}</h3>
          <p className="text-sm text-gray-500">{t('Mudou? O servidor refaz todas as temporadas na hora. Os valores valem para toda classe.')}</p>
        </div>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); m.mutate(undefined, { onSuccess: () => toast.success(t('Pontuação salva. O ranking está sendo refeito.')), onError: (er) => toast.error(er.message) }); }}>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <V2Field label={t('Participação (fora dos 8)')} htmlFor="rk-part" hint={t('Para quem jogou e ficou do 9º em diante.')}><V2Input id="rk-part" type="number" min={0} inputMode="numeric" value={cfg.participation} onChange={(e) => set({ participation: num(e.target.value) })} /></V2Field>
            <V2Field label={t('Melhores resultados que somam')} htmlFor="rk-best" hint={t('Por classe e temporada. 0 = todos somam.')}><V2Input id="rk-best" type="number" min={0} inputMode="numeric" value={cfg.best_n} onChange={(e) => set({ best_n: num(e.target.value) })} /></V2Field>
          </div>
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
          <V2Toggle id="rk-members" checked={cfg.members_only} onChange={(v) => set({ members_only: v })} label={t('Só filiados em dia pontuam')} hint={t('Conferido na data do torneio. Desligado, todo mundo que jogou pontua.')} />
          <div className="flex justify-end"><V2Button type="submit" disabled={m.isPending}>{t('Salvar pontuação')}</V2Button></div>
        </form>
      </V2Surface>
      <V2Surface>
        <FedRankingBlock federation={federation} meUid={user?.uid} />
      </V2Surface>
    </section>
  );
}

export default function FedCompetitionsPanel({ federation, tournamentsQ, resultsQ, tab }) {
  if (tab === 'resultados') return <ResultadosTab resultsQ={resultsQ} />;
  if (tab === 'ranking') return <RankingTab federation={federation} />;
  return <ChancelasTab tournamentsQ={tournamentsQ} />;
}

