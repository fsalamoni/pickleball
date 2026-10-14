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
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useArena } from '@/modules/arenas/hooks/useArenas';
import {
  V2Badge, V2Button, V2Surface,
  V2ErrorState, V2BackLink, V2Skeleton,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import { t, tn, tk } from '@/core/i18n';

const STEPS = [
  { key: 'fotos', title: tk('Adicione fotos'), icon: Camera, target: '#fotos' },
  { key: 'precos', title: tk('Defina os preços'), icon: CircleDot, target: '#precos' },
  { key: 'horarios', title: tk('Revise horários e contato'), icon: Clock, target: '#horarios' },
  { key: 'compartilhar', title: tk('Compartilhe a arena'), icon: Share2, target: null },
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
  const { arenaId } = useParams();
  const { user } = useAuth();
  return <V2ArenaOnboardingContent arenaId={arenaId} user={user} />;
}

function V2ArenaOnboardingContent({ arenaId, user }) {
  const navigate = useNavigate();
  const { data: arena, isLoading, isError: arenaFalhou, refetch: recarregarArena } = useArena(arenaId);
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

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6" aria-busy="true" aria-label={t('Carregando a arena')}>
        <V2Skeleton className="h-8 w-2/3" />
        <V2Skeleton lines={4} />
      </div>
    );
  }
  if (!arena && arenaFalhou) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <V2ErrorState
          title={t('Não foi possível abrir a configuração da arena')}
          description={t('A conexão falhou no meio do caminho. O que você já configurou continua salvo — tente de novo.')}
          onRetry={() => recarregarArena()}
        />
      </div>
    );
  }
  if (!arena) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <p className="text-sm text-gray-500">{t('Arena não encontrada.')}</p>
        <Link to="/arenas" className="mt-3 inline-block text-sm font-semibold text-ink underline">{t('Voltar às arenas')}</Link>
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
      toast.error(err?.message || t('Não foi possível salvar o progresso.'));
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
      toast.success(t('Arena configurada! Você pode voltar e ajustar a qualquer momento.'));
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
      toast.success(t('Link copiado!'));
    } catch {
      toast.error(t('Não foi possível copiar o link. Selecione manualmente.'));
    }
  };

  const shareOnWhatsApp = () => {
    const text = encodeURIComponent(t('Conheça a arena {name} no PickleRush: {publicUrl}', { name: arena.name, publicUrl }));
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
      <V2BackLink to="/arenas" className="mb-5">{t('Voltar às arenas')}</V2BackLink>

      <V2Surface className="p-6 md:p-8">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <V2Badge variant="info">{t('Onboarding')}</V2Badge>
          <span className="font-display text-2xl font-bold text-ink">{arena.name}</span>
        </div>

        <p className="text-sm text-gray-500">
          {t('Configure sua arena em 4 passos rápidos. Você pode voltar e ajustar tudo a qualquer momento pela página de gerência.')}
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
            {totalDone}/{STEPS.length} {totalDone === 1 ? t('passo concluído') : t('passos concluídos')}
          </div>
          <div className="flex items-center gap-2">
            {activeIdx > 0 && (
              <V2Button variant="ghost" onClick={handleBack}>
                <ArrowLeft className="mr-1 h-4 w-4" /> {t('Voltar')}
              </V2Button>
            )}
            <V2Button variant="ghost" onClick={handleSkipStep}>
              {t('Pular')}
            </V2Button>
            <V2Button onClick={handleAdvance} disabled={busy}>
              {activeIdx === STEPS.length - 1 ? t('Finalizar') : t('Avançar')}
              {activeIdx < STEPS.length - 1 && <ArrowRight className="ml-1 h-4 w-4" />}
            </V2Button>
          </div>
        </div>

        {allDone && activeIdx === STEPS.length - 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-green-50 p-3 text-sm text-green-900">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              {t('Tudo pronto! Sua arena já está configurada.')}
            </div>
            <V2Button size="sm" variant="ghost" onClick={markAllFromComputed} disabled={busy}>
              {t('Marcar tudo automaticamente')}
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
                    ? 'border-green-200 bg-green-50 text-green-900'
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-2xs font-bold',
                  active
                    ? 'bg-acid text-ink'
                    : done
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-500',
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className="truncate font-semibold">{t(s.title)}</span>
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
        <h3 className="font-display text-lg font-bold text-ink">{t(step.title)}</h3>
        {progress[step.key] && (
          <V2Badge variant="success" className="ml-auto">
            <Check className="mr-1 inline h-3 w-3" /> {t('Concluído')}
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
        {t('Arenas com fotos recebem')} <strong>{t('3x mais visualizações')}</strong> {t('e têm taxa de reserva 2x maior. Adicione ao menos 3 fotos das quadras e da fachada.')}
      </p>
      <div className="flex items-center gap-3 rounded-2xl bg-gray-50 p-3">
        <Camera className="h-5 w-5 text-gray-400" />
        <span className="text-sm">
          {count === 0
            ? t('Nenhuma foto ainda.')
            : `${count} ${count === 1 ? 'foto adicionada' : 'fotos adicionadas'}.`}
        </span>
        <V2Button size="sm" onClick={onConfigure} className="ml-auto">
          {count === 0 ? t('Adicionar fotos') : t('Gerenciar fotos')}
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
        {t('Defina um preço base e, opcionalmente, regras por horário (ex.: 18h–22h mais barato). Isso ajuda os jogadores a encontrarem sua arena nos filtros.')}
      </p>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-gray-50 p-3">
        <CircleDot className="h-5 w-5 text-gray-400" />
        <span className="text-sm">
          {total === 0
            ? t('Nenhum preço configurado.')
            : tn(total, '{n} preço definido.', '{n} preços definidos.')}
        </span>
        <V2Button size="sm" onClick={onConfigure} className="ml-auto">
          {total === 0 ? t('Configurar preços') : t('Editar preços')}
        </V2Button>
      </div>
    </div>
  );
}

function HorariosStep({ arena, onConfigure }) {
  return (
    <div className="space-y-3 text-sm text-gray-600">
      <p>
        {t('Revise o texto de horários de funcionamento e os canais de contato (telefone, WhatsApp, e-mail, Instagram). Você pode editar tudo depois.')}
      </p>
      <div className="rounded-2xl bg-gray-50 p-3 text-sm">
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 text-gray-400" />
          <div>
            <div className="font-semibold text-ink">{t('Horários')}</div>
            <div className="text-gray-600">
              {arena.hours?.trim() ? arena.hours : t('Não informado.')}
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          {arena.contact_phone && <span>{t('Tel: {contact_phone}', { contact_phone: arena.contact_phone })}</span>}
          {arena.contact_whatsapp && <span className="ml-3">{t('WhatsApp: {contact_whatsapp}', { contact_whatsapp: arena.contact_whatsapp })}</span>}
          {arena.contact_email && <span className="ml-3">{t('E-mail: {contact_email}', { contact_email: arena.contact_email })}</span>}
        </div>
      </div>
      <V2Button size="sm" onClick={onConfigure}>{t('Editar informações')}</V2Button>
    </div>
  );
}

function CompartilharStep({ arena, publicUrl, onCopy, onWhatsApp }) {
  const [shareMsg] = useState(
    t('Conheça a arena {name} no PickleRush — quadras, preços e horários: {publicUrl}', { name: arena.name, publicUrl }),
  );
  return (
    <div className="space-y-4 text-sm text-gray-600">
      <p>
        {t('Sua arena está pronta! Compartilhe o link público com seus jogadores ou cole no seu Instagram, WhatsApp ou e-mail.')}
      </p>
      <div className="rounded-2xl border border-gray-200 bg-white p-3">
        <div className="text-xs text-gray-500">{t('Link público')}</div>
        <div className="mt-1 flex items-center gap-2">
          <code className="flex-1 truncate rounded bg-gray-50 px-2 py-1 text-xs">{publicUrl}</code>
          <V2Button size="sm" variant="ghost" onClick={onCopy}>
            <Copy className="mr-1 h-3 w-3" /> {t('Copiar')}
          </V2Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <V2Button onClick={onWhatsApp}>
          <Share2 className="mr-1 h-4 w-4" /> {t('Compartilhar no WhatsApp')}
        </V2Button>
        <V2Button variant="ghost" onClick={onCopy}>
          <Copy className="mr-1 h-4 w-4" /> {t('Copiar mensagem')}
        </V2Button>
      </div>
      <div className="rounded-2xl bg-gray-50 p-3 text-xs text-gray-500">
        {t('Mensagem sugerida:')}&nbsp;
        <span className="italic">&ldquo;{shareMsg}&rdquo;</span>
      </div>
    </div>
  );
}
