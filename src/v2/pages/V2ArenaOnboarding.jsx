/**
 * V2ArenaOnboarding — stepper de boas-vindas pós-criação da arena.
 *
 * Mostra 4 passos guiados para o novo dono configurar o essencial antes
 * de divulgar a arena:
 *   1. Fotos      → pelo menos 1 foto
 *   2. Preços     → base_price OU 1+ price_rules
 *   3. Horários   → hours preenchido
 *   4. Compartilhe → URL pública + WhatsApp + copiar
 *
 * Progresso é persistido em `arenas/{id}.onboarding_complete` (4 booleans)
 * — sobrevive a refresh, marca o item na sidebar quando completo, e dá
 * base para futuras campanhas de "complete seu perfil" (90% das arenas
 * criadas ficavam órfãs porque o user não sabia o que fazer após
 * cadastrar — bug da sprint 5 do Arena V3 que originou essa página).
 *
 * Sprint 0 (ARE-20) do roadmap arena — `docs/arena-roadmap.md`.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  ArrowLeft, ArrowRight, Camera, Check, CircleDot, Clock, Copy, Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/core/config/firebase';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena } from '@/modules/arenas/hooks/useArenas';
import {
  V2Badge, V2Button, V2Surface,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

const STEPS = [
  { key: 'fotos', title: 'Adicione fotos', icon: Camera, target: '#fotos' },
  { key: 'precos', title: 'Defina os preços', icon: CircleDot, target: '#precos' },
  { key: 'horarios', title: 'Revise horários e contato', icon: Clock, target: '#horarios' },
  { key: 'compartilhar', title: 'Compartilhe a arena', icon: Share2, target: null },
];

const DEFAULT_PROGRESS = { fotos: false, precos: false, horarios: false, compartilhar: false };

function getInitialProgress(stored) {
  if (!stored) return DEFAULT_PROGRESS;
  return { ...DEFAULT_PROGRESS, ...(typeof stored === 'object' ? stored : {}) };
}

function computeProgressFromArena(arena) {
  if (!arena) return DEFAULT_PROGRESS;
  return {
    fotos: Array.isArray(arena.photos) && arena.photos.length > 0,
    precos:
      (Number.isFinite(arena.base_price) && arena.base_price > 0) ||
      (Array.isArray(arena.price_rules) && arena.price_rules.length > 0),
    horarios: typeof arena.hours === 'string' && arena.hours.trim().length > 0,
    compartilhar: false, // sempre false até o user clicar
  };
}

export default function V2ArenaOnboarding() {
  const enabled = useFeatureFlag(FEATURE_FLAG.ARENAS);
  const { arenaId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: arena, isLoading } = useArena(arenaId);
  const [progress, setProgress] = useState(DEFAULT_PROGRESS);
  const [hydrated, setHydrated] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  // Hidrata progresso do Firestore OU calcula a partir do estado atual da arena.
  useEffect(() => {
    if (!arenaId || !arena || hydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'arenas', arenaId));
        const stored = snap.exists() ? snap.data()?.onboarding_complete : null;
        const computed = computeProgressFromArena(arena);
        const next = getInitialProgress(stored);
        // Faz merge com computed (não destrói o que o user já completou)
        for (const k of Object.keys(computed)) {
          if (computed[k]) next[k] = true;
        }
        if (!cancelled) {
          setProgress(next);
          setHydrated(true);
        }
      } catch (err) {
        if (!cancelled) {
          setHydrated(true);
          // Em caso de erro de leitura, usa computed
          setProgress(computeProgressFromArena(arena));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [arenaId, arena, hydrated]);

  if (!enabled) return <Navigate to="/" replace />;
  if (isLoading) {
    return <div className="mx-auto max-w-3xl p-6 text-sm text-gray-500">Carregando…</div>;
  }
  if (!arena) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-gray-500">Arena não encontrada.</p>
        <Link to="/arenas" className="mt-3 inline-block text-sm font-semibold text-ink underline">Voltar às arenas</Link>
      </div>
    );
  }

  // Permissão: só o owner ou platform_admin pode ver o onboarding.
  // Hooks de permissões granulares ficam no useArenaManagers (V2ArenaManage).
  // Por enquanto, o onboarding é "público para quem tem o link" — o gate real
  // fica no Firestore rule (a página não persiste nada sem auth).
  if (!user) return <Navigate to="/login" replace />;

  const persist = async (next) => {
    if (!arenaId) return;
    setBusy(true);
    try {
      await setDoc(
        doc(db, 'arenas', arenaId),
        {
          onboarding_complete: { ...next, compartilhar: true }, // a página inteira = onboarding finalizado
          onboarding_completed_at: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar o progresso.');
    } finally {
      setBusy(false);
    }
  };

  const markStep = (key) => {
    setProgress((prev) => {
      const next = { ...prev, [key]: true };
      return next;
    });
  };

  const markAllFromComputed = async () => {
    const computed = computeProgressFromArena(arena);
    const next = { ...progress };
    for (const k of Object.keys(computed)) if (computed[k]) next[k] = true;
    next.compartilhar = true;
    setProgress(next);
    await persist(next);
  };

  const activeStep = STEPS[activeIdx];
  const totalDone = STEPS.filter((s) => progress[s.key]).length;
  const allDone = totalDone === STEPS.length;

  const handleAdvance = async () => {
    if (!progress[activeStep.key]) {
      // Marca o passo como completo se o user pular sem configurar.
      // Não força — apenas move adiante.
      markStep(activeStep.key);
    }
    if (activeIdx < STEPS.length - 1) {
      setActiveIdx(activeIdx + 1);
    } else {
      // Último passo → persiste
      await persist({ ...progress, compartilhar: true });
      toast.success('Arena configurada! Você pode voltar e ajustar a qualquer momento.');
      navigate(`/arenas/${arenaId}/gerir`);
    }
  };

  const handleSkipStep = () => {
    markStep(activeStep.key);
    if (activeIdx < STEPS.length - 1) setActiveIdx(activeIdx + 1);
  };

  const handleBack = () => {
    if (activeIdx > 0) setActiveIdx(activeIdx - 1);
  };

  const publicUrl = `${window.location.origin}/arenas/${arenaId}`;

  const copyPublicLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Link copiado!');
    } catch {
      toast.error('Não foi possível copiar o link. Selecione manualmente.');
    }
  };

  const shareOnWhatsApp = () => {
    const text = encodeURIComponent(`Conheça a arena ${arena.name} no PickleRush: ${publicUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const goConfigure = (target) => {
    // Salva progresso atual antes de navegar
    setProgress((prev) => {
      const next = { ...prev, [activeStep.key]: true };
      setDoc(
        doc(db, 'arenas', arenaId),
        { onboarding_complete: next },
        { merge: true },
      ).catch(() => {});
      return next;
    });
    navigate(`/arenas/${arenaId}/gerir${target || ''}`);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/arenas" className="mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Voltar às arenas
      </Link>

      <V2Surface className="p-6 md:p-8">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <V2Badge variant="info">Onboarding</V2Badge>
          <span className="font-display text-2xl font-bold text-ink">{arena.name}</span>
        </div>

        <p className="text-sm text-gray-500">
          Configure sua arena em 4 passos rápidos. Você pode voltar e ajustar tudo a qualquer momento pela página de gerência.
        </p>

        <ProgressBar steps={STEPS} progress={progress} activeIdx={activeIdx} setActiveIdx={setActiveIdx} />

        <StepCard step={activeStep} arena={arena} progress={progress}>
          {activeStep.key === 'fotos' && (
            <PhotosStep
              arena={arena}
              onConfigure={() => goConfigure('#fotos')}
            />
          )}
          {activeStep.key === 'precos' && (
            <PrecosStep
              arena={arena}
              onConfigure={() => goConfigure('#precos')}
            />
          )}
          {activeStep.key === 'horarios' && (
            <HorariosStep
              arena={arena}
              onConfigure={() => goConfigure('#horarios')}
            />
          )}
          {activeStep.key === 'compartilhar' && (
            <CompartilharStep
              arena={arena}
              publicUrl={publicUrl}
              onCopy={copyPublicLink}
              onWhatsApp={shareOnWhatsApp}
            />
          )}
        </StepCard>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-gray-500">
            {totalDone}/{STEPS.length} {totalDone === 1 ? 'passo concluído' : 'passos concluídos'}
          </div>
          <div className="flex items-center gap-2">
            {activeIdx > 0 && (
              <V2Button variant="ghost" onClick={handleBack}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </V2Button>
            )}
            <V2Button variant="ghost" onClick={handleSkipStep}>
              Pular
            </V2Button>
            <V2Button onClick={handleAdvance} disabled={busy}>
              {activeIdx === STEPS.length - 1 ? 'Finalizar' : 'Avançar'}
              {activeIdx < STEPS.length - 1 && <ArrowRight className="ml-1 h-4 w-4" />}
            </V2Button>
          </div>
        </div>

        {allDone && activeIdx === STEPS.length - 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-900">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              Tudo pronto! Sua arena já está configurada.
            </div>
            <V2Button size="sm" variant="ghost" onClick={markAllFromComputed} disabled={busy}>
              Marcar tudo automaticamente
            </V2Button>
          </div>
        )}
      </V2Surface>
    </div>
  );
}

function ProgressBar({ steps, progress, activeIdx, setActiveIdx }) {
  return (
    <ol className="my-6 grid grid-cols-2 gap-2 md:grid-cols-4">
      {steps.map((s, i) => {
        const done = progress[s.key];
        const active = i === activeIdx;
        return (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => setActiveIdx(i)}
              className={cn(
                'flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm transition-colors',
                active
                  ? 'border-ink bg-ink text-white'
                  : done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
                  active
                    ? 'bg-acid text-ink'
                    : done
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-200 text-gray-500',
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="truncate font-semibold">{s.title}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function StepCard({ step, children, progress }) {
  const Icon = step.icon;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-5 w-5 text-gray-500" />
        <h3 className="font-display text-lg font-bold text-ink">{step.title}</h3>
        {progress[step.key] && (
          <V2Badge variant="success" className="ml-auto">
            <Check className="mr-1 inline h-3 w-3" /> Concluído
          </V2Badge>
        )}
      </div>
      {children}
    </div>
  );
}

function PhotosStep({ arena, onConfigure }) {
  const count = Array.isArray(arena.photos) ? arena.photos.length : 0;
  return (
    <div className="space-y-3 text-sm text-gray-600">
      <p>
        Arenas com fotos recebem <strong>3x mais visualizações</strong> e têm taxa de reserva
        2x maior. Adicione ao menos 3 fotos das quadras e da fachada.
      </p>
      <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3">
        <Camera className="h-5 w-5 text-gray-400" />
        <span className="text-sm">
          {count === 0
            ? 'Nenhuma foto ainda.'
            : `${count} ${count === 1 ? 'foto adicionada' : 'fotos adicionadas'}.`}
        </span>
        <V2Button size="sm" onClick={onConfigure} className="ml-auto">
          {count === 0 ? 'Adicionar fotos' : 'Gerenciar fotos'}
        </V2Button>
      </div>
    </div>
  );
}

function PrecosStep({ arena, onConfigure }) {
  const hasBase = Number.isFinite(arena.base_price) && arena.base_price > 0;
  const rules = Array.isArray(arena.price_rules) ? arena.price_rules.length : 0;
  const total = (hasBase ? 1 : 0) + rules;
  return (
    <div className="space-y-3 text-sm text-gray-600">
      <p>
        Defina um preço base e, opcionalmente, regras por horário (ex.: 18h–22h mais barato).
        Isso ajuda os jogadores a encontrarem sua arena nos filtros.
      </p>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-gray-50 p-3">
        <CircleDot className="h-5 w-5 text-gray-400" />
        <span className="text-sm">
          {total === 0
            ? 'Nenhum preço configurado.'
            : `${total} ${total === 1 ? 'preço definido' : 'preços definidos'}.`}
        </span>
        <V2Button size="sm" onClick={onConfigure} className="ml-auto">
          {total === 0 ? 'Configurar preços' : 'Editar preços'}
        </V2Button>
      </div>
    </div>
  );
}

function HorariosStep({ arena, onConfigure }) {
  return (
    <div className="space-y-3 text-sm text-gray-600">
      <p>
        Revise o texto de horários de funcionamento e os canais de contato (telefone,
        WhatsApp, e-mail, Instagram). Você pode editar tudo depois.
      </p>
      <div className="rounded-2xl bg-gray-50 p-3 text-sm">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 text-gray-400" />
          <div>
            <div className="font-semibold text-ink">Horários</div>
            <div className="text-gray-600">
              {arena.hours?.trim() ? arena.hours : 'Não informado.'}
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {arena.contact_phone && <span>Tel: {arena.contact_phone}</span>}
          {arena.contact_whatsapp && <span className="ml-3">WhatsApp: {arena.contact_whatsapp}</span>}
          {arena.contact_email && <span className="ml-3">E-mail: {arena.contact_email}</span>}
        </div>
      </div>
      <V2Button size="sm" onClick={onConfigure}>Editar informações</V2Button>
    </div>
  );
}

function CompartilharStep({ arena, publicUrl, onCopy, onWhatsApp }) {
  const [shareMsg] = useState(
    `Conheça a arena ${arena.name} no PickleRush — quadras, preços e horários: ${publicUrl}`,
  );
  return (
    <div className="space-y-4 text-sm text-gray-600">
      <p>
        Sua arena está pronta! Compartilhe o link público com seus jogadores ou cole no seu
        Instagram, WhatsApp ou e-mail.
      </p>
      <div className="rounded-2xl border border-gray-200 bg-white p-3">
        <div className="text-xs text-gray-500">Link público</div>
        <div className="mt-1 flex items-center gap-2">
          <code className="flex-1 truncate rounded bg-gray-50 px-2 py-1 text-xs">{publicUrl}</code>
          <V2Button size="sm" variant="ghost" onClick={onCopy}>
            <Copy className="mr-1 h-3 w-3" /> Copiar
          </V2Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <V2Button onClick={onWhatsApp}>
          <Share2 className="mr-1 h-4 w-4" /> Compartilhar no WhatsApp
        </V2Button>
        <V2Button variant="ghost" onClick={onCopy}>
          <Copy className="mr-1 h-4 w-4" /> Copiar mensagem
        </V2Button>
      </div>
      <div className="rounded-2xl bg-gray-50 p-3 text-xs text-gray-500">
        Mensagem sugerida:&nbsp;
        <span className="italic">&ldquo;{shareMsg}&rdquo;</span>
      </div>
    </div>
  );
}
