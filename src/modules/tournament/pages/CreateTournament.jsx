import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { toast } from 'sonner';
import { useCreateTournament } from '@/modules/tournament/hooks/useTournament';
import {
  ArrowRight,
  CalendarDays,
  Globe,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
  Trophy,
} from 'lucide-react';
import {
  RULESET,
  RULESET_LABELS,
  TARGET_SCORE,
  TOURNAMENT_VISIBILITY,
  TOURNAMENT_VISIBILITY_LABELS,
} from '@/modules/tournament/domain/constants';

const VISIBILITY_OPTIONS = [
  {
    value: TOURNAMENT_VISIBILITY.PUBLIC,
    title: 'Público',
    description: 'Aparece na lista pública da plataforma e aceita inscrições diretas.',
    icon: Globe,
  },
  {
    value: TOURNAMENT_VISIBILITY.PRIVATE,
    title: 'Privado',
    description: 'Exige código de ingresso compartilhado pelo admin do torneio.',
    icon: Lock,
  },
];

const SETS_OPTIONS = [1, 3, 5];

function formatDatePreview(value) {
  if (!value) return 'A definir';
  try {
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? 'A definir'
      : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return 'A definir';
  }
}

export default function CreateTournament() {
  const navigate = useNavigate();
  const { isAuthAvailable, authUnavailableReason } = useAuth();
  const createMutation = useCreateTournament();
  const [form, setForm] = useState({
    name: '',
    description: '',
    city: '',
    state: '',
    venue: '',
    visibility: TOURNAMENT_VISIBILITY.PUBLIC,
    ruleset: RULESET.CBP,
    target_score: TARGET_SCORE.ELEVEN,
    sets_per_match: 1,
    starts_at: '',
    ends_at: '',
    registration_deadline: '',
  });

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Informe o nome do torneio.');
    try {
      const id = await createMutation.mutateAsync({
        name: form.name,
        description: form.description,
        city: form.city,
        state: form.state,
        venue: form.venue,
        visibility: form.visibility,
        ruleset: form.ruleset,
        starts_at: form.starts_at || null,
        ends_at: form.ends_at || null,
        registration_deadline: form.registration_deadline || null,
        scoring: {
          ruleset: form.ruleset,
          target_score: Number(form.target_score),
          sets_per_match: Number(form.sets_per_match),
          win_by_two: true,
        },
      });
      toast.success('Torneio criado!');
      navigate(`/torneios/${id}`);
    } catch (err) {
      toast.error(err.message || 'Falha ao criar torneio.');
    }
  }

  const selectedVisibility = VISIBILITY_OPTIONS.find((option) => option.value === form.visibility) || VISIBILITY_OPTIONS[0];
  const isPreviewMode = import.meta.env.DEV && !isAuthAvailable;
  const cancelDestination = isPreviewMode ? '/torneios/publicos' : '/inicio';
  const locationPreview = form.city
    ? `${form.city}${form.state ? ` / ${form.state.toUpperCase()}` : ''}${form.venue ? ` · ${form.venue}` : ''}`
    : 'Cidade e local ainda não definidos';
  const summaryItems = [
    {
      label: 'Acesso',
      value: TOURNAMENT_VISIBILITY_LABELS[form.visibility],
      icon: selectedVisibility.icon,
    },
    {
      label: 'Regras',
      value: RULESET_LABELS[form.ruleset],
      icon: ShieldCheck,
    },
    {
      label: 'Pontuação',
      value: `${form.target_score} pontos · ${form.sets_per_match} set(s)`,
      icon: Trophy,
    },
    {
      label: 'Datas',
      value: `${formatDatePreview(form.starts_at)} → ${formatDatePreview(form.ends_at)}`,
      icon: CalendarDays,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <Card className="arena-panel-strong overflow-hidden rounded-[2rem] border-0">
          <CardContent className="relative p-7 sm:p-8 lg:p-10">
            <div className="relative max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-50/80">
                <Sparkles className="h-3.5 w-3.5" /> Novo torneio
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-tight text-white lg:text-5xl">
                Monte um torneio com cara de evento real antes mesmo da primeira inscrição.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-emerald-50/75 sm:text-base">
                Configure identidade, acesso, regras e calendário do evento. O resumo ao lado atualiza enquanto você preenche.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-white/80 bg-white/82">
          <CardContent className="p-6 sm:p-7">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700/75">Resumo</div>
            <h2 className="mt-3 text-2xl font-semibold text-slate-950">Prévia do torneio em tempo real.</h2>
            <div className="mt-5 rounded-[1.5rem] border border-emerald-950/10 bg-secondary/35 p-5">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700/75">Prévia do evento</div>
              <div className="mt-3 text-2xl font-semibold text-slate-950">
                {form.name.trim() || 'Seu torneio ainda sem nome'}
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {form.description.trim() || 'Adicione uma descrição para dar contexto a atletas, admins e público.'}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
                <MapPin className="h-4 w-4 text-emerald-700" /> {locationPreview}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {summaryItems.map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-[1.25rem] border border-emerald-950/10 bg-white/75 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700/75">{label}</div>
                      <div className="truncate text-sm font-medium text-slate-950">{value}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-emerald-950/10 bg-white/75 p-5 text-sm leading-6 text-slate-600">
              O código de convite para torneios privados é gerado automaticamente após a criação. Depois disso, a operação continua na tela do próprio torneio.
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-[2rem] border-white/80 bg-white/82">
        <CardContent className="p-6 sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-6">
            {isPreviewMode && (
              <div className="rounded-[1.5rem] border border-amber-300/70 bg-amber-50/85 p-4 text-sm leading-6 text-amber-950">
                Prévia local sem Firebase: você pode revisar o layout e preencher os campos, mas a criação do torneio fica desabilitada neste ambiente.
                {authUnavailableReason ? ` ${authUnavailableReason}` : ''}
              </div>
            )}

            <section className="space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700/75">Identidade do evento</div>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950">Como o torneio será percebido logo no primeiro contato</h3>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <Label>Nome do torneio</Label>
                  <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Open de Pickleball de Floripa" className="mt-2" />
                </div>
                <div className="md:col-span-2">
                  <Label>Descrição</Label>
                  <textarea
                    className="mt-2 flex min-h-28 w-full rounded-[1rem] border border-input bg-background px-3 py-3 text-sm"
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder="Apresentação do torneio, proposta do evento e o que o atleta deve esperar."
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

            <section className="space-y-4 rounded-[1.5rem] border border-emerald-950/10 bg-secondary/35 p-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700/75">Acesso</div>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">Defina quem encontra e como entra no torneio</h3>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {VISIBILITY_OPTIONS.map(({ value, title, description, icon: Icon }) => {
                  const active = form.visibility === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => set('visibility', value)}
                      className={[
                        'rounded-[1.35rem] border p-5 text-left transition-all duration-200',
                        active
                          ? 'border-emerald-500/35 bg-white text-slate-950 shadow-[0_18px_36px_-24px_rgba(5,150,105,0.35)]'
                          : 'border-emerald-950/10 bg-white/75 text-slate-700 hover:border-emerald-400/35',
                      ].join(' ')}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-lg font-semibold">{title}</div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="space-y-4 rounded-[1.5rem] border border-emerald-950/10 bg-white/75 p-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700/75">Regras e pontuação</div>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">Configure o padrão esportivo do evento</h3>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label>Conjunto de regras</Label>
                  <select
                    className="mt-2 h-11 w-full rounded-[1rem] border border-input bg-background px-3 text-sm"
                    value={form.ruleset}
                    onChange={(e) => set('ruleset', e.target.value)}
                  >
                    {Object.values(RULESET).map((r) => (
                      <option key={r} value={r}>{RULESET_LABELS[r]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Pontos por game</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.values(TARGET_SCORE).map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => set('target_score', score)}
                        className={[
                          'rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200',
                          Number(form.target_score) === score
                            ? 'border-emerald-500/35 bg-emerald-600 text-white'
                            : 'border-emerald-950/10 bg-background text-slate-700 hover:border-emerald-400/35',
                        ].join(' ')}
                      >
                        {score} pontos
                      </button>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <Label>Sets por partida</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SETS_OPTIONS.map((sets) => (
                      <button
                        key={sets}
                        type="button"
                        onClick={() => set('sets_per_match', sets)}
                        className={[
                          'rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200',
                          Number(form.sets_per_match) === sets
                            ? 'border-emerald-500/35 bg-emerald-600 text-white'
                            : 'border-emerald-950/10 bg-background text-slate-700 hover:border-emerald-400/35',
                        ].join(' ')}
                      >
                        {sets === 1 ? '1 set' : `Melhor de ${sets}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[1.25rem] border border-emerald-200 bg-emerald-50/70 p-4 text-sm leading-6 text-emerald-950">
                A classificação padrão da plataforma usa número de vitórias, saldo de pontos, maior número de pontos marcados e, por fim, menor número de pontos sofridos. Você não precisa configurar isso manualmente.
              </div>
            </section>

            <section className="space-y-4 rounded-[1.5rem] border border-emerald-950/10 bg-white/75 p-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700/75">Calendário</div>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">Marque a janela do evento e o fechamento das inscrições</h3>
              </div>

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
            </section>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate(cancelDestination)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || isPreviewMode}>
                {createMutation.isPending ? 'Criando…' : isPreviewMode ? 'Criação indisponível no preview' : 'Criar torneio'}
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
