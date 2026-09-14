/**
 * V2ArenaClasses — aulas e professores da arena.
 *
 * Rotas: `/arenas/:arenaId/aulas` (atleta e professor) ·
 *        `/arenas/:arenaId/gerir/aulas` (arena)
 * Módulos: `classes` (+ `classes_catalog`, `classes_packages`,
 * `classes_marketplace`).
 *
 * ## Uma tela, três pessoas
 *
 * O mesmo assunto significa coisas diferentes para cada uma, e a tela decide
 * pelo que a pessoa É — não por um seletor que ela tenha de encontrar:
 *
 * | Quem | O que vê primeiro |
 * |---|---|
 * | **Atleta** | as aulas em que dá para se matricular, e as suas |
 * | **Professor** | a agenda DELE nesta arena, com os alunos de cada aula |
 * | **Arena** | a grade inteira, os professores e quem pagou |
 *
 * ## 🐞 O defeito que ninguém via
 *
 * A matrícula **nunca funcionou**. A regra do Firestore exige
 * `request.resource.data.user_id == request.auth.uid` e o serviço gravava o
 * campo como `athlete_id`: campo ausente é `null`, `null` nunca é igual a um
 * uid, e toda matrícula era recusada — desde o dia em que a funcionalidade foi
 * escrita. O erro chegava como um "permission-denied" genérico, que ninguém
 * liga a um nome de campo.
 *
 * E a aula **não ocupava a quadra**, embora o catálogo prometesse que ela
 * "passa a ocupar a grade": era possível marcar aula às 19h e vender a mesma
 * quadra às 19h.
 */

import React, { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeft, Calendar, Check, Clock, GraduationCap, MapPin,
  Pencil, Plus, Trash2, User, Users, X,
} from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena, useMyManagedArenas, useArenaCourts } from '@/modules/arenas/hooks/useArenas';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import {
  useArenaCoaches, useArenaClasses, useCreateCoach, useUpdateArenaCoach,
  useCreateClass, useUpdateArenaClass, useCancelArenaClass, useCompleteArenaClass,
  useBookClass, useClassBookings, useMyClassBookings, useCancelClassBooking,
  useSetClassBookingPaid, useMyCoachProfiles,
} from '@/modules/arenas/hooks/useArenaV3';
import { useArenaModules, useArenaModuleConfig } from '@/modules/arenas/hooks/useArenaModules';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import {
  CLASS_FORMAT, CLASS_FORMAT_META, CLASS_STATUS, COACH_LEVEL, COACH_LEVEL_META,
  DEFAULT_ARENA_COMMISSION_PCT, classSeatsLeft, classSplit, isClassOpen,
} from '@/modules/arenas/domain/classes';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { todayISO } from '@/modules/arenas/domain/subscription';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  V2Avatar, V2Badge, V2Button, V2EmptyState, V2Field, V2Input, V2Skeleton,
  V2Surface, V2Textarea,
} from '@/v2/ui/primitives';

/* ==================================================== PROFESSOR (CRUD) === */

function ProfessorForm({ arenaId, coach, onClose }) {
  const { data: atletas = [] } = useAthletes();
  const [form, setForm] = useState(() => ({
    name: coach?.name || '',
    level: coach?.level || COACH_LEVEL.INTERMEDIATE,
    price_per_hour: coach?.price_per_hour ?? 120,
    bio: coach?.bio || '',
    user_id: coach?.user_id || '',
    partner: Boolean(coach?.partner),
    active: coach?.active !== false,
  }));
  const [busca, setBusca] = useState('');
  const criar = useCreateCoach();
  const editar = useUpdateArenaCoach();
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const vinculado = atletas.find((a) => a.id === form.user_id);
  const resultados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return [];
    return atletas
      .filter((a) => `${a.platform_name || ''} ${a.full_name || ''}`.toLowerCase().includes(termo))
      .slice(0, 5);
  }, [atletas, busca]);

  const submit = async (e) => {
    e.preventDefault();
    const input = { ...form, price_per_hour: Number(form.price_per_hour) };
    try {
      if (coach) await editar.mutateAsync({ arenaId, coachId: coach.id, input });
      else await criar.mutateAsync({ arenaId, input });
      toast.success(coach ? 'Professor atualizado.' : 'Professor cadastrado.');
      onClose();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar.');
    }
  };

  return (
    <form onSubmit={submit} className="mb-4 rounded-2xl border border-gray-100 bg-paper p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-bold text-ink">
          {coach ? `Editar ${coach.name}` : 'Novo professor'}
        </h3>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <V2Field label="Nome" htmlFor="pf-nome">
          <V2Input id="pf-nome" required maxLength={80} value={form.name}
            onChange={(e) => set({ name: e.target.value })} />
        </V2Field>
        <V2Field label="Nível que atende" htmlFor="pf-nivel">
          <select id="pf-nivel" value={form.level} onChange={(e) => set({ level: e.target.value })}
            className="h-11 w-full rounded-2xl border border-gray-200 bg-paper-pure px-4 text-sm">
            {Object.entries(COACH_LEVEL_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </V2Field>
        <V2Field label="Preço por hora (R$)" htmlFor="pf-preco">
          <V2Input id="pf-preco" type="number" min="0" step="0.01" value={form.price_per_hour}
            onChange={(e) => set({ price_per_hour: e.target.value })} />
        </V2Field>
      </div>

      <V2Field label="Sobre" htmlFor="pf-bio" className="mt-3">
        <V2Textarea id="pf-bio" rows={2} maxLength={1000}
          placeholder="Experiência, método, com quem trabalha melhor…"
          value={form.bio} onChange={(e) => set({ bio: e.target.value })} />
      </V2Field>

      {/* O vínculo é o que faz o professor ver a própria agenda. Sem ele o
          cadastro é um nome solto — que era o estado anterior. */}
      <V2Field
        label="Conta na plataforma"
        htmlFor="pf-conta"
        className="mt-3"
        hint="Vinculando, o professor passa a ver a agenda dele e os alunos aqui dentro."
      >
        {vinculado ? (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-paper-pure p-2.5">
            <div className="flex items-center gap-2">
              <V2Avatar photoUrl={vinculado.photo_url} name={vinculado.platform_name || vinculado.full_name} size="sm" />
              <span className="text-sm font-bold text-ink">{vinculado.platform_name || vinculado.full_name}</span>
            </div>
            <button type="button" onClick={() => set({ user_id: '' })} aria-label="Desvincular"
              className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <V2Input id="pf-conta" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pelo nome… (opcional)" />
        )}
      </V2Field>
      {!vinculado && resultados.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {resultados.map((a) => (
            <button key={a.id} type="button" onClick={() => { set({ user_id: a.id }); setBusca(''); }}
              className="flex w-full items-center gap-2 rounded-2xl border border-gray-100 bg-paper-pure p-2.5 text-left hover:border-gray-300">
              <V2Avatar photoUrl={a.photo_url} name={a.platform_name || a.full_name} size="sm" />
              <span className="text-sm text-ink">{a.platform_name || a.full_name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.partner} className="h-4 w-4 rounded border-gray-300"
            onChange={(e) => set({ partner: e.target.checked })} />
          Professor parceiro (paga comissão à arena)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={form.active} className="h-4 w-4 rounded border-gray-300"
            onChange={(e) => set({ active: e.target.checked })} />
          Ativo
        </label>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <V2Button type="button" variant="ghost" onClick={onClose}>Cancelar</V2Button>
        <V2Button type="submit" disabled={criar.isPending || editar.isPending}>
          {coach ? 'Salvar' : 'Cadastrar'}
        </V2Button>
      </div>
    </form>
  );
}

function CartaoDoProfessor({ coach, podeGerir, onEditar }) {
  const nivel = COACH_LEVEL_META[coach.level] || COACH_LEVEL_META[COACH_LEVEL.INTERMEDIATE];
  return (
    <div className={`rounded-2xl border p-3 ${coach.active === false ? 'border-gray-100 bg-gray-50 opacity-70' : 'border-gray-100 bg-paper'}`}>
      <div className="flex items-start gap-3">
        <V2Avatar photoUrl={coach.photo_url} name={coach.name} size="md" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-bold text-ink">{coach.name}</p>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            <V2Badge tone="neutral">{nivel.label}</V2Badge>
            {Number(coach.price_per_hour) > 0 && (
              <V2Badge tone="acid">{formatPrice(coach.price_per_hour)}/h</V2Badge>
            )}
            {coach.partner && <V2Badge tone="amber">Parceiro</V2Badge>}
            {coach.active === false && <V2Badge tone="neutral">Inativo</V2Badge>}
          </div>
          {coach.bio && <p className="mt-2 text-sm leading-6 text-gray-600">{coach.bio}</p>}
          {Number(coach.sessions_given) > 0 && (
            <p className="mt-1 text-xs text-gray-500">{coach.sessions_given} aula(s) dada(s) aqui</p>
          )}
        </div>
      </div>
      {podeGerir && (
        <div className="mt-2 flex justify-end">
          <V2Button size="sm" variant="ghost" onClick={() => onEditar(coach)}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
          </V2Button>
        </div>
      )}
    </div>
  );
}

/* ======================================================= AULA (CRUD) ===== */

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

/** Os alunos de uma aula — só a arena e o professor veem. */
function AlunosDaAula({ classId, arenaId }) {
  const { data: alunos = [], isLoading } = useClassBookings(classId);
  const marcarPago = useSetClassBookingPaid();
  const cancelar = useCancelClassBooking();

  if (isLoading) return <V2Skeleton className="mt-2 h-12 rounded-2xl" />;
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
          </div>
        </li>
      ))}
    </ul>
  );
}

function CartaoDaAula({
  aula, arenaId, courts, minhaMatricula, podeGerir, souOProfessor,
  comissaoPct, onEditar,
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
  const divisao = classSplit(aula.price, { commissionPct: comissaoPct, partner: true });

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
        {!podeGerir && !souOProfessor && aberta && !passou && (
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
              onClick={() => matricular.mutateAsync({ arenaId, classId: aula.id, commissionPct: comissaoPct, partner: true })
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
        <AlunosDaAula classId={aula.id} arenaId={arenaId} />
      )}
    </div>
  );
}

/* ========================================================== A PÁGINA ==== */

export default function V2ArenaClasses() {
  const { arenaId } = useParams();
  const { user, isPlatformAdmin, isAuthenticated } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const { data: managed = [] } = useMyManagedArenas();
  const { isOn, isLoading: modulosCarregando } = useArenaModules(arenaId);
  const { data: courts = [] } = useArenaCourts(arenaId);
  const { data: coaches = [] } = useArenaCoaches(arenaId, { onlyActive: false });
  const { data: aulas = [], isLoading: aulasCarregando } = useArenaClasses(arenaId);
  const { data: minhas = [] } = useMyClassBookings(arenaId);
  const { data: meusPerfis = [] } = useMyCoachProfiles();
  const marketplaceConfig = useArenaModuleConfig(arenaId, ARENA_MODULE_ID.CLASSES_MARKETPLACE);

  const [formProfessor, setFormProfessor] = useState(null);
  const [formAula, setFormAula] = useState(null);
  const [verPassadas, setVerPassadas] = useState(false);

  const podeGerir = arena?.owner_id === user?.uid
    || managed.some((m) => m.id === arena?.id)
    || isPlatformAdmin;

  // Sou professor NESTA arena? É o vínculo `user_id` que responde — sem ele o
  // professor não conseguia ver a própria agenda.
  const meuPerfilDeProfessor = useMemo(
    () => meusPerfis.find((p) => p.arena_id === arenaId) || null,
    [meusPerfis, arenaId],
  );

  const comissaoPct = Number(marketplaceConfig?.commission_pct) || DEFAULT_ARENA_COMMISSION_PCT;

  const matriculaPorAula = useMemo(
    () => new Map(minhas.map((b) => [b.class_id, b])),
    [minhas],
  );

  const hoje = todayISO();
  const { futuras, passadas } = useMemo(() => {
    const relevantes = meuPerfilDeProfessor && !podeGerir
      ? aulas.filter((a) => a.coach_id === meuPerfilDeProfessor.id)
      : aulas;
    return {
      futuras: relevantes.filter((a) => String(a.date || '') >= hoje),
      passadas: relevantes.filter((a) => String(a.date || '') < hoje).reverse(),
    };
  }, [aulas, meuPerfilDeProfessor, podeGerir, hoje]);

  if (isLoading || modulosCarregando) {
    return <V2Skeleton className="mx-auto h-96 max-w-[1000px] rounded-4xl" />;
  }
  if (!arena) return <Navigate to="/arenas" replace />;
  if (!isOn(ARENA_MODULE_ID.CLASSES)) return <Navigate to={`/arenas/${arenaId}`} replace />;

  const temCatalogo = isOn(ARENA_MODULE_ID.CLASSES_CATALOG);
  const lista = verPassadas ? passadas : futuras;

  const titulo = podeGerir ? 'Aulas da arena'
    : meuPerfilDeProfessor ? 'Sua agenda nesta arena'
      : 'Aulas nesta arena';

  return (
    <div className="mx-auto max-w-[1000px]">
      <div className="mb-6">
        <Link
          to={podeGerir ? `/arenas/${arena.id}/gerir` : `/arenas/${arena.id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {podeGerir ? 'Voltar para a gestão' : arena.name}
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">{titulo}</h1>
        <p className="mt-2 font-medium text-gray-500">
          {meuPerfilDeProfessor && !podeGerir
            ? 'As aulas em que você é o professor, com os alunos de cada uma.'
            : `${arena.name} · agenda, professores e matrículas.`}
        </p>
      </div>

      {/* ------------------------------ professores --------------------- */}
      {(temCatalogo || podeGerir) && (
        <V2Surface className="mb-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-ink" />
              <h2 className="font-display text-lg font-bold text-ink">Professores</h2>
            </div>
            {podeGerir && !formProfessor && (
              <V2Button size="sm" onClick={() => setFormProfessor('novo')}>
                <Plus className="mr-1.5 h-4 w-4" /> Novo professor
              </V2Button>
            )}
          </div>

          {formProfessor && podeGerir && (
            <ProfessorForm arenaId={arena.id} coach={formProfessor === 'novo' ? null : formProfessor}
              onClose={() => setFormProfessor(null)} />
          )}

          {coaches.length === 0 ? (
            <V2EmptyState
              icon={User}
              title="Nenhum professor cadastrado"
              description={podeGerir
                ? 'Cadastre quem dá aula aqui. Vinculando a conta da pessoa, ela passa a ver a própria agenda e os alunos.'
                : 'Esta arena ainda não publicou os professores dela.'}
              action={podeGerir ? <V2Button size="sm" onClick={() => setFormProfessor('novo')}>Cadastrar o primeiro</V2Button> : null}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {coaches
                .filter((c) => podeGerir || c.active !== false)
                .map((c) => (
                  <CartaoDoProfessor key={c.id} coach={c} podeGerir={podeGerir} onEditar={setFormProfessor} />
                ))}
            </div>
          )}
        </V2Surface>
      )}

      {/* --------------------------------- agenda ----------------------- */}
      <V2Surface>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-ink" />
            <h2 className="font-display text-lg font-bold text-ink">
              {verPassadas ? 'Aulas passadas' : 'Próximas aulas'}
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <V2Button size="sm" variant="ghost" onClick={() => setVerPassadas((v) => !v)}>
              {verPassadas ? `Próximas (${futuras.length})` : `Passadas (${passadas.length})`}
            </V2Button>
            {podeGerir && !formAula && (
              <V2Button size="sm" onClick={() => setFormAula('nova')}>
                <Plus className="mr-1.5 h-4 w-4" /> Nova aula
              </V2Button>
            )}
          </div>
        </div>

        {formAula && podeGerir && (
          <AulaForm arenaId={arena.id} aula={formAula === 'nova' ? null : formAula}
            coaches={coaches.filter((c) => c.active !== false)} courts={courts}
            onClose={() => setFormAula(null)} />
        )}

        {aulasCarregando && <V2Skeleton className="h-24 rounded-2xl" />}

        {!aulasCarregando && lista.length === 0 && !formAula && (
          <V2EmptyState
            icon={Clock}
            title={verPassadas ? 'Nenhuma aula passada' : 'Nenhuma aula marcada'}
            description={podeGerir
              ? 'Publique um horário e ele aparece para os atletas — e sai da venda no calendário, se você escolher uma quadra.'
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
              arenaId={arena.id}
              courts={courts}
              minhaMatricula={matriculaPorAula.get(a.id) || null}
              podeGerir={podeGerir}
              souOProfessor={Boolean(meuPerfilDeProfessor && a.coach_id === meuPerfilDeProfessor.id)}
              comissaoPct={comissaoPct}
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
        <p className="mt-6 flex items-start gap-2 rounded-2xl bg-paper p-4 text-xs leading-5 text-gray-500">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Aula com <strong className="text-ink">quadra escolhida</strong> tira aquele horário da
          venda — no calendário do atleta, na grade do dia e no pedido de reserva. Aula sem
          quadra não bloqueia nada, e serve para o que acontece fora dela.
        </p>
      )}
    </div>
  );
}
