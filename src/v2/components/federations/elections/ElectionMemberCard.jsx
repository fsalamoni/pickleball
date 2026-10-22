/**
 * O que a PESSOA faz numa eleição: votar (com o peso e o comprovante),
 * registrar chapa, acompanhar e retirar as próprias chapas, apresentar
 * defesa e compartilhar o link de apoio. "Só você vê" — nada disto é público.
 */
import React, { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Lock, Vote } from 'lucide-react';
import {
  CANDIDACY_STATUS, CATEGORY_LABEL, REASON_MIN, STATUS, votingClosesMs, windowOpen,
} from '@/modules/federations/domain/elections';
import { useElectionAction, useMyCandidacies, useMyElectionVoters } from '@/modules/federations/hooks/useElections';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { V2Button, V2ErrorState, V2Field, V2Skeleton, V2Surface, V2Textarea } from '@/v2/ui/primitives';
import { useClipboard } from '@/core/lib/useClipboard';
import { t } from '@/core/i18n';
import { CandidacyCard, hojeBr } from './electionsUi';
import CandidacyDialog from './CandidacyDialog';
import VoteFlow from './VoteFlow';

const VIVAS = [CANDIDACY_STATUS.SUBMITTED, CANDIDACY_STATUS.ACCEPTED, CANDIDACY_STATUS.CHALLENGED];

/** O link que a chapa compartilha para pedir apoio (no app: apoiar exige entrar). */
const linkDeApoio = (federation, e, c) => `${typeof window !== 'undefined' ? window.location.origin : ''}/federacoes/${encodeURIComponent(federation.id)}?aba=eleicoes&eleicao=${encodeURIComponent(e.id)}&apoiar=${encodeURIComponent(c.id)}`;

function Defesa({ federation, e, c, ch, acao }) {
  const [texto, setTexto] = useState('');
  return (
    <div className="w-full space-y-2 rounded-xl bg-gray-50 p-3">
      <p className="text-sm font-semibold text-ink">{t('Impugnação de {nome}', { nome: ch.by_name || '—' })}</p>
      <p className="whitespace-pre-line text-sm text-gray-600">{ch.reason}</p>
      {ch.defense ? <p className="text-sm text-gray-500"><span className="font-semibold text-ink">{t('Sua defesa:')}</span> {ch.defense}</p> : windowOpen(e, 'defense', hojeBr()) && (
        <>
          <V2Field label={t('Defesa')} htmlFor={`def-${c.id}-${ch.id}`} hint={t('Mínimo de {n} caracteres.', { n: REASON_MIN })}>
            <V2Textarea id={`def-${c.id}-${ch.id}`} rows={3} maxLength={2000} value={texto} onChange={(ev) => setTexto(ev.target.value)} />
          </V2Field>
          <V2Button type="button" size="sm" disabled={acao.isPending || texto.trim().length < REASON_MIN} onClick={() => acao.mutate({ federationId: federation.id, action: 'defend', electionId: e.id, candidacyId: c.id, challengeId: ch.id, defense: texto.trim() }, { onSuccess: () => toast.success(t('Defesa enviada.')), onError: (er) => toast.error(er.message) })}>{t('Enviar defesa')}</V2Button>
        </>
      )}
    </div>
  );
}

export default function ElectionMemberCard({ federation, election: e }) {
  const votersQ = useMyElectionVoters();
  const candsQ = useMyCandidacies();
  const acao = useElectionAction();
  const { copy: copiar } = useClipboard();
  const [votando, setVotando] = useState(null);
  const [registrar, setRegistrar] = useState(false);
  const [retirar, setRetirar] = useState(null);
  const hoje = hojeBr();

  if (votando) return <VoteFlow federation={federation} election={e} voter={votando} onCancel={() => setVotando(null)} onDone={() => setVotando(null)} />;
  const meusVotos = (votersQ.data || []).filter((v) => v.election_id === e.id);
  const minhas = (candsQ.data || []).filter((c) => c.election_id === e.id && c.status !== CANDIDACY_STATUS.WITHDRAWN);
  const votacaoAberta = e.status === STATUS.VOTING && e.mode !== 'presential' && Date.now() < votingClosesMs(e);
  const podeRegistrar = windowOpen(e, 'candidacy', hoje) && !minhas.some((c) => VIVAS.includes(c.status));

  return (
    <V2Surface className="space-y-4 p-5 sm:p-6" aria-labelledby={`el-meu-${e.id}`}>
      <div className="flex items-center justify-between gap-2">
        <h4 id={`el-meu-${e.id}`} className="font-display text-lg text-ink">{t('Sua participação')}</h4>
        <span className="flex items-center gap-1 text-xs text-gray-500"><Lock className="h-3.5 w-3.5" aria-hidden="true" />{t('Só você vê')}</span>
      </div>

      {[STATUS.VOTING, STATUS.COUNTING, STATUS.CLOSED].includes(e.status) && (
        votersQ.isError ? <V2ErrorState inline title={t('Não deu para conferir se você vota')} onRetry={votersQ.refetch} />
          : votersQ.isLoading ? <V2Skeleton lines={2} />
            : !meusVotos.length ? <p className="text-sm text-gray-500">{t('Você não está no colégio eleitoral desta eleição (ele foi fechado na abertura da votação).')}</p>
              : (
                <ul className="space-y-2">
                  {meusVotos.map((v) => (
                    <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 px-4 py-3">
                      <span className="min-w-0 text-sm">
                        <span className="block font-semibold text-ink">{v.kind === 'person' ? t('Seu voto') : t('Voto de {org}', { org: v.name || '—' })}</span>
                        <span className="block text-gray-500">{t(CATEGORY_LABEL[v.category] || '')} · {t('peso {n}', { n: v.weight })}</span>
                        {v.voted_at_ms && <span className="block text-gray-500">{v.channel === 'presential' ? t('Votou na mesa presencial.') : t('Votou. Comprovante: {codigo}', { codigo: v.receipt || '—' })}</span>}
                      </span>
                      {!v.voted_at_ms && votacaoAberta && <V2Button type="button" onClick={() => setVotando(v)} data-dica="federacao-eleicao-votar"><Vote className="h-4 w-4" />{t('Votar')}</V2Button>}
                    </li>
                  ))}
                </ul>
              )
      )}
      {e.status === STATUS.PUBLISHED && (
        <p className="text-sm text-gray-500">
          {e.college?.min_months > 0
            ? t('Vota quem estiver com a filiação em dia, ativa há ao menos {n} meses e sem suspensão quando a votação abrir.', { n: e.college.min_months })
            : t('Vota quem estiver com a filiação em dia e sem suspensão quando a votação abrir.')}
        </p>
      )}

      {candsQ.isError ? <V2ErrorState inline title={t('Não carregaram as suas chapas')} onRetry={candsQ.refetch} /> : minhas.map((c) => (
        <CandidacyCard key={c.id} c={c} position={(e.positions || []).find((p) => p.id === c.position_id)} showStatus>
          {c.status === CANDIDACY_STATUS.SUBMITTED && e.endorsements_needed > 0 && (
            <div className="w-full space-y-1">
              <p className="text-sm text-gray-500">{t('Apoios: {n} de {m}. Compartilhe o link com filiados em dia.', { n: c.endorsement_count || 0, m: e.endorsements_needed })}</p>
              <V2Button type="button" size="sm" variant="ghost" onClick={() => copiar(linkDeApoio(federation, e, c), t('Link de apoio copiado.'))}><Copy className="h-4 w-4" />{t('Copiar link de apoio')}</V2Button>
            </div>
          )}
          {c.status === CANDIDACY_STATUS.REJECTED && c.review?.reason && <p className="w-full text-sm text-gray-500">{t('Motivo: {motivo}', { motivo: c.review.reason })}</p>}
          {(c.challenges || []).filter((ch) => !ch.decision).map((ch) => <Defesa key={ch.id} federation={federation} e={e} c={c} ch={ch} acao={acao} />)}
          {VIVAS.includes(c.status) && e.status === STATUS.PUBLISHED && <V2Button type="button" size="sm" variant="ghost" onClick={() => setRetirar(c)}>{t('Retirar a chapa')}</V2Button>}
        </CandidacyCard>
      ))}

      {podeRegistrar && <V2Button type="button" variant="secondary" onClick={() => setRegistrar(true)}>{t('Registrar chapa')}</V2Button>}
      <CandidacyDialog federation={federation} election={e} open={registrar} onClose={() => setRegistrar(false)} />
      <ConfirmDialog
        open={Boolean(retirar)}
        onOpenChange={(o) => { if (!o) setRetirar(null); }}
        destructive
        title={t('Retirar a chapa?')}
        description={t('A chapa sai da eleição e não volta. Os apoios recebidos não passam para outra chapa.')}
        confirmLabel={t('Retirar')}
        cancelLabel={t('Voltar')}
        loading={acao.isPending}
        onConfirm={() => { const c = retirar; setRetirar(null); acao.mutate({ federationId: federation.id, action: 'candidacy_withdraw', electionId: e.id, candidacyId: c.id }, { onSuccess: () => toast.success(t('Chapa retirada.')), onError: (er) => toast.error(er.message) }); }}
      />
    </V2Surface>
  );
}
