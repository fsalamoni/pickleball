/**
 * A agenda de aulas da arena — o corpo, sem a página em volta.
 *
 * Usado na Central da arena (seção Aulas → Agenda) e na página de aulas
 * (`/arenas/:id/aulas`), que o atleta e o professor abrem. A mesma agenda
 * responde diferente para cada um (ver `splitClassAgenda`):
 *
 * | Quem | Vê |
 * |---|---|
 * | **Arena** | todas as aulas, cria, edita, cancela, marca como dada, registra pagamento |
 * | **Professor** | as aulas DELE e os alunos de cada uma (só leitura) |
 * | **Atleta** | as abertas para se matricular, e as suas |
 *
 * 🐞 Três defeitos corrigidos aqui (2026-09-24):
 * - a aula marcada como "dada" SUMIA, e com ela o botão de registrar o
 *   pagamento de quem esteve lá;
 * - a divisão arena × professor supunha todo professor parceiro — o da casa
 *   aparecia pagando comissão (e a matrícula GRAVAVA isso);
 * - o professor via "ninguém matriculado" com a turma cheia.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle, Calendar, Check, Clock, MapPin, Pencil, Plus, Users, X,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArenaCourts } from '@/modules/arenas/hooks/useArenas';
import {
  useArenaCoaches as useArenaClassCoaches, useArenaClasses, useCreateClass,
  useUpdateArenaClass, useCancelArenaClass, useCompleteArenaClass, useBookClass,
  useClassBookings, useCoachClassBookings, useMyClassBookings, useCancelClassBooking,
  useSetClassBookingPaid,
} from '@/modules/arenas/hooks/useArenaV3';
import { useArenaModuleConfig } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import {
  CLASS_FORMAT, CLASS_FORMAT_META, CLASS_STATUS, COACH_LEVEL, COACH_LEVEL_META,
  classSeatsLeft, classSplit, commissionPctFrom, isClassOpen,
} from '@/modules/arenas/domain/classes';
import { AGENDA_ROLE, splitClassAgenda } from '@/modules/arenas/domain/classAgenda';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { todayISO } from '@/modules/arenas/domain/subscription';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton,
  V2Surface, V2Textarea,
} from '@/v2/ui/primitives';


function AulaForm({ arenaId, aula, coaches, courts, onClose }) {
  const [form, setForm] = useState(() => ({
    date: aula?.date || todayISO(),
    start: aula?.start || '19:00',
    end: aula?.end || '20:00',
    coach_id: aula?.coach_id || (coaches[0]?.id || ''),
    court_id: aula?.court_id || '',
    format: aula?.format || CLASS_FORMAT.GROUP,
    level: aula?.level || COACH_LEVEL.BEGINNER,
    max_students: aula?.max_students ?? 4,
    price: aula?.price ?? 80,
    notes: aula?.notes || '',
  }));
  const criar = useCreateClass();
  const editar = useUpdateArenaClass();
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const professor = coaches.find((c) => c.id === form.coach_id);

  const submit = async (e) => {
    e.preventDefault();
    const input = {
      ...form,
      max_students: Number(form.max_students),
      price: Number(form.price),
      court_id: form.court_id || null,
      coach_id: form.coach_id || null,
      coach_name: professor?.name || '',
    };
    try {
      if (aula) await editar.mutateAsync({ arenaId, classId: aula.id, input });
      else await criar.mutateAsync({ arenaId, input });
      toast.success(aula ? 'Aula atualizada.' : 'Aula publicada na agenda.');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar a aula.');
    }
  };

  return (
    <form onSubmit={submit} className="mb-4 rounded-2xl border border-gray-100 bg-paper p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink">
          {aula ? 'Editar aula' : 'Nova aula na agenda'}
        </h3>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <V2Field label="Professor" htmlFor="au-prof">
          <select id="au-prof" value={form.coach_id} onChange={(e) => set({ coach_id: e.target.value })}
            className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm">
            <option value="">A definir</option>
            {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </V2Field>
        <V2Field
          label="Quadra" htmlFor="au-quadra"
          hint={form.court_id ? 'A quadra sai da venda neste horário.' : 'Vazio = não ocupa quadra.'}
        >
          <select id="au-quadra" value={form.court_id} onChange={(e) => set({ court_id: e.target.value })}
            className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm">
            <option value="">Nenhuma</option>
            {courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </V2Field>
        <V2Field label="Data" htmlFor="au-data">
          <V2Input id="au-data" type="date" required value={form.date}
            onChange={(e) => set({ date: e.target.value })} />
        </V2Field>
        <V2Field label="Começa" htmlFor="au-ini">
          <V2Input id="au-ini" type="time" required value={form.start}
            onChange={(e) => set({ start: e.target.value })} />
        </V2Field>
        <V2Field label="Termina" htmlFor="au-fim">
          <V2Input id="au-fim" type="time" required value={form.end}
            onChange={(e) => set({ end: e.target.value })} />
        </V2Field>
        <V2Field label="Formato" htmlFor="au-formato" hint={CLASS_FORMAT_META[form.format]?.hint}>
          <select id="au-formato" value={form.format} onChange={(e) => set({ format: e.target.value })}
            className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm">
            {Object.entries(CLASS_FORMAT_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </V2Field>
        <V2Field label="Nível" htmlFor="au-nivel">
          <select id="au-nivel" value={form.level} onChange={(e) => set({ level: e.target.value })}
            className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm">
            {Object.entries(COACH_LEVEL_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </V2Field>
        <V2Field label="Vagas" htmlFor="au-vagas">
          <V2Input id="au-vagas" type="number" min="1" max="50" required value={form.max_students}
            onChange={(e) => set({ max_students: e.target.value })} />
        </V2Field>
        <V2Field label="Preço por aluno (R$)" htmlFor="au-preco">
          <V2Input id="au-preco" type="number" min="0" step="0.01" required value={form.price}
            onChange={(e) => set({ price: e.target.value })} />
        </V2Field>
      </div>

      <V2Field label="Observações" htmlFor="au-obs" className="mt-3">
        <V2Textarea id="au-obs" rows={2} maxLength={500}
          placeholder="O que levar, o que vai ser trabalhado…"
          value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
      </V2Field>

      <div className="mt-3 flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={criar.isPending || editar.isPending}>
          {aula ? 'Salvar' : 'Publicar aula'}
        </V2Button>
      </div>
    </form>
  );
}

/**
 * Os alunos de uma aula — a arena gere (pagamento, tirar da aula), o professor
 * só vê.
 *
 * 🐞 A arena E o professor abriam a aula e liam "ninguém matriculado" com a
 * turma cheia: a consulta da arena filtrava só por aula (a regra confere a
 * arena), e o professor nem tinha permissão. Cada um tem agora a consulta que
 * a regra consegue provar — a arena por `arena_id` + `class_id`, o professor
 * por `coach_id`.
 */
function AlunosDaAula({ classId, arenaId, podeGerir, coachId }) {
  const daArena = useClassBookings(podeGerir ? classId : null, arenaId);
  const doProfessor = useCoachClassBookings(podeGerir ? null : coachId);
  const consulta = podeGerir ? daArena : doProfessor;
  const alunos = useMemo(
    () => (consulta.data || []).filter((b) => b.class_id === classId),
    [consulta.data, classId],
  );
  const marcarPago = useSetClassBookingPaid();
  const cancelar = useCancelClassBooking();

  if (consulta.isLoading) return <V2Skeleton className="mt-2 h-12 rounded-2xl" />;
  if (consulta.isError) {
    return (
      <p className="mt-2 text-xs text-red-700">
        Não foi possível carregar os alunos agora.{' '}
        <button type="button" className="font-bold underline" onClick={() => consulta.refetch()}>Tentar de novo</button>
      </p>
    );
  }
  if (alunos.length === 0) {
    return <p className="mt-2 text-xs text-gray-500">Ninguém matriculado ainda.</p>;
  }

  return (
    <ul className="mt-2 space-y-1.5">
      {alunos.map((a) => (
        <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper-pure p-2">
          <span className="text-sm text-ink">{a.athlete_name || 'Aluno'}</span>
          <div className="flex items-center gap-1.5">
            <V2Badge tone={a.paid ? 'green' : 'amber'}>{a.paid ? 'Pago' : 'A receber'}</V2Badge>
            {podeGerir && (<>
            <V2Button size="sm" variant="ghost" disabled={marcarPago.isPending}
              onClick={() => marcarPago.mutateAsync({ bookingId: a.id, paid: !a.paid })
                .then(() => toast.success(a.paid ? 'Pagamento desfeito.' : 'Pagamento registrado.'))
                .catch((e) => toast.error(e?.message || 'Não foi possível.'))}>
              {a.paid ? 'Desfazer' : 'Recebi'}
            </V2Button>
            <ConfirmDialog
              title={`Tirar ${a.athlete_name || 'o aluno'} da aula?`}
              description="A vaga volta a ficar disponível."
              confirmLabel="Tirar da aula"
              destructive
              onConfirm={() => cancelar.mutateAsync({ arenaId, bookingId: a.id })
                .then(() => toast.success('Matrícula cancelada.'))
                .catch((e) => toast.error(e?.message || 'Não foi possível.'))}
              trigger={(
                <button type="button" aria-label="Tirar da aula"
                  className="rounded-full border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100">
                  <X className="h-3 w-3" />
                </button>
              )}
            />
            </>)}
          </div>
        </li>
      ))}
    </ul>
  );
}

function CartaoDaAula({
  aula, arenaId, courts, minhaMatricula, podeGerir, souOProfessor,
  comissaoPct, professorParceiro, meuCoachId, isAuthenticated, onEditar,
}) {
  const [verAlunos, setVerAlunos] = useState(false);
  const matricular = useBookClass();
  const cancelarMatricula = useCancelClassBooking();
  const cancelarAula = useCancelArenaClass();
  const concluir = useCompleteArenaClass();

  const vagas = classSeatsLeft(aula);
  const quadra = courts.find((c) => c.id === aula.court_id);
  const formato = CLASS_FORMAT_META[aula.format] || CLASS_FORMAT_META[CLASS_FORMAT.GROUP];
  const nivel = COACH_LEVEL_META[aula.level] || COACH_LEVEL_META[COACH_LEVEL.BEGINNER];
  const passou = String(aula.date || '') < todayISO();
  const aberta = isClassOpen(aula);
  // 🐞 Era `partner: true` fixo: o professor da CASA aparecia pagando
  // comissão. Quem diz é o cadastro do professor da aula.
  const divisao = classSplit(aula.price, { commissionPct: comissaoPct, partner: professorParceiro });

  return (
    <div className={`rounded-2xl border p-3 ${!aberta ? 'border-gray-100 bg-gray-50 opacity-75' : 'border-gray-100 bg-paper'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-bold text-ink">
            {formatDateShortBR(aula.date)} · {aula.start}–{aula.end}
          </p>
          <p className="mt-0.5 text-sm text-gray-600">
            {aula.coach_name || 'Professor a definir'}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <V2Badge tone="neutral">{formato.label}</V2Badge>
          <V2Badge tone="neutral">{nivel.label}</V2Badge>
          {aula.status === CLASS_STATUS.CANCELLED && <V2Badge tone="red">Cancelada</V2Badge>}
          {aula.status === CLASS_STATUS.COMPLETED && <V2Badge tone="green">Dada</V2Badge>}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
        {quadra && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {quadra.name}</span>}
        <span className="inline-flex items-center gap-1">
          <Users className="h-3.5 w-3.5" /> {aula.enrolled || 0}/{aula.max_students} {vagas > 0 ? `· ${vagas} vaga(s)` : '· lotada'}
        </span>
        <span className="font-bold text-ink">{formatPrice(aula.price)}</span>
      </div>

      {aula.notes && <p className="mt-1.5 text-xs text-gray-500">{aula.notes}</p>}

      {aula.status === CLASS_STATUS.CANCELLED && aula.cancel_reason && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-red-700">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" /> {aula.cancel_reason}
        </p>
      )}

      {/* A divisão só interessa a quem recebe. Para o aluno é ruído. */}
      {(podeGerir || souOProfessor) && aberta && Number(aula.price) > 0 && (
        <p className="mt-1.5 text-xs text-gray-500">
          Divisão por aluno: arena {formatPrice(divisao.arena)} · professor {formatPrice(divisao.coach)}
          {divisao.pct > 0 ? ` (${divisao.pct}%)` : ''}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {/* ---- atleta ---- */}
        {!podeGerir && !souOProfessor && isAuthenticated && aberta && !passou && (
          minhaMatricula ? (
            <ConfirmDialog
              title="Desmarcar esta aula?"
              description="A sua vaga volta para a arena. Dá para se matricular de novo se sobrar lugar."
              confirmLabel="Desmarcar"
              destructive
              onConfirm={() => cancelarMatricula.mutateAsync({ arenaId, bookingId: minhaMatricula.id })
                .then(() => toast.success('Matrícula cancelada.'))
                .catch((e) => toast.error(e?.message || 'Não foi possível cancelar.'))}
              trigger={<V2Button size="sm" variant="ghost">Desmarcar</V2Button>}
            />
          ) : (
            <V2Button
              size="sm"
              disabled={vagas <= 0 || matricular.isPending}
              onClick={() => matricular.mutateAsync({ arenaId, classId: aula.id })
                .then(() => toast.success('Matrícula feita! Combine o pagamento com a arena.'))
                .catch((e) => toast.error(e?.message || 'Não foi possível matricular.'))}
            >
              {vagas <= 0 ? 'Lotada' : 'Matricular-me'}
            </V2Button>
          )
        )}
        {minhaMatricula && <V2Badge tone="green">Você está nesta aula</V2Badge>}

        {/* ---- arena e professor ---- */}
        {(podeGerir || souOProfessor) && (
          <V2Button size="sm" variant="ghost" onClick={() => setVerAlunos((v) => !v)}>
            <Users className="mr-1 h-3.5 w-3.5" /> {verAlunos ? 'Esconder alunos' : `Alunos (${aula.enrolled || 0})`}
          </V2Button>
        )}
        {podeGerir && aberta && (
          <>
            <V2Button size="sm" variant="ghost" onClick={() => onEditar(aula)}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
            </V2Button>
            <V2Button size="sm" variant="ghost" disabled={concluir.isPending}
              onClick={() => concluir.mutateAsync({ arenaId, classId: aula.id })
                .then(() => toast.success('Aula marcada como dada.'))
                .catch((e) => toast.error(e?.message || 'Não foi possível.'))}>
              <Check className="mr-1 h-3.5 w-3.5" /> Marcar como dada
            </V2Button>
            <ConfirmDialog
              title="Cancelar esta aula?"
              description="Quem estava matriculado é avisado, e a quadra volta à venda. A aula fica registrada como cancelada."
              confirmLabel="Cancelar a aula"
              destructive
              onConfirm={() => cancelarAula.mutateAsync({ arenaId, classId: aula.id, motivo: '' })
                .then(() => toast.success('Aula cancelada e alunos avisados.'))
                .catch((e) => toast.error(e?.message || 'Não foi possível cancelar.'))}
              trigger={<V2Button size="sm" variant="ghost" className="text-red-600">Cancelar</V2Button>}
            />
          </>
        )}
      </div>

      {verAlunos && (podeGerir || souOProfessor) && (
        <AlunosDaAula classId={aula.id} arenaId={arenaId} podeGerir={podeGerir} coachId={meuCoachId} />
      )}
    </div>
  );
}

/**
 * @param {{
 *   arena: object,
 *   podeGerir: boolean,
 *   meuPerfilDeProfessor?: object|null,  cadastro (`arena_coaches`) da pessoa NESTA arena
 * }} props
 */
export default function ArenaClassesPanel({ arena, podeGerir, meuPerfilDeProfessor = null }) {
  const arenaId = arena.id;
  const { isAuthenticated } = useAuth();
  const { data: courts = [] } = useArenaCourts(arenaId);
  const { data: coaches = [] } = useArenaClassCoaches(arenaId, { onlyActive: false });
  const aulasQ = useArenaClasses(arenaId, { includeClosed: true, lim: 300 });
  const { data: minhas = [] } = useMyClassBookings(isAuthenticated ? arenaId : null);
  const marketplaceConfig = useArenaModuleConfig(arenaId, ARENA_MODULE_ID.CLASSES_MARKETPLACE);

  const [formAula, setFormAula] = useState(null);
  const [verPassadas, setVerPassadas] = useState(false);

  const comissaoPct = commissionPctFrom(marketplaceConfig);
  const parceiroPorId = useMemo(
    () => new Map(coaches.map((c) => [c.id, Boolean(c.partner)])),
    [coaches],
  );
  const matriculaPorAula = useMemo(
    () => new Map(minhas.map((b) => [b.class_id, b])),
    [minhas],
  );

  const papel = podeGerir ? AGENDA_ROLE.ARENA
    : meuPerfilDeProfessor ? AGENDA_ROLE.COACH
      : AGENDA_ROLE.ATHLETE;
  const hoje = todayISO();
  const { futuras, passadas } = useMemo(() => splitClassAgenda(aulasQ.data || [], {
    hoje,
    role: papel,
    coachId: meuPerfilDeProfessor?.id || null,
    myClassIds: new Set(minhas.map((b) => b.class_id)),
  }), [aulasQ.data, hoje, papel, meuPerfilDeProfessor, minhas]);

  const lista = verPassadas ? passadas : futuras;
  const tituloPassadas = papel === AGENDA_ROLE.ATHLETE ? 'Suas aulas passadas' : 'Aulas passadas';

  return (
    <div className="space-y-4">
      <V2Surface>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-ink" />
            <h2 className="font-display text-lg font-bold text-ink">
              {verPassadas ? tituloPassadas : 'Próximas aulas'}
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(passadas.length > 0 || verPassadas) && (
              <V2Button size="sm" variant="ghost" onClick={() => setVerPassadas((v) => !v)}>
                {verPassadas ? `Próximas (${futuras.length})` : `Passadas (${passadas.length})`}
              </V2Button>
            )}
            {podeGerir && !formAula && (
              <V2Button size="sm" onClick={() => setFormAula('nova')}>
                <Plus className="mr-1.5 h-4 w-4" /> Nova aula
              </V2Button>
            )}
          </div>
        </div>

        {formAula && podeGerir && (
          <AulaForm arenaId={arenaId} aula={formAula === 'nova' ? null : formAula}
            coaches={coaches.filter((c) => c.active !== false || c.id === formAula?.coach_id)} courts={courts}
            onClose={() => setFormAula(null)} />
        )}

        {aulasQ.isLoading && <V2Skeleton className="h-24 rounded-2xl" />}

        {aulasQ.isError && (
          <V2EmptyState
            icon={AlertTriangle}
            title="Não foi possível carregar a agenda"
            description="Pode ser a conexão. Nenhuma aula foi alterada."
            action={<V2Button size="sm" onClick={() => aulasQ.refetch()}>Tentar de novo</V2Button>}
          />
        )}

        {!aulasQ.isLoading && !aulasQ.isError && lista.length === 0 && !formAula && (
          <V2EmptyState
            icon={Clock}
            title={verPassadas ? 'Nenhuma aula passada' : 'Nenhuma aula marcada'}
            description={podeGerir
              ? 'Publique um horário e ele aparece para os atletas — e sai da venda no calendário, se você escolher uma quadra.'
              : papel === AGENDA_ROLE.COACH
                ? 'Quando a arena marcar uma aula com você, ela aparece aqui.'
                : 'Quando a arena publicar horários, eles aparecem aqui.'}
            action={podeGerir && !verPassadas
              ? <V2Button size="sm" onClick={() => setFormAula('nova')}>Publicar a primeira</V2Button>
              : null}
          />
        )}

        <div className="space-y-2">
          {lista.map((a) => (
            <CartaoDaAula
              key={a.id}
              aula={a}
              arenaId={arenaId}
              courts={courts}
              minhaMatricula={matriculaPorAula.get(a.id) || null}
              podeGerir={podeGerir}
              souOProfessor={Boolean(meuPerfilDeProfessor && a.coach_id === meuPerfilDeProfessor.id)}
              comissaoPct={comissaoPct}
              professorParceiro={Boolean(parceiroPorId.get(a.coach_id))}
              meuCoachId={meuPerfilDeProfessor?.id || null}
              isAuthenticated={isAuthenticated}
              onEditar={setFormAula}
            />
          ))}
        </div>

        {!isAuthenticated && (
          <p className="mt-4 text-sm text-gray-500">
            <Link to="/entrar" className="font-bold text-ink underline">Entre</Link> para se matricular.
          </p>
        )}
      </V2Surface>

      {podeGerir && (
        <p className="flex items-start gap-2 rounded-2xl bg-paper p-4 text-xs leading-5 text-gray-500">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Aula com <strong className="text-ink">quadra escolhida</strong> tira aquele horário da
          venda — no calendário do atleta, na grade do dia e no pedido de reserva. Aula sem
          quadra não bloqueia nada, e serve para o que acontece fora dela.
        </p>
      )}
    </div>
  );
}
