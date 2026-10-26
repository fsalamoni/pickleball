/**
 * A VOTAÇÃO, passo a passo: um cargo por tela (chapas aceitas, em branco,
 * nulo) → revisão → confirmação → comprovante. O servidor grava a cédula
 * SEM o nome de quem votou e marca no colégio só que a pessoa votou — o
 * comprovante prova que o voto entrou, nunca em quem.
 */
import React, { useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { CANDIDACY_STATUS } from '@/modules/federations/domain/elections';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { V2Button, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { t, tk } from '@/core/i18n';
import { useScopedCandidacies, useScopedElectionAction } from './electionsScope';

const ESPECIAIS = [['blank', tk('Em branco')], ['null', tk('Nulo')]];

export default function VoteFlow({ federation, election: e, voter, onDone, onCancel }) {
  const chapasQ = useScopedCandidacies(federation, e.id);
  const acao = useScopedElectionAction(federation);
  const [passo, setPasso] = useState(0);
  const [escolhas, setEscolhas] = useState({});
  const [confirmar, setConfirmar] = useState(false);
  const [recibo, setRecibo] = useState(null);
  const [erro, setErro] = useState('');
  const cargos = e.positions || [];

  if (chapasQ.isError) return <V2ErrorState title={t('Não carregaram as chapas')} onRetry={chapasQ.refetch} />;
  if (chapasQ.isLoading) return <V2Skeleton lines={4} />;
  const aceitas = (chapasQ.data || []).filter((c) => c.status === CANDIDACY_STATUS.ACCEPTED);
  const opcoes = (p) => [...aceitas.filter((c) => c.position_id === p.id).map((c) => [c.id, c.name, c]), ...ESPECIAIS.map(([id, nome]) => [id, t(nome)])];
  const nomeDa = (p, id) => (opcoes(p).find(([op]) => op === id) || [])[1] || '—';

  if (recibo) {
    return (
      <V2Surface className="space-y-4 p-5 text-center sm:p-6" role="status">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-700" aria-hidden="true" />
        <h3 className="font-display text-xl text-ink">{t('Voto registrado')}</h3>
        <p className="text-sm text-gray-500">{t('Guarde o comprovante: ele prova que seu voto entrou na urna, mas não diz em quem você votou — isso ninguém sabe, nem a comissão.')}</p>
        <p className="font-mono text-2xl font-bold tracking-widest text-ink" data-dica="federacao-eleicao-comprovante">{recibo}</p>
        <V2Button type="button" onClick={() => onDone?.(recibo)}>{t('Concluir')}</V2Button>
      </V2Surface>
    );
  }

  const revisao = passo >= cargos.length;
  const p = cargos[passo];
  return (
    <V2Surface className="space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{revisao ? t('Revisão') : t('Cargo {n} de {total}', { n: passo + 1, total: cargos.length })}</p>
        <p className="flex items-center gap-1 text-xs text-gray-500"><Lock className="h-3.5 w-3.5" aria-hidden="true" />{t('Voto secreto · seu peso: {n}', { n: voter?.weight ?? '—' })}</p>
      </div>
      {!revisao ? (
        <fieldset className="space-y-2">
          <legend className="mb-2 font-display text-xl text-ink">{p.label}</legend>
          {opcoes(p).map(([id, nome, c]) => (
            <label key={id} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 ${escolhas[p.id] === id ? 'border-ink bg-acid/10' : 'border-gray-100 bg-white'}`}>
              <input type="radio" name={`voto-${p.id}`} value={id} className="mt-1 h-5 w-5" checked={escolhas[p.id] === id} onChange={() => setEscolhas((x) => ({ ...x, [p.id]: id }))} />
              <span className="min-w-0">
                <span className={`block font-semibold ${c ? 'text-ink' : 'text-gray-500'}`}>{nome}</span>
                {c && <span className="block text-sm text-gray-500">{(c.members || []).map((m) => m.name).join(', ')}</span>}
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        <div className="space-y-2">
          <h3 className="font-display text-xl text-ink">{t('Confira seu voto')}</h3>
          <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
            {cargos.map((x, i) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="min-w-0"><span className="block text-xs text-gray-500">{x.label}</span><span className="block font-semibold text-ink">{nomeDa(x, escolhas[x.id])}</span></span>
                <V2Button type="button" size="sm" variant="ghost" onClick={() => setPasso(i)}>{t('Mudar')}</V2Button>
              </li>
            ))}
          </ul>
          {erro && <p className="text-sm font-semibold text-red-700" role="alert">{erro}</p>}
        </div>
      )}
      <div className="flex flex-wrap justify-between gap-2">
        <V2Button type="button" variant="ghost" onClick={() => (passo === 0 ? onCancel?.() : setPasso((n) => n - 1))}><ChevronLeft className="h-4 w-4" />{passo === 0 ? t('Cancelar') : t('Voltar')}</V2Button>
        {!revisao
          ? <V2Button type="button" disabled={!escolhas[p.id]} onClick={() => setPasso((n) => n + 1)}>{t('Avançar')}<ChevronRight className="h-4 w-4" /></V2Button>
          : <V2Button type="button" disabled={acao.isPending} onClick={() => setConfirmar(true)} data-dica="federacao-eleicao-confirmar-voto">{t('Confirmar voto')}</V2Button>}
      </div>
      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        title={t('Confirmar o voto?')}
        description={t('Depois de confirmado, o voto não pode ser mudado nem desfeito.')}
        confirmLabel={t('Votar')}
        cancelLabel={t('Voltar')}
        loading={acao.isPending}
        onConfirm={() => {
          setConfirmar(false);
          setErro('');
          acao.mutate({ federationId: federation.id, action: 'vote', electionId: e.id, voterId: voter?.id, choices: escolhas }, {
            onSuccess: (res) => setRecibo(res.receipt),
            onError: (er) => setErro(er.message),
          });
        }}
      />
    </V2Surface>
  );
}
