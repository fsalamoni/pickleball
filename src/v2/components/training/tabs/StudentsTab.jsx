/**
 * Aba ALUNOS (só professor): por aluno ATIVO, as sessões que ele mostrou ao
 * professor (confirmar que viu e conversar sobre elas) e os itens enviados a
 * ele, com prazo e feito/não feito. Convidados aparecem como pendentes, sem
 * dados — só depois de aceitar o vínculo vale.
 *
 * Falha ≠ vazio: cada parte que não carregou diz que não carregou.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  BadgeCheck, ChevronDown, Library, MessageCircle, Users,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useCoachStudents } from '@/modules/coaches/hooks/useStudents';
import { useSessionActions, useStudentTrainingSessions } from '@/modules/training/hooks/useTrainingSessions';
import { useTrainingSent } from '@/modules/training/hooks/useTrainingShares';
import { SESSION_KIND_LABELS } from '@/modules/training/domain/session';
import { dueLabel } from '@/modules/training/domain/share';
import { rpeLabel } from '@/modules/training/domain/taxonomy';
import { formatDayLabel, todayLocal } from '@/modules/training/domain/dates';
import { podeAfirmarVazio } from '@/core/lib/queryState';
import {
  V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import SessionComments from '@/v2/components/training/SessionComments';
import { mensagemDeErro } from '@/v2/components/training/item/ItemActionDialogs';
import { rosterForTraining, studentsOverview } from '@/v2/components/training/students/studentsView';

const SESSOES_POR_ALUNO = 10;

function SessaoDoAluno({ s, identity, acoes, hoje }) {
  const [conversa, setConversa] = useState(false);
  return (
    <li className="space-y-2 rounded-3xl bg-gray-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{formatDayLabel(s.date, hoje)} · {SESSION_KIND_LABELS[s.kind] || 'Treino'}</p>
          <p className="font-semibold text-ink">{s.title}</p>
          <p className="text-sm text-gray-500">{s.duration_min} min{Number.isFinite(s.rpe) ? ` · esforço ${s.rpe} (${rpeLabel(s.rpe).toLowerCase()})` : ''}</p>
        </div>
        {s.coach_confirmed_at ? (
          <V2Badge tone="green"><BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Você viu</V2Badge>
        ) : (
          <V2Button
            size="sm"
            variant="secondary"
            data-dica="treino-alunos-confirmar"
            disabled={acoes.confirm.isPending}
            onClick={() => acoes.confirm.mutate(s, {
              onSuccess: () => toast.success('Confirmado. O aluno é avisado.'),
              onError: (err) => toast.error(mensagemDeErro(err, 'Não foi possível confirmar agora.')),
            })}
          >
            <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Confirmar que vi
          </V2Button>
        )}
      </div>
      {s.notes && <p className="whitespace-pre-line text-sm text-gray-700">{s.notes}</p>}
      <V2Button size="sm" variant="ghost" aria-expanded={conversa} onClick={() => setConversa((c) => !c)}>
        <MessageCircle className="h-4 w-4" aria-hidden="true" /> {conversa ? 'Fechar a conversa' : 'Comentar'}
      </V2Button>
      {conversa && <SessionComments session={s} identity={identity} />}
    </li>
  );
}

function Aluno({ a, identity, acoes, hoje, sessoesOk, sessoesFalharam, enviosOk, enviosFalharam }) {
  const [aberto, setAberto] = useState(false);
  const nome = a.student.student_name || 'Aluno';
  const resumo = [
    sessoesOk && (a.thisWeek ? `${a.thisWeek} ${a.thisWeek === 1 ? 'treino' : 'treinos'} nesta semana` : 'sem treino nesta semana'),
    sessoesOk && a.toConfirm > 0 && `${a.toConfirm} para confirmar`,
    enviosOk && a.pending > 0 && `${a.pending} ${a.pending === 1 ? 'envio' : 'envios'} por fazer`,
  ].filter(Boolean).join(' · ');
  return (
    <li className="rounded-4xl border border-gray-100 bg-paper-pure">
      <button
        type="button"
        aria-expanded={aberto}
        onClick={() => setAberto((x) => !x)}
        className="flex w-full items-center gap-3 p-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ink rounded-4xl"
      >
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold text-ink">{nome}</p>
          {resumo && <p className="text-sm text-gray-500">{resumo}</p>}
        </div>
        {sessoesOk && a.toConfirm > 0 && <V2Badge tone="acid" className="shrink-0">{a.toConfirm} novo{a.toConfirm === 1 ? '' : 's'}</V2Badge>}
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-gray-400 transition-transform', aberto && 'rotate-180')} aria-hidden="true" />
      </button>
      {aberto && (
        <div className="space-y-5 border-t border-gray-100 p-5">
          <section className="space-y-2" aria-label={`Treinos de ${nome}`}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">Treinos que mostrou a você</h3>
            {!sessoesOk ? <p className="text-sm text-gray-500">{sessoesFalharam ? 'Não carregou.' : 'Carregando…'}</p>
              : a.sessions.length === 0 ? <p className="text-sm text-gray-500">Nenhum ainda. No diário, o aluno escolhe “Mostrar ao professor”.</p>
                : (
                  <ul className="space-y-2">
                    {a.sessions.slice(0, SESSOES_POR_ALUNO).map((s) => <SessaoDoAluno key={s.id} s={s} identity={identity} acoes={acoes} hoje={hoje} />)}
                  </ul>
                )}
          </section>
          <section className="space-y-2" aria-label={`Envios para ${nome}`}>
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">O que você enviou</h3>
            {!enviosOk ? <p className="text-sm text-gray-500">{enviosFalharam ? 'Não carregou.' : 'Carregando…'}</p>
              : a.sent.length === 0 ? <p className="text-sm text-gray-500">Nada enviado. Na ficha de um item, use “Enviar a alunos”.</p>
                : (
                  <ul className="space-y-1.5">
                    {a.sent.map((x) => (
                      <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-gray-50 px-3 py-2 text-sm">
                        <Link to={`/treino/item/${x.item_id}`} className="min-w-0 truncate font-semibold text-ink hover:underline">{x.item_title || 'Item'}</Link>
                        <span className="flex flex-wrap items-center gap-1.5">
                          {x.due_date && !x.done_at && <span className="text-xs text-gray-500">{dueLabel(x.due_date, hoje)}</span>}
                          <V2Badge tone={x.done_at ? 'green' : x.read_at ? 'blue' : 'neutral'}>{x.done_at ? 'Feito' : x.read_at ? 'Visto' : 'Não visto'}</V2Badge>
                        </span>
                        {x.done_note && <p className="w-full text-xs text-gray-600">“{x.done_note}”</p>}
                      </li>
                    ))}
                  </ul>
                )}
          </section>
        </div>
      )}
    </li>
  );
}

export default function StudentsTab({ identity, irPara }) {
  const hoje = todayLocal();
  const alunos = useCoachStudents(identity.uid);
  const { ativos, convidados } = useMemo(() => rosterForTraining(alunos.data || []), [alunos.data]);
  const ids = useMemo(() => ativos.map((s) => s.student_id), [ativos]);
  const sessoes = useStudentTrainingSessions(identity.uid, ids);
  const enviados = useTrainingSent(identity.uid);
  const acoes = useSessionActions(identity);
  // Sem alunos ativos a consulta de sessões nem sai: isso é "nenhuma", não "carregando".
  const sessoesOk = ids.length === 0 || sessoes.isSuccess;
  const enviosOk = enviados.isSuccess;
  const visao = useMemo(() => studentsOverview({
    ativos, sessions: sessoes.data?.items || [], sent: enviados.data || [], today: hoje,
  }), [ativos, sessoes.data, enviados.data, hoje]);

  if (alunos.isPending) return <V2Skeleton className="h-72 rounded-4xl" />;
  if (alunos.isError) {
    return <V2Surface><V2ErrorState title="Os seus alunos não carregaram" onRetry={() => alunos.refetch()} /></V2Surface>;
  }
  if (podeAfirmarVazio(alunos) && !ativos.length && !convidados.length) {
    return (
      <V2Surface>
        <V2EmptyState
          icon={Users}
          title="Você ainda não tem alunos"
          description="Adicione alunos no seu painel de professor. Quando eles aceitarem, aqui aparecem os treinos que mostrarem a você e o que você enviar."
          action={<V2Button asChild variant="secondary"><Link to="/aulas?aba=alunos">Abrir os meus alunos</Link></V2Button>}
        />
      </V2Surface>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {sessoesOk ? <><span className="font-semibold text-ink">{visao.treinaramNaSemana} de {ativos.length}</span> {ativos.length === 1 ? 'aluno treinou' : 'alunos treinaram'} nesta semana</>
            : sessoes.isError ? 'Os treinos dos alunos não carregaram' : 'Carregando os treinos dos alunos…'}
          {enviosOk && visao.enviosPendentes > 0 ? ` · ${visao.enviosPendentes} ${visao.enviosPendentes === 1 ? 'envio por fazer' : 'envios por fazer'}` : ''}
        </p>
        <V2Button variant="secondary" onClick={() => irPara('biblioteca')}>
          <Library className="h-4 w-4" aria-hidden="true" /> Enviar um item
        </V2Button>
      </div>

      {(sessoes.isError || sessoes.data?.incompleto) && (
        <V2ErrorState inline title="Parte dos treinos dos alunos não carregou" onRetry={() => sessoes.refetch()} />
      )}
      {enviados.isError && <V2ErrorState inline title="Os seus envios não carregaram" onRetry={() => enviados.refetch()} />}

      {ativos.length > 0 && (
        <ul className="space-y-3" data-dica="treino-alunos-lista">
          {visao.porAluno.map((a) => (
            <Aluno key={a.student.student_id} a={a} identity={identity} acoes={acoes} hoje={hoje} sessoesOk={sessoesOk} sessoesFalharam={sessoes.isError} enviosOk={enviosOk} enviosFalharam={enviados.isError} />
          ))}
        </ul>
      )}

      {convidados.length > 0 && (
        <section className="space-y-2" aria-label="Convidados">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">Convidados, ainda sem aceitar</h2>
          <ul className="flex flex-wrap gap-2">
            {convidados.map((s) => <li key={s.id}><V2Badge>{s.student_name || 'Convidado'}</V2Badge></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
