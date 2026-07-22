import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, CalendarDays, Globe, Lock, MapPin, ShieldCheck, Trophy } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useCreateTournament } from '@/modules/tournament/hooks/useTournament';
import { useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import {
  RULESET,
  RULESET_LABELS,
  TOURNAMENT_VISIBILITY,
  TOURNAMENT_VISIBILITY_LABELS,
} from '@/modules/tournament/domain/constants';
import {
  V2Button, V2Field, V2Input, V2SectionHeader, V2Select, V2Surface, V2Textarea,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

const VISIBILITY_OPTIONS = [
  { value: TOURNAMENT_VISIBILITY.PUBLIC, title: 'Público', description: 'Aparece na lista pública e aceita inscrições diretas.', icon: Globe },
  { value: TOURNAMENT_VISIBILITY.PRIVATE, title: 'Privado', description: 'Exige código de ingresso compartilhado pelo admin.', icon: Lock },
];

function formatDatePreview(value) {
  if (!value) return 'A definir';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? 'A definir' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function V2CreateTournament() {
  const navigate = useNavigate();
  const { isAuthAvailable } = useAuth();
  const createMutation = useCreateTournament();
  const isPreview = import.meta.env.DEV && !isAuthAvailable;
  const [form, setForm] = useState({
    name: '', description: '', city: '', state: '', venue: '',
    visibility: TOURNAMENT_VISIBILITY.PUBLIC, ruleset: RULESET.CBP,
    starts_at: '', ends_at: '', registration_deadline: '',
    arena_id: '', // Sprint 4 ARE-14: arena vinculada (opcional)
  });
  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Informe o nome do torneio.');
    try {
      const id = await createMutation.mutateAsync({
        name: form.name, description: form.description, city: form.city, state: form.state, venue: form.venue,
        visibility: form.visibility, ruleset: form.ruleset,
        starts_at: form.starts_at || null, ends_at: form.ends_at || null, registration_deadline: form.registration_deadline || null,
        scoring: { ruleset: form.ruleset, win_by_two: true },
        arena_id: form.arena_id || null,
      });
      toast.success('Torneio criado!');
      navigate(`/torneios/${id}`);
    } catch (err) {
      toast.error(err.message || 'Falha ao criar torneio.');
    }
  }

  const locationPreview = form.city
    ? `${form.city}${form.state ? ` / ${form.state.toUpperCase()}` : ''}${form.venue ? ` · ${form.venue}` : ''}`
    : 'Cidade e local ainda não definidos';

  return (
    <div className="mx-auto max-w-[1200px]">
      <Link to="/torneios" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Voltar aos torneios
      </Link>

      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        {/* Hero + preview */}
        <div className="relative overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic">
          <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-acid opacity-20 blur-[80px]" />
          <div className="relative z-10">
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-acid">Novo torneio</span>
            <h1 className="mt-4 font-display text-3xl font-bold text-white sm:text-4xl">Monte um torneio com cara de evento real.</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-gray-300">Configure identidade, acesso, regras e calendário. A prévia abaixo atualiza enquanto você preenche.</p>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg">
              <div className="text-[11px] font-bold uppercase tracking-widest text-acid">Prévia do evento</div>
              <div className="mt-2 font-display text-2xl font-bold text-white">{form.name.trim() || 'Seu torneio ainda sem nome'}</div>
              <p className="mt-2 text-sm leading-6 text-gray-300">{form.description.trim() || 'Adicione uma descrição para dar contexto a atletas e público.'}</p>
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-300"><MapPin className="h-4 w-4 text-acid" /> {locationPreview}</div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <PreviewFact icon={form.visibility === TOURNAMENT_VISIBILITY.PUBLIC ? Globe : Lock} label="Acesso" value={TOURNAMENT_VISIBILITY_LABELS[form.visibility]} />
                <PreviewFact icon={ShieldCheck} label="Regras" value={RULESET_LABELS[form.ruleset]} />
                <PreviewFact icon={Trophy} label="Inscrições até" value={formatDatePreview(form.registration_deadline)} />
                <PreviewFact icon={CalendarDays} label="Datas" value={`${formatDatePreview(form.starts_at)} → ${formatDatePreview(form.ends_at)}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <V2Surface>
          <form onSubmit={handleSubmit} className="space-y-6">
            {isPreview && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                Prévia local sem Firebase: a criação fica desabilitada neste ambiente.
              </div>
            )}

            <V2SectionHeader eyebrow="Identidade" title="Dados do evento" titleClassName="text-xl" />
            <V2Field label="Nome do torneio" required>
              <V2Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Open de Pickleball de Floripa" />
            </V2Field>
            <V2Field label="Descrição">
              <V2Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Apresentação do torneio e o que o atleta deve esperar." />
            </V2Field>
            <div className="grid gap-4 sm:grid-cols-[1fr,120px]">
              <V2Field label="Cidade"><V2Input value={form.city} onChange={(e) => set('city', e.target.value)} /></V2Field>
              <V2Field label="UF"><V2Input value={form.state} onChange={(e) => set('state', e.target.value)} maxLength={2} /></V2Field>
            </div>
            <V2Field label="Local (quadra/clube)"><V2Input value={form.venue} onChange={(e) => set('venue', e.target.value)} /></V2Field>
            <ArenaSelectField value={form.arena_id} onChange={(v) => set('arena_id', v)} />

            <V2SectionHeader eyebrow="Acesso" title="Quem encontra e como entra" titleClassName="text-xl" />
            <div className="grid gap-3 sm:grid-cols-2">
              {VISIBILITY_OPTIONS.map(({ value, title, description, icon: Icon }) => {
                const active = form.visibility === value;
                return (
                  <button key={value} type="button" onClick={() => set('visibility', value)}
                    className={cn('rounded-3xl border p-5 text-left transition-all', active ? 'border-acid bg-acid/10' : 'border-gray-200 bg-paper-pure hover:border-ink/30')}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-display text-lg font-bold text-ink">{title}</div>
                      <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', active ? 'bg-acid text-ink' : 'bg-paper text-ink')}><Icon className="h-5 w-5" /></div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
                  </button>
                );
              })}
            </div>

            <V2SectionHeader eyebrow="Regras-base" title="Base regulamentar" titleClassName="text-xl" />
            <V2Field label="Conjunto de regras" hint="Pontos por game e sets são definidos depois, em cada modalidade/fase.">
              <V2Select value={form.ruleset} onChange={(e) => set('ruleset', e.target.value)}>
                {Object.values(RULESET).map((r) => <option key={r} value={r}>{RULESET_LABELS[r]}</option>)}
              </V2Select>
            </V2Field>

            <V2SectionHeader eyebrow="Calendário" title="Janela do evento" titleClassName="text-xl" />
            <div className="grid gap-4 sm:grid-cols-3">
              <V2Field label="Início"><V2Input type="date" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} /></V2Field>
              <V2Field label="Fim"><V2Input type="date" value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} /></V2Field>
              <V2Field label="Fim das inscrições"><V2Input type="date" value={form.registration_deadline} onChange={(e) => set('registration_deadline', e.target.value)} /></V2Field>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <V2Button type="button" variant="ghost" onClick={() => navigate('/torneios')}>Cancelar</V2Button>
              <V2Button type="submit" disabled={createMutation.isPending || isPreview}>
                {createMutation.isPending ? 'Criando…' : 'Criar torneio'} <ArrowRight className="h-4 w-4" />
              </V2Button>
            </div>
          </form>
        </V2Surface>
      </div>
    </div>
  );
}

function PreviewFact({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">{label}</span>
        <Icon className="h-3.5 w-3.5 text-white/60" />
      </div>
      <p className="mt-1.5 truncate text-xs font-semibold text-white">{value}</p>
    </div>
  );
}

function ArenaSelectField({ value, onChange }) {
  const { data: myArenas = [] } = useMyManagedArenas();
  if (myArenas.length === 0) return null;
  return (
    <V2Field label="Vincular a uma arena (opcional)">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
      >
        <option value="">— Nenhuma —</option>
        {myArenas.map((a) => (
          <option key={a.id} value={a.id}>{a.name}{a.city ? ` (${a.city})` : ''}</option>
        ))}
      </select>
    </V2Field>
  );
}
