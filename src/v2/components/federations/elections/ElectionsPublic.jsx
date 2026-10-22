/**
 * A aba ELEIÇÕES da página da federação (`PROFILE_TAB.ELECTIONS`): o edital
 * (e o link do acervo), a linha do tempo, os cargos, as chapas aceitas, o
 * resultado e a ata. Para quem está logado, "Sua participação" (votar,
 * registrar chapa, defesa); para a comissão eleitoral, a área de conduzir;
 * e o pedido de apoio que chega pelo link da chapa (`?apoiar=&eleicao=`).
 */
import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { FileText, Gavel, HandHeart, Vote } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { CHALLENGE_MIN, STATUS, windowOpen } from '@/modules/federations/domain/elections';
import { docPublicPath } from '@/modules/federations/domain/acervo';
import { useCandidacyInfo, useElectionAction, useElectionCandidacies, useMyCommissionElections, usePublicElections } from '@/modules/federations/hooks/useElections';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { V2Button, V2EmptyState, V2ErrorState, V2Field, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { CandidacyCard, ElectionStatusBadge, ElectionTimeline, PositionLine, ResultChart, hojeBr } from './electionsUi';
import ElectionMemberCard from './ElectionMemberCard';
import ElectionConductPanel from './ElectionConductPanel';

const ENCERRADAS = [STATUS.CLOSED, STATUS.CANCELLED];

/** O pedido de apoio do link da chapa. */
function Apoio({ federation, eleicaoId, chapaId }) {
  const info = useCandidacyInfo(federation.id, eleicaoId, chapaId);
  const acao = useElectionAction();
  const [feito, setFeito] = useState(false);
  if (info.isLoading) return <V2Skeleton lines={2} />;
  if (info.isError) return <V2ErrorState inline title={t('Este link de apoio não abriu')} description={info.error?.message} onRetry={info.refetch} />;
  const c = info.data?.candidacy;
  if (!c) return null;
  return (
    <V2Surface className="space-y-3 p-5" data-dica="federacao-eleicao-apoio">
      <p className="flex items-center gap-2 font-display text-lg text-ink"><HandHeart className="h-5 w-5" aria-hidden="true" />{t('Apoiar a chapa "{nome}"', { nome: c.name })}</p>
      <p className="text-sm text-gray-500">{c.position} · {c.members.map((m) => m.name).join(', ')}</p>
      <p className="text-sm text-gray-500">{t('Apoios: {n} de {m}. O apoio só deixa a chapa concorrer — não é voto. Cada filiado apoia uma chapa por cargo.', { n: c.endorsement_count, m: c.endorsements_needed })}</p>
      {feito ? <p className="text-sm font-semibold text-green-800" role="status">{t('Apoio registrado. Obrigado!')}</p>
        : info.data.canEndorse
          ? <V2Button type="button" disabled={acao.isPending} onClick={() => acao.mutate({ federationId: federation.id, action: 'endorse', electionId: eleicaoId, candidacyId: chapaId }, { onSuccess: () => { setFeito(true); info.refetch(); }, onError: (er) => toast.error(er.message) })}>{t('Apoiar esta chapa')}</V2Button>
          : <p className="text-sm text-gray-500">{t('Esta chapa não recebe mais apoio (o prazo fechou ou ela já foi analisada).')}</p>}
    </V2Surface>
  );
}

function Chapas({ federation, e, meUid, podeImpugnar }) {
  const q = useElectionCandidacies(federation.id, e.id);
  const acao = useElectionAction();
  const [alvo, setAlvo] = useState(null);
  const [motivo, setMotivo] = useState('');
  if (q.isError) return <V2ErrorState inline title={t('Não carregaram as chapas')} onRetry={q.refetch} />;
  if (q.isLoading) return <V2Skeleton lines={2} />;
  if (!(q.data || []).length) return <p className="text-sm text-gray-500">{e.status === STATUS.PUBLISHED ? t('Nenhuma chapa aceita ainda. As chapas aparecem aqui depois que a comissão eleitoral aceita o registro.') : t('Nenhuma chapa concorreu.')}</p>;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {q.data.map((c) => (
        <CandidacyCard key={c.id} c={c} position={(e.positions || []).find((p) => p.id === c.position_id)}>
          {podeImpugnar && !(c.member_uids || []).includes(meUid) && (
            <V2Button type="button" size="sm" variant="ghost" onClick={() => setAlvo(c)}><Gavel className="h-4 w-4" />{t('Impugnar')}</V2Button>
          )}
        </CandidacyCard>
      ))}
      <ConfirmDialog
        open={Boolean(alvo)}
        onOpenChange={(o) => { if (!o) { setAlvo(null); setMotivo(''); } }}
        title={t('Impugnar a chapa "{nome}"?', { nome: alvo?.name || '' })}
        description={t('A impugnação fica registrada na chapa, com o seu nome e o motivo. A comissão eleitoral ouve a chapa antes de decidir.')}
        confirmLabel={t('Impugnar')}
        cancelLabel={t('Voltar')}
        loading={acao.isPending}
        confirmDisabled={motivo.trim().length < CHALLENGE_MIN}
        onConfirm={() => {
          const c = alvo;
          setAlvo(null);
          acao.mutate({ federationId: federation.id, action: 'challenge', electionId: e.id, candidacyId: c.id, reason: motivo.trim() }, { onSuccess: () => toast.success(t('Impugnação enviada à comissão.')), onError: (er) => toast.error(er.message) });
          setMotivo('');
        }}
      >
        <V2Field label={t('Motivo da impugnação')} htmlFor="el-impugnar" hint={t('Mínimo de {n} caracteres. Diga qual regra do edital ou do estatuto a chapa descumpre.', { n: CHALLENGE_MIN })}>
          <V2Textarea id="el-impugnar" rows={4} maxLength={2000} value={motivo} onChange={(ev) => setMotivo(ev.target.value)} />
        </V2Field>
      </ConfirmDialog>
    </div>
  );
}

function Eleicao({ federation, e, meUid, memberOf, conduz, appLink }) {
  const hoje = hojeBr();
  return (
    <article className="space-y-5" aria-labelledby={`el-${e.id}`}>
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2"><h3 id={`el-${e.id}`} className="font-display text-2xl text-ink">{e.title}</h3><ElectionStatusBadge e={e} hoje={hoje} /></div>
        {e.description && <p className="whitespace-pre-line text-sm text-gray-600">{e.description}</p>}
        <div className="flex flex-wrap gap-2">
          {e.notice_doc_id && <V2Button asChild size="sm" variant="ghost"><Link to={docPublicPath(federation, e.notice_doc_id)}><FileText className="h-4 w-4" />{t('Edital {codigo}', { codigo: e.notice_code || '' })}</Link></V2Button>}
          {e.minutes_doc_id && <V2Button asChild size="sm" variant="ghost"><Link to={docPublicPath(federation, e.minutes_doc_id)}><FileText className="h-4 w-4" />{t('Ata {codigo}', { codigo: e.minutes_code || '' })}</Link></V2Button>}
        </div>
        {!e.notice_doc_id && e.notice_text && (
          <details className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-ink">{t('Ler o edital')}</summary>
            <p className="whitespace-pre-line text-sm text-gray-600">{e.notice_text}</p>
          </details>
        )}
      </header>
      {e.status === STATUS.CANCELLED && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">{t('Eleição cancelada: {motivo}', { motivo: e.cancel_reason || '—' })}</p>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <ElectionTimeline e={e} hoje={hoje} />
          <div className="space-y-2">
            <h4 className="font-semibold text-ink">{t('Cargos')}</h4>
            {(e.positions || []).map((p) => <div key={p.id}><p className="font-medium text-ink">{p.label}</p><PositionLine p={p} /></div>)}
          </div>
        </div>
        <div className="space-y-5">
          {e.status === STATUS.CLOSED && <section className="space-y-2"><h4 className="font-semibold text-ink">{t('Resultado')}</h4><ResultChart results={e.results || []} /></section>}
          {meUid && !ENCERRADAS.includes(e.status) && <ElectionMemberCard federation={federation} election={e} />}
          {!meUid && appLink && !ENCERRADAS.includes(e.status) && (
            <V2Button asChild variant="secondary"><Link to={appLink}><Vote className="h-4 w-4" />{t('Votar e registrar chapa no app')}</Link></V2Button>
          )}
          {e.status !== STATUS.CANCELLED && (
            <section className="space-y-2">
              <h4 className="font-semibold text-ink">{t('Chapas')}</h4>
              <Chapas federation={federation} e={e} meUid={meUid} podeImpugnar={Boolean(meUid) && memberOf && windowOpen(e, 'challenge', hoje)} />
            </section>
          )}
        </div>
      </div>
      {conduz && (
        <section className="space-y-2" aria-label={t('Área da comissão eleitoral')}>
          <h4 className="font-display text-lg text-ink">{t('Área da comissão eleitoral')}</h4>
          <ElectionConductPanel federation={federation} election={e} canConduct />
        </section>
      )}
    </article>
  );
}

export default function ElectionsPublic({ federation, meUid = null, memberOf = false }) {
  const { isAuthenticated } = useAuth();
  const [params] = useSearchParams();
  const lista = usePublicElections(federation.id);
  const comissao = useMyCommissionElections({ enabled: Boolean(meUid) });
  const apoiar = params.get('apoiar');
  const eleicaoDoApoio = params.get('eleicao');
  // Na página pública (sem conta aqui), quem está logado age no app.
  const appLink = isAuthenticated && !meUid ? `/federacoes/${encodeURIComponent(federation.id)}?aba=eleicoes` : null;

  if (lista.isError) return <V2ErrorState title={t('Não carregaram as eleições')} onRetry={lista.refetch} />;
  if (lista.isLoading) return <V2Skeleton lines={5} />;
  const daComissao = (comissao.data || []).filter((e) => e.federation_id === federation.id && e.status !== STATUS.DRAFT);
  const porId = new Map([...(lista.data || []), ...daComissao].map((e) => [e.id, e]));
  const todas = [...porId.values()].sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));
  const atuais = todas.filter((e) => !ENCERRADAS.includes(e.status));
  const anteriores = todas.filter((e) => ENCERRADAS.includes(e.status));
  const conduz = (e) => Boolean(meUid) && (e.commission_uids || []).includes(meUid);
  const mostrar = (e) => <Eleicao key={e.id} federation={federation} e={e} meUid={meUid} memberOf={memberOf} conduz={conduz(e)} appLink={appLink} />;

  return (
    <div id="fed-eleicoes" className="space-y-8">
      {apoiar && eleicaoDoApoio && (meUid
        ? <Apoio federation={federation} eleicaoId={eleicaoDoApoio} chapaId={apoiar} />
        : <p className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-500">{t('Para apoiar a chapa, entre no app com a sua conta de filiado.')}</p>)}
      {!todas.length ? (
        <V2EmptyState icon={Vote} title={t('Nenhuma eleição publicada')} description={t('Quando a federação publicar um edital, o calendário, as chapas e o resultado aparecem aqui.')} />
      ) : (
        <>
          {atuais.map(mostrar)}
          {anteriores.length > 0 && (atuais.length ? (
            <details className="rounded-2xl border border-gray-100 bg-white px-4 py-3">
              <summary className="min-h-11 cursor-pointer py-2 font-semibold text-ink">{t('Eleições anteriores ({n})', { n: anteriores.length })}</summary>
              <div className="mt-4 space-y-8">{anteriores.map(mostrar)}</div>
            </details>
          ) : anteriores.map(mostrar))}
        </>
      )}
      {comissao.isError && <V2ErrorState inline title={t('Não deu para conferir se você está na comissão eleitoral')} onRetry={comissao.refetch} />}
    </div>
  );
}
