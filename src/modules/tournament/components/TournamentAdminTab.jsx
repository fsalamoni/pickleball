import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  PlatformFormSection,
  PlatformMetricCard,
  PlatformSurfaceCard,
} from '@/components/ui/platform-page';
import { toast } from 'sonner';
import {
  CalendarDays,
  CheckCircle2,
  Lock,
  Play,
  Save,
  Settings2,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  useTournamentAdmins,
  useAddTournamentAdmin,
  useRemoveTournamentAdmin,
  useSetTournamentStatus,
  useUpdateTournament,
} from '@/modules/tournament/hooks/useTournament';
import {
  TOURNAMENT_STATUS,
  TOURNAMENT_STATUS_LABELS,
  TOURNAMENT_ADMIN_ROLE,
  RULESET,
  RULESET_LABELS,
  TOURNAMENT_VISIBILITY_LABELS,
} from '@/modules/tournament/domain/constants';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/core/config/firebase';

function buildFormState(tournament) {
  return {
    name: tournament?.name || '',
    description: tournament?.description || '',
    city: tournament?.city || '',
    state: tournament?.state || '',
    venue: tournament?.venue || '',
    visibility: tournament?.visibility || 'private',
    ruleset: tournament?.scoring?.ruleset || tournament?.ruleset || RULESET.CBP,
    starts_at: tournament?.starts_at || '',
    ends_at: tournament?.ends_at || '',
    registration_deadline: tournament?.registration_deadline || '',
  };
}

const STATUS_ACTIONS = [
  {
    value: TOURNAMENT_STATUS.REGISTRATIONS_OPEN,
    label: 'Abrir inscrições',
    description: 'Permite novas entradas nas modalidades.',
    icon: Play,
  },
  {
    value: TOURNAMENT_STATUS.REGISTRATIONS_CLOSED,
    label: 'Encerrar inscrições',
    description: 'Fecha novas entradas e estabiliza a lista.',
    icon: Lock,
  },
  {
    value: TOURNAMENT_STATUS.IN_PROGRESS,
    label: 'Iniciar torneio',
    description: 'Marca o evento como em andamento.',
    icon: Settings2,
  },
  {
    value: TOURNAMENT_STATUS.FINISHED,
    label: 'Encerrar torneio',
    description: 'Fecha a operação e mantém o histórico publicado.',
    icon: CheckCircle2,
  },
];

export default function TournamentAdminTab({ tournament }) {
  const { data: admins = [] } = useTournamentAdmins(tournament.id);
  const addMutation = useAddTournamentAdmin(tournament.id);
  const removeMutation = useRemoveTournamentAdmin(tournament.id);
  const statusMutation = useSetTournamentStatus(tournament.id);
  const updateMutation = useUpdateTournament(tournament.id);
  const [email, setEmail] = useState('');
  const [form, setForm] = useState(() => buildFormState(tournament));

  useEffect(() => {
    setForm(buildFormState(tournament));
  }, [tournament]);

  function set(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleAddAdmin() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    try {
      const q = query(collection(db, 'users'), where('email', '==', trimmed));
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.error('Usuário não encontrado. Peça para a pessoa fazer login uma vez na plataforma.');
        return;
      }
      const data = snap.docs[0].data();
      await addMutation.mutateAsync({ uid: data.uid, email: data.email, displayName: data.platform_name || data.full_name });
      toast.success('Admin adicionado.');
      setEmail('');
    } catch (err) {
      toast.error(err.message || 'Falha ao adicionar.');
    }
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Informe o nome do torneio.');
    try {
      await updateMutation.mutateAsync({
        name: form.name.trim(),
        description: form.description.trim(),
        city: form.city.trim(),
        state: form.state.trim().toUpperCase(),
        venue: form.venue.trim(),
        visibility: form.visibility,
        ruleset: form.ruleset,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        registration_deadline: form.registration_deadline || null,
        scoring: {
          ...(tournament?.scoring || {}),
          ruleset: form.ruleset,
          win_by_two: tournament?.scoring?.win_by_two ?? true,
        },
      });
      toast.success('Parâmetros do torneio atualizados.');
    } catch (err) {
      toast.error(err.message || 'Falha ao salvar.');
    }
  }

  async function setStatus(s) {
    try {
      await statusMutation.mutateAsync(s);
      toast.success('Status atualizado.');
    } catch (err) {
      toast.error(err.message);
    }
  }

  const infoCards = [
    {
      label: 'Status atual',
      value: TOURNAMENT_STATUS_LABELS[tournament.status],
      icon: ShieldAlert,
    },
    {
      label: 'Acesso',
      value: TOURNAMENT_VISIBILITY_LABELS[form.visibility],
      icon: Lock,
    },
    {
      label: 'Admins ativos',
      value: admins.length,
      icon: Users,
    },
  ];

  return (
    <div className="space-y-5">
      <PlatformSurfaceCard>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700/75">Parâmetros centrais</div>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950">Edite o torneio sem perder contexto operacional</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Nome, local, regras, datas e acesso ficam concentrados aqui para facilitar revisão antes de abrir inscrições ou iniciar partidas.
              </p>
            </div>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              <Save className="w-4 h-4 mr-1" />
              {updateMutation.isPending ? 'Salvando…' : 'Salvar alterações'}
            </Button>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {infoCards.map(({ label, value, icon: Icon }) => (
              <PlatformMetricCard key={label} label={label} value={value} icon={Icon} />
            ))}
          </div>
      </PlatformSurfaceCard>

      <div className="grid gap-5 xl:grid-cols-[1.15fr,0.85fr]">
        <PlatformSurfaceCard contentClassName="space-y-6 p-6 sm:p-7">
            <section className="space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700/75">Identidade e contexto</div>
                <h4 className="mt-2 text-xl font-semibold text-slate-950">Como o torneio aparece para o público</h4>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Nome do torneio</Label>
                  <Input value={form.name} onChange={(e) => set('name', e.target.value)} className="mt-2" />
                </div>
                <div className="md:col-span-2">
                  <Label>Descrição</Label>
                  <textarea
                    className="mt-2 flex min-h-28 w-full rounded-[1rem] border border-input bg-background px-3 py-3 text-sm"
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                  />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input value={form.city} onChange={(e) => set('city', e.target.value)} className="mt-2" />
                </div>
                <div>
                  <Label>UF</Label>
                  <Input value={form.state} onChange={(e) => set('state', e.target.value)} maxLength={2} className="mt-2" />
                </div>
                <div className="md:col-span-2">
                  <Label>Local (quadra/clube)</Label>
                  <Input value={form.venue} onChange={(e) => set('venue', e.target.value)} className="mt-2" />
                </div>
              </div>
            </section>

            <PlatformFormSection
              icon={Settings2}
              title="Acesso e regras-base"
              description="Defina quem encontra o torneio e qual conjunto de regras-base será herdado pelas modalidades."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>Tipo de acesso</Label>
                  <select
                    className="mt-2 h-11 w-full rounded-[1rem] border border-input bg-background px-3 text-sm"
                    value={form.visibility}
                    onChange={(e) => set('visibility', e.target.value)}
                  >
                    {Object.entries(TOURNAMENT_VISIBILITY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <Label>Conjunto de regras</Label>
                  <select
                    className="mt-2 h-11 w-full rounded-[1rem] border border-input bg-background px-3 text-sm"
                    value={form.ruleset}
                    onChange={(e) => set('ruleset', e.target.value)}
                  >
                    {Object.values(RULESET).map((ruleset) => (
                      <option key={ruleset} value={ruleset}>{RULESET_LABELS[ruleset]}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 rounded-[1.25rem] border border-emerald-200 bg-emerald-50/70 p-4 text-sm leading-6 text-emerald-950">
                  Pontos por game e sets por partida agora são definidos dentro de cada modalidade, fase por fase. Aqui ficam apenas as regras-base do torneio.
                </div>
              </div>
            </PlatformFormSection>

            <PlatformFormSection
              icon={CalendarDays}
              title="Datas operacionais"
              description="Controle o período do evento e o fechamento das inscrições sem sair da área administrativa."
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label>Início</Label>
                  <Input type="date" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} className="mt-2" />
                </div>
                <div>
                  <Label>Fim</Label>
                  <Input type="date" value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} className="mt-2" />
                </div>
                <div>
                  <Label>Fim das inscrições</Label>
                  <Input type="date" value={form.registration_deadline} onChange={(e) => set('registration_deadline', e.target.value)} className="mt-2" />
                </div>
              </div>
            </PlatformFormSection>
        </PlatformSurfaceCard>

        <div className="space-y-5">
          <PlatformSurfaceCard>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700/75">Status da operação</div>
            <h4 className="mt-2 text-xl font-semibold text-slate-950">Atualize o estado do evento com clareza</h4>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Escolha uma ação abaixo para refletir o momento atual do torneio em toda a plataforma.
            </p>

            <div className="mt-5 space-y-3">
              {STATUS_ACTIONS.map(({ value, label, description, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatus(value)}
                  className="flex w-full items-start gap-3 rounded-[1.35rem] border border-emerald-950/10 bg-white/75 p-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-950">{label}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </PlatformSurfaceCard>

          <PlatformSurfaceCard>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <Users className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-base font-semibold text-slate-950">Admins do torneio</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  O owner permanece fixo. Os demais admins compartilham gestão deste torneio sem impactar o admin geral da plataforma.
                </p>
              </div>
            </div>

            <ul className="mt-5 space-y-3">
              {admins.map((a) => (
                <li key={a.user_id} className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-emerald-950/10 bg-white/75 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-950">{a.user_name || a.user_email}</div>
                    <div className="mt-1 text-xs text-slate-500">{a.user_email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="shadow-none">
                      {a.role === TOURNAMENT_ADMIN_ROLE.OWNER ? 'Owner' : 'Admin'}
                    </Badge>
                    {a.role !== TOURNAMENT_ADMIN_ROLE.OWNER && (
                      <Button size="icon" variant="ghost" onClick={() => removeMutation.mutate(a.user_id)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-5 rounded-[1.5rem] border border-emerald-950/10 bg-secondary/35 p-4">
              <Label>Adicionar admin (e-mail do usuário já cadastrado)</Label>
              <div className="mt-3 flex gap-2">
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@dominio.com" type="email" />
                <Button onClick={handleAddAdmin} disabled={addMutation.isPending}>
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </PlatformSurfaceCard>
        </div>
      </div>
    </div>
  );
}
