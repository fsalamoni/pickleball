/**
 * Aba DÚVIDAS: conversa PRIVADA entre o atleta e o professor (vínculo ativo).
 *
 * - Atleta: as dúvidas dele, "Nova dúvida" (também por `?nova=1&item=<id>`,
 *   já citando o item) e a conversa de cada uma.
 * - Professor: as dúvidas dos alunos, as que esperam resposta primeiro
 *   (`?parte=minhas` mostra as que ele mesmo fez aos professores dele).
 * - `?q=<id>` abre a conversa (é o link do aviso).
 *
 * Falha ≠ vazio: "nenhuma dúvida" só com a lista carregada; sem professor
 * ativo, a tela explica para onde vão as dúvidas.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight, GraduationCap, MessageCircleQuestion, Plus,
} from 'lucide-react';
import { useCoachTrainingQuestions, useMyTrainingQuestions } from '@/modules/training/hooks/useTrainingQuestions';
import { QUESTION_STATUS, QUESTION_STATUS_LABELS, sortQuestions } from '@/modules/training/domain/question';
import { podeAfirmarVazio } from '@/core/lib/queryState';
import {
  V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import QuestionThread from '@/v2/components/training/questions/QuestionThread';
import NewQuestionForm from '@/v2/components/training/questions/NewQuestionForm';
import { esperaPorMim, outroLado, quandoFoi } from '@/v2/components/training/questions/questionsView';

function Linha({ q, uid, onAbrir }) {
  const minhaVez = esperaPorMim(q, uid);
  const quando = quandoFoi(q.updated_at || q.created_at);
  return (
    <li>
      <button
        type="button"
        onClick={() => onAbrir(q)}
        className="flex w-full items-center gap-3 rounded-3xl border border-gray-100 bg-paper-pure p-4 text-left transition hover:border-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{q.subject}</p>
          <p className="truncate text-sm text-gray-500">
            {outroLado(q, uid)}{q.item_title ? ` · ${q.item_title}` : ''}{quando ? ` · ${quando}` : ''}
          </p>
        </div>
        <V2Badge tone={minhaVez ? 'acid' : q.status === QUESTION_STATUS.ENCERRADA ? 'neutral' : 'blue'} className="shrink-0">
          {minhaVez ? (q.coach_uid === uid ? 'Responder' : 'Nova resposta') : QUESTION_STATUS_LABELS[q.status]}
        </V2Badge>
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" aria-hidden="true" />
      </button>
    </li>
  );
}

function Lista({ consulta, uid, viewerIsCoach, vazio, onAbrir }) {
  if (consulta.isPending) return <V2Skeleton className="h-48 rounded-4xl" />;
  if (consulta.isError) {
    return <V2Surface><V2ErrorState title="As dúvidas não carregaram" onRetry={() => consulta.refetch()} /></V2Surface>;
  }
  const lista = sortQuestions(consulta.data || [], { viewerIsCoach });
  if (podeAfirmarVazio(consulta) && !lista.length) return vazio;
  return (
    <ul className="space-y-2" data-dica="treino-duvidas-lista">
      {lista.map((q) => <Linha key={q.id} q={q} uid={uid} onAbrir={onAbrir} />)}
    </ul>
  );
}

function SemProfessor() {
  return (
    <V2Surface>
      <V2EmptyState
        icon={GraduationCap}
        title="As dúvidas vão para o seu professor"
        description="Aqui você conversa em particular com um professor de quem é aluno. Quando um professor te adicionar como aluno e você aceitar, é só voltar aqui."
        action={<V2Button asChild variant="secondary"><Link to="/coaches">Encontrar professores</Link></V2Button>}
      />
    </V2Surface>
  );
}

export default function QuestionsTab({ identity, params, irPara }) {
  const minhas = useMyTrainingQuestions(identity.uid);
  const dosAlunos = useCoachTrainingQuestions(identity.uid, { enabled: identity.isCoach });
  const parte = identity.isCoach && params.get('parte') !== 'minhas' ? 'alunos' : 'minhas';
  const abertaId = params.get('q');
  const itemId = params.get('item');
  const [criando, setCriando] = useState(params.get('nova') === '1');

  const ir = (extra = {}) => irPara('duvidas', { parte: identity.isCoach ? parte : undefined, ...extra });
  const abrir = (q) => ir({ q: q.id });

  if (abertaId) {
    const todas = [...(minhas.data || []), ...(dosAlunos.data || [])];
    const q = todas.find((x) => x.id === abertaId);
    if (q) return <QuestionThread key={q.id} question={q} identity={identity} onVoltar={() => ir()} />;
    const carregando = minhas.isPending || (identity.isCoach && dosAlunos.isPending);
    const falhou = minhas.isError || (identity.isCoach && dosAlunos.isError);
    if (carregando) return <V2Skeleton className="h-72 rounded-4xl" />;
    if (falhou) {
      return (
        <V2Surface>
          <V2ErrorState title="A conversa não carregou" onRetry={() => { minhas.refetch(); if (identity.isCoach) dosAlunos.refetch(); }} />
        </V2Surface>
      );
    }
    return (
      <V2Surface>
        <V2EmptyState
          icon={MessageCircleQuestion}
          title="Esta conversa não está entre as suas"
          description="Ela pode ter sido apagada por quem perguntou."
          action={<V2Button variant="secondary" onClick={() => ir()}>Ver as dúvidas</V2Button>}
        />
      </V2Surface>
    );
  }

  const semProfessor = identity.coachReady && !identity.coachLinksError && identity.activeCoachIds.length === 0;
  const podePerguntar = identity.activeCoachIds.length > 0;

  return (
    <div className="space-y-5">
      {identity.isCoach && (
        <V2SubTabs
          tabs={[{ value: 'alunos', label: 'Dos meus alunos' }, { value: 'minhas', label: 'Minhas dúvidas' }]}
          activeValue={parte}
          onSelect={(t) => irPara('duvidas', { parte: t.value })}
          ariaLabel="Quais dúvidas"
        />
      )}

      {parte === 'alunos' ? (
        <>
          <p className="text-sm text-gray-500">As dúvidas dos seus alunos ativos. As que esperam a sua resposta vêm primeiro.</p>
          <Lista
            consulta={dosAlunos}
            uid={identity.uid}
            viewerIsCoach
            onAbrir={abrir}
            vazio={(
              <V2Surface>
                <V2EmptyState icon={MessageCircleQuestion} title="Nenhuma dúvida dos alunos" description="Quando um aluno perguntar algo, a conversa aparece aqui e você é avisado." />
              </V2Surface>
            )}
          />
        </>
      ) : (
        <>
          {identity.coachLinksError && (
            <V2ErrorState inline title="Os seus professores não carregaram" description="Ainda dá para ver as dúvidas já feitas; para fazer uma nova, tente de novo." />
          )}
          {criando && podePerguntar ? (
            <V2Surface className="space-y-4">
              <h2 className="font-display text-lg font-bold text-ink">Nova dúvida</h2>
              <NewQuestionForm
                identity={identity}
                itemId={itemId}
                onCriada={(id) => { setCriando(false); ir({ q: id }); }}
                onCancelar={() => { setCriando(false); if (params.get('nova')) ir(); }}
              />
            </V2Surface>
          ) : podePerguntar && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-xl text-sm text-gray-500">Pergunte ao seu professor sobre um drill, um golpe ou o seu treino. Só vocês dois veem a conversa.</p>
              <V2Button onClick={() => setCriando(true)} data-dica="treino-duvidas-nova">
                <Plus className="h-4 w-4" aria-hidden="true" /> Nova dúvida
              </V2Button>
            </div>
          )}
          {semProfessor && !(minhas.data || []).length ? (
            <SemProfessor />
          ) : (
            <Lista
              consulta={minhas}
              uid={identity.uid}
              viewerIsCoach={false}
              onAbrir={abrir}
              vazio={criando ? null : (
                <V2Surface>
                  <V2EmptyState icon={MessageCircleQuestion} title="Nenhuma dúvida ainda" description="Quando você perguntar algo ao professor, a conversa fica aqui." />
                </V2Surface>
              )}
            />
          )}
          {semProfessor && (minhas.data || []).length > 0 && (
            <p className="text-sm text-gray-500">Você não tem professor ativo agora: dá para ler as conversas, mas não para começar uma nova.</p>
          )}
        </>
      )}
    </div>
  );
}
