import React, { Suspense, lazy, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, CalendarDays, Check, FileStack, Globe, Lock, MapPin, ShieldCheck, Trophy } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useCreateTournament, useMyTournaments, useDuplicateTournament } from '@/modules/tournament/hooks/useTournament';
import { listModalities } from '@/modules/tournament/services/modalityService';
import { useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import {
  RULESET,
  RULESET_LABELS,
  TOURNAMENT_VISIBILITY,
  TOURNAMENT_VISIBILITY_LABELS,
} from '@/modules/tournament/domain/constants';
import {
  V2Button, V2Field, V2Input, V2SectionHeader, V2Select, V2Surface, V2Textarea, V2BackLink, V2Page,
  HERO_TITLE,
} from '@/v2/ui/primitives';
import { useRoleConsent } from '@/v2/components/legal/useRoleConsent';
import V2TutorialLauncher from '@/v2/components/tutorial/V2TutorialLauncher';
import { TUTORIAL_ID } from '@/modules/help/domain/tutorials';
import { cn } from '@/core/lib/utils';
import { t, tk, fmtData } from '@/core/i18n';

// Só baixa o código da federação quando a tela vem da Central (`?federacao=`).
const FedTournamentOrigin = lazy(() => import('@/v2/components/federations/FedTournamentOrigin'));

const VISIBILITY_OPTIONS = [
  { value: TOURNAMENT_VISIBILITY.PUBLIC, title: tk('Público'), description: tk('Aparece na lista pública e aceita inscrições diretas.'), icon: Globe },
  { value: TOURNAMENT_VISIBILITY.PRIVATE, title: tk('Privado'), description: tk('Exige código de ingresso compartilhado pelo admin.'), icon: Lock },
];

function formatDatePreview(value) {
  if (!value) return t('A definir');
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? t('A definir') : fmtData(date, { day: '2-digit', month: 'short', year: 'numeric' });
}

const WIZARD_STEPS = [
  { id: 'identidade', label: tk('Identidade') },
  { id: 'acesso', label: tk('Acesso e regras') },
  { id: 'calendario', label: tk('Calendário') },
];

export default function V2CreateTournament() {
  const navigate = useNavigate();
  const { isAuthAvailable, user } = useAuth();
  const createMutation = useCreateTournament();
  const wizardOn = true;
  const isPreview = import.meta.env.DEV && !isAuthAvailable;
  const [step, setStep] = useState(0);
  // `?arena=<id>`: veio da Central da arena ("Criar torneio aqui") — a arena
  // já chega escolhida como sede.
  const [params] = useSearchParams();
  const [form, setForm] = useState(() => ({
    name: '', description: '', city: '', state: '', venue: '',
    visibility: TOURNAMENT_VISIBILITY.PUBLIC, ruleset: RULESET.CBP,
    starts_at: '', ends_at: '', registration_deadline: '',
    arena_id: params.get('arena') || '', // Sprint 4 ARE-14: arena vinculada (opcional)
  }));
  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  // `?federacao=<id>`: veio da Central da federação ("Criar torneio da federação").
  // Pronto (permissão, federação pública, categoria) ⇒ sai já como "Realizado pela".
  const fedId = params.get('federacao') || '';
  const [fedChoice, setFedChoice] = useState(null);
  const roleConsent = useRoleConsent('termos-organizador');

  const isLastStep = step === WIZARD_STEPS.length - 1;
  const showStep = (idx) => !wizardOn || step === idx;

  function goNext() {
    if (step === 0 && !form.name.trim()) { toast.error(t('Informe o nome do torneio.')); return; }
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // No modo assistente, "Enter"/submit em etapas intermediárias apenas avança.
    if (wizardOn && !isLastStep) { goNext(); return; }
    if (!form.name.trim()) { setStep(0); return toast.error(t('Informe o nome do torneio.')); }
    if (!roleConsent.guardBeforeSubmit()) return;
    try {
      const payload = {
        name: form.name, description: form.description, city: form.city, state: form.state, venue: form.venue,
        visibility: form.visibility, ruleset: form.ruleset,
        starts_at: form.starts_at || null, ends_at: form.ends_at || null, registration_deadline: form.registration_deadline || null,
        scoring: { ruleset: form.ruleset, win_by_two: true },
        arena_id: form.arena_id || null,
      };
      const id = await createMutation.mutateAsync(payload);
      await roleConsent.recordAfterSuccess();
      if (fedChoice) {
        // O torneio já existe: falhando a federação, ele segue comum e o pedido (se gravado) fica em Chancelas.
        try {
          const { startFederationTournament } = await import('@/modules/federations/services/federationService');
          await startFederationTournament({ id, ...payload, creator_uid: user?.uid }, { ...fedChoice, uid: user?.uid });
          toast.success(t('Torneio criado e realizado pela {sigla}.', { sigla: fedChoice.federation.acronym || fedChoice.federation.name }));
        } catch (err) {
          toast.error(t('Torneio criado, mas a federação não foi aplicada: {erro}. Confira em Competições → Chancelas.', { erro: err?.message || t('erro desconhecido') }));
        }
        navigate(`/torneios/${id}`);
        return;
      }
      toast.success(t('Torneio criado!'));
      navigate(`/torneios/${id}`);
    } catch (err) {
      toast.error(err.message || t('Falha ao criar torneio.'));
    }
  }

  const locationPreview = form.city
    ? `${form.city}${form.state ? ` / ${form.state.toUpperCase()}` : ''}${form.venue ? ` · ${form.venue}` : ''}`
    : t('Cidade e local ainda não definidos');

  return (
    <V2Page>
      <V2BackLink to="/torneios" className="mb-5">{t('Voltar aos torneios')}</V2BackLink>

      <TemplatePicker />

      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        {/* Hero + preview */}
        <div className="relative overflow-hidden rounded-4xl bg-mesh p-8 shadow-organic">
          <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-acid opacity-20 blur-[80px]" />
          <div className="relative z-10">
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-acid">{t('Novo torneio')}</span>
            <h1 className={`mt-4 ${HERO_TITLE}`}>{t('Monte um torneio com cara de evento real.')}</h1>
            <p className="mt-3 max-w-xl text-sm leading-7 text-gray-300">{t('Configure identidade, acesso, regras e calendário. A prévia abaixo atualiza enquanto você preenche.')}</p>

            {/* O tutorial completo (criação → modalidades → inscrições →
                sorteio → resultados) já aqui, para quem nunca montou um
                torneio. `autoOpen` desligado: quem chegou nesta tela veio
                fazer, não ler — mas a porta fica visível.
                Compartilha a mesma marca de "já vi" com o console de gestão. */}
            <div className="mt-5">
              <V2TutorialLauncher
                tutorialId={TUTORIAL_ID.TOURNAMENT}
                label={t('Como funciona um torneio')}
                autoOpen={false}
                guia="criar-torneio"
              />
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-lg">
              <div className="text-2xs font-bold uppercase tracking-widest text-acid">{t('Prévia do evento')}</div>
              <div className="mt-2 font-display text-2xl font-bold text-white">{form.name.trim() || t('Seu torneio ainda sem nome')}</div>
              <p className="mt-2 text-sm leading-6 text-gray-300">{form.description.trim() || t('Adicione uma descrição para dar contexto a atletas e público.')}</p>
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-300"><MapPin className="h-4 w-4 text-acid" /> {locationPreview}</div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <PreviewFact icon={form.visibility === TOURNAMENT_VISIBILITY.PUBLIC ? Globe : Lock} label={t('Acesso')} value={TOURNAMENT_VISIBILITY_LABELS[form.visibility]} />
                <PreviewFact icon={ShieldCheck} label={t('Regras')} value={RULESET_LABELS[form.ruleset]} />
                <PreviewFact icon={Trophy} label={t('Inscrições até')} value={formatDatePreview(form.registration_deadline)} />
                <PreviewFact icon={CalendarDays} label={t('Datas')} value={`${formatDatePreview(form.starts_at)} → ${formatDatePreview(form.ends_at)}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <V2Surface>
          <form onSubmit={handleSubmit} className="space-y-6">
            {isPreview && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                {t('Prévia local sem Firebase: a criação fica desabilitada neste ambiente.')}
              </div>
            )}

            {wizardOn && <WizardStepper steps={WIZARD_STEPS} current={step} onGo={setStep} />}

            {showStep(0) && (<>
            <V2SectionHeader eyebrow={t('Identidade')} title={t('Dados do evento')} titleClassName="text-xl" />
            <div data-dica="criar-torneio-nome">
              <V2Field label={t('Nome do torneio')} required>
                <V2Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={t('Ex.: Open de Pickleball de Floripa')} />
              </V2Field>
            </div>
            <V2Field label={t('Descrição')}>
              <V2Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder={t('Apresentação do torneio e o que o atleta deve esperar.')} />
            </V2Field>
            <div className="grid gap-4 sm:grid-cols-[1fr,120px]">
              <V2Field label={t('Cidade')}><V2Input value={form.city} onChange={(e) => set('city', e.target.value)} /></V2Field>
              <V2Field label={t('UF')}><V2Input value={form.state} onChange={(e) => set('state', e.target.value)} maxLength={2} /></V2Field>
            </div>
            <V2Field label={t('Local (quadra/clube)')}><V2Input value={form.venue} onChange={(e) => set('venue', e.target.value)} /></V2Field>
            <ArenaSelectField value={form.arena_id} onChange={(v) => set('arena_id', v)} />
            {fedId && (
              <Suspense fallback={null}>
                <FedTournamentOrigin federationId={fedId} onChange={setFedChoice} />
              </Suspense>
            )}
            </>)}

            {showStep(1) && (<>
            <V2SectionHeader eyebrow={t('Acesso')} title={t('Quem encontra e como entra')} titleClassName="text-xl" />
            <div data-dica="criar-torneio-acesso" className="grid gap-3 sm:grid-cols-2">
              {VISIBILITY_OPTIONS.map(({ value, title, description, icon: Icon }) => {
                const active = form.visibility === value;
                return (
                  <button key={value} type="button" onClick={() => set('visibility', value)}
                    className={cn('rounded-3xl border p-5 text-left transition-all', active ? 'border-acid bg-acid/10' : 'border-gray-200 bg-paper-pure hover:border-ink/30')}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-display text-lg font-bold text-ink">{t(title)}</div>
                      <div className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', active ? 'bg-acid text-ink' : 'bg-paper text-ink')}><Icon className="h-5 w-5" /></div>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-gray-500">{t(description)}</p>
                  </button>
                );
              })}
            </div>

            <V2SectionHeader eyebrow={t('Regras-base')} title={t('Base regulamentar')} titleClassName="text-xl" />
            <V2Field label={t('Conjunto de regras')} hint={t('Pontos por game e sets são definidos depois, em cada modalidade/fase.')}>
              <V2Select value={form.ruleset} onChange={(e) => set('ruleset', e.target.value)}>
                {Object.values(RULESET).map((r) => <option key={r} value={r}>{RULESET_LABELS[r]}</option>)}
              </V2Select>
            </V2Field>
            </>)}

            {showStep(2) && (<>
            <V2SectionHeader eyebrow={t('Calendário')} title={t('Janela do evento')} titleClassName="text-xl" />
            <div data-dica="criar-torneio-datas" className="grid gap-4 sm:grid-cols-3">
              <V2Field label={t('Início')}><V2Input type="date" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)} /></V2Field>
              <V2Field label={t('Fim')}><V2Input type="date" value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)} /></V2Field>
              <V2Field label={t('Fim das inscrições')}><V2Input type="date" value={form.registration_deadline} onChange={(e) => set('registration_deadline', e.target.value)} /></V2Field>
            </div>
            </>)}

            {(!wizardOn || isLastStep) && roleConsent.field && (
              <div className="pt-2">{roleConsent.field}</div>
            )}

            {wizardOn ? (
              <div className="flex justify-between gap-2 pt-2">
                <V2Button type="button" variant="ghost" onClick={() => (step === 0 ? navigate('/torneios') : setStep((s) => s - 1))}>
                  {step === 0 ? t('Cancelar') : <><ArrowLeft className="h-4 w-4" /> {t('Voltar')}</>}
                </V2Button>
                {isLastStep ? (
                  <V2Button type="submit" disabled={createMutation.isPending || isPreview} data-dica="criar-torneio-criar">
                    {createMutation.isPending ? t('Criando…') : t('Criar torneio')} <Check className="h-4 w-4" />
                  </V2Button>
                ) : (
                  <V2Button type="button" onClick={goNext} data-dica="criar-torneio-avancar">{t('Avançar')} <ArrowRight className="h-4 w-4" /></V2Button>
                )}
              </div>
            ) : (
              <div className="flex justify-end gap-2 pt-2">
                <V2Button type="button" variant="ghost" onClick={() => navigate('/torneios')}>{t('Cancelar')}</V2Button>
                <V2Button type="submit" disabled={createMutation.isPending || isPreview} data-dica="criar-torneio-criar">
                  {createMutation.isPending ? t('Criando…') : t('Criar torneio')} <ArrowRight className="h-4 w-4" />
                </V2Button>
              </div>
            )}
          </form>
        </V2Surface>
      </div>
    </V2Page>
  );
}

function TemplatePicker() {
  const navigate = useNavigate();
  const templatesOn = true;
  const { data: myTournaments = [] } = useMyTournaments();
  const duplicate = useDuplicateTournament();
  const [templateId, setTemplateId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const templates = (myTournaments || []).filter((tt) => tt.is_template);
  if (!templatesOn || templates.length === 0) return null;

  async function createFromTemplate() {
    const source = templates.find((tt) => tt.id === templateId);
    if (!source) { toast.error(t('Escolha um modelo.')); return; }
    setBusy(true);
    try {
      const modalities = await listModalities(source.id);
      const res = await duplicate.mutateAsync({
        source,
        copyDefinitions: true,
        name: name.trim() || `${source.name} (novo)`,
        modalities: (modalities || []).map((m) => ({ modality: m, copyRegistrations: false })),
      });
      toast.success(t('Torneio criado a partir do modelo.'));
      navigate(`/torneios/${res.tournamentId}`);
    } catch (err) {
      toast.error(err?.message || t('Não foi possível criar a partir do modelo.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <V2Surface className="mb-6 border-2 border-dashed border-acid/40">
      <div className="flex items-center gap-2">
        <FileStack className="h-5 w-5 text-ink" />
        <h2 className="font-display text-lg font-bold text-ink">{t('Criar a partir de um modelo')}</h2>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        {t('Reaproveite a estrutura de um torneio marcado como modelo (definições e modalidades, sem inscritos).')}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr,1fr,auto] sm:items-end">
        <V2Field label={t('Modelo')}>
          <V2Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">{t('— Escolher modelo —')}</option>
            {templates.map((tt) => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
          </V2Select>
        </V2Field>
        <V2Field label={t('Nome do novo torneio')}>
          <V2Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Deixe em branco para usar o nome do modelo')} />
        </V2Field>
        <V2Button type="button" onClick={createFromTemplate} disabled={busy || !templateId}>
          {busy ? t('Criando…') : t('Criar do modelo')}
        </V2Button>
      </div>
    </V2Surface>
  );
}

function WizardStepper({ steps, current, onGo }) {
  return (
    <div data-dica="criar-torneio-etapas" className="flex items-center gap-2">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <React.Fragment key={s.id}>
            <button
              type="button"
              onClick={() => (i <= current ? onGo(i) : null)}
              disabled={i > current}
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold transition-colors',
                active ? 'bg-ink text-white' : done ? 'bg-acid/20 text-ink' : 'bg-paper text-gray-400',
              )}
            >
              <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-2xs', active ? 'bg-acid text-ink' : done ? 'bg-ink text-acid' : 'bg-gray-200 text-gray-500')}>
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="hidden sm:inline">{t(s.label)}</span>
            </button>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-gray-200" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function PreviewFact({ icon: Icon, label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-bold uppercase tracking-widest text-white/50">{label}</span>
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
    <V2Field label={t('Vincular a uma arena (opcional)')}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
      >
        <option value="">{t('— Nenhuma —')}</option>
        {myArenas.map((a) => (
          <option key={a.id} value={a.id}>{a.name}{a.city ? ` (${a.city})` : ''}</option>
        ))}
      </select>
    </V2Field>
  );
}
