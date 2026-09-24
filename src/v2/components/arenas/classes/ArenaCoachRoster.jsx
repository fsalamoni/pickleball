/**
 * Os professores da arena — UMA lista (Central → Aulas → Professores).
 *
 * A arena tinha dois cadastros de professor sem ligação: os PARCEIROS da
 * plataforma (perfil de professor + parceria, em Equipe → Professores) e os
 * professores das AULAS (`arena_coaches`). O mesmo professor virava dois
 * registros, e quem olhava não sabia qual valia. Aqui eles se juntam pela
 * conta da pessoa (`mergeCoachRoster`), e cada cartão diz o que ela é:
 *
 * - **parceiro da plataforma** — com a parceria (ativa, pausada, aguardando);
 * - **dá aula aqui** — da casa (não paga comissão) ou parceiro (paga);
 * - parceiro que ainda não dá aula: **"Colocar nas aulas"**, um toque.
 *
 * Com o módulo de aulas DESLIGADO esta tela não aparece: Equipe →
 * Professores continua sendo só a de parceiros, idêntica ao que era.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { GraduationCap, Pencil, Plus, UserPlus } from 'lucide-react';
import {
  useArenaCoaches as useArenaPartnerCoaches,
} from '@/modules/coaches/hooks/useCoaches';
import {
  useArenaCoaches as useArenaClassCoaches, useCreateCoach,
} from '@/modules/arenas/hooks/useArenaV3';
import {
  arenaCoachFromPartner, mergeCoachRoster,
} from '@/modules/arenas/domain/coachRoster';
import { COACH_LEVEL, COACH_LEVEL_META } from '@/modules/arenas/domain/classes';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { AddPartner, PartnerCard } from '@/v2/pages/V2ArenaCoaches';
import ProfessorForm from './ProfessorForm';
import {
  V2Avatar, V2Badge, V2Button, V2EmptyState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';

function SelosDasAulas({ row }) {
  if (!row.arenaCoach) return null;
  if (row.arenaCoach.active === false) return <V2Badge tone="neutral">Fora das aulas</V2Badge>;
  return (
    <>
      <V2Badge tone="acid">Dá aula aqui</V2Badge>
      <V2Badge tone="neutral">{row.house ? 'Da casa' : 'Paga comissão'}</V2Badge>
    </>
  );
}

function AcoesDasAulas({ row, arenaId, onEditar }) {
  const habilitar = useCreateCoach();
  if (row.arenaCoach) {
    const c = row.arenaCoach;
    const nivel = COACH_LEVEL_META[c.level] || COACH_LEVEL_META[COACH_LEVEL.INTERMEDIATE];
    return (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper-pure px-3 py-2">
        <p className="text-xs text-gray-600">
          Nas aulas: {nivel.label}
          {Number(c.price_per_hour) > 0 ? ` · ${formatPrice(c.price_per_hour)}/h` : ''}
          {Number(c.sessions_given) > 0 ? ` · ${c.sessions_given} aula(s) dada(s)` : ''}
          {!c.user_id ? ' · sem conta vinculada (não vê a própria agenda)' : ''}
        </p>
        <V2Button size="sm" variant="ghost" onClick={() => onEditar(c)}>
          <Pencil className="mr-1 h-3.5 w-3.5" /> Editar nas aulas
        </V2Button>
      </div>
    );
  }
  if (row.canEnableClasses) {
    return (
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper-pure px-3 py-2">
        <p className="text-xs text-gray-600">Ainda não dá aula na agenda da arena.</p>
        <V2Button
          size="sm"
          variant="ghost"
          disabled={habilitar.isPending}
          onClick={() => habilitar.mutateAsync({ arenaId, input: arenaCoachFromPartner(row.partner) })
            .then(() => toast.success(`${row.name} já pode receber aulas na agenda.`))
            .catch((e) => toast.error(e?.message || 'Não foi possível.'))}
        >
          <UserPlus className="mr-1 h-3.5 w-3.5" /> Colocar nas aulas
        </V2Button>
      </div>
    );
  }
  if (row.partner && row.partnership === 'pending') {
    return (
      <p className="mt-2 text-xs text-gray-500">
        Quando o professor aceitar a parceria, dá para colocá-lo nas aulas.
      </p>
    );
  }
  return null;
}

/** Professor só das aulas (sem perfil de parceiro na plataforma). */
function CartaoSoDasAulas({ row, onEditar }) {
  const c = row.arenaCoach;
  return (
    <div className={`rounded-2xl border p-3 ${c.active === false ? 'border-gray-100 bg-gray-50 opacity-75' : 'border-gray-100 bg-paper'}`}>
      <div className="flex items-start gap-3">
        <V2Avatar photoUrl={c.photo_url} name={c.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-ink">{c.name}</p>
            <SelosDasAulas row={row} />
          </div>
          {c.bio && <p className="mt-1 text-sm leading-6 text-gray-600 line-clamp-2">{c.bio}</p>}
        </div>
      </div>
      <AcoesDasAulas row={row} arenaId={c.arena_id} onEditar={onEditar} />
    </div>
  );
}

export default function ArenaCoachRoster({ arena }) {
  const arenaId = arena.id;
  const parceirosQ = useArenaPartnerCoaches(arenaId, { activeOnly: false });
  const aulasQ = useArenaClassCoaches(arenaId, { onlyActive: false });
  const [vinculando, setVinculando] = useState(false);
  const [form, setForm] = useState(null);

  const parceiros = useMemo(() => parceirosQ.data || [], [parceirosQ.data]);
  const rows = useMemo(
    () => mergeCoachRoster(parceiros, aulasQ.data || []),
    [parceiros, aulasQ.data],
  );
  const linkedIds = useMemo(() => new Set(parceiros.map((c) => c.id)), [parceiros]);
  // Para o formulário: parceiros com parceria ATIVA que ainda não dão aula.
  const parceirosForaDasAulas = useMemo(
    () => rows.filter((r) => r.canEnableClasses).map((r) => r.partner),
    [rows],
  );
  const carregando = parceirosQ.isLoading || aulasQ.isLoading;
  const falhou = parceirosQ.isError || aulasQ.isError;

  return (
    <V2Surface>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-ink" />
          <h2 className="font-display text-lg font-bold text-ink">Professores ({rows.length})</h2>
        </div>
        {!vinculando && !form && (
          <div className="flex flex-wrap gap-1.5">
            <V2Button size="sm" variant="ghost" onClick={() => setVinculando(true)}>
              <UserPlus className="mr-1.5 h-4 w-4" /> Parceiro da plataforma
            </V2Button>
            <V2Button size="sm" onClick={() => setForm('novo')}>
              <Plus className="mr-1.5 h-4 w-4" /> Professor das aulas
            </V2Button>
          </div>
        )}
      </div>
      <p className="-mt-2 mb-4 text-sm text-gray-500">
        Parceiros da plataforma aparecem na página da arena com o perfil deles. Quem dá aula
        na agenda aparece nas aulas — e, com a conta vinculada, vê os próprios alunos.
      </p>

      {vinculando && (
        <div className="mb-4">
          <AddPartner arenaId={arenaId} linkedIds={linkedIds} onDone={() => setVinculando(false)} />
        </div>
      )}
      {form && (
        <ProfessorForm
          arenaId={arenaId}
          coach={form === 'novo' ? null : form}
          partners={form === 'novo' ? parceirosForaDasAulas : []}
          onClose={() => setForm(null)}
        />
      )}

      {carregando ? (
        <V2Skeleton lines={3} />
      ) : falhou ? (
        <V2EmptyState
          icon={GraduationCap}
          title="Não foi possível carregar os professores"
          description="Pode ser a conexão."
          action={(
            <V2Button size="sm" onClick={() => { parceirosQ.refetch(); aulasQ.refetch(); }}>
              Tentar de novo
            </V2Button>
          )}
        />
      ) : rows.length === 0 ? (
        <V2EmptyState
          icon={GraduationCap}
          title="Nenhum professor ainda"
          description="Vincule um professor que já tem perfil na plataforma, ou cadastre quem dá aula aqui — mesmo sem conta."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (row.partner ? (
            <PartnerCard key={row.key} arenaId={arenaId} coach={row.partner} extraBadges={<SelosDasAulas row={row} />}>
              <AcoesDasAulas row={row} arenaId={arenaId} onEditar={setForm} />
            </PartnerCard>
          ) : (
            <CartaoSoDasAulas key={row.key} row={row} onEditar={setForm} />
          )))}
        </div>
      )}
    </V2Surface>
  );
}
