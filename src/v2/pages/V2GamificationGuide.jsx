import React, { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Lightbulb, Search, Sparkles } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { useGamificationGuide } from '@/modules/progression/hooks/useGamificationGuide';
import {
  GUIDE_AUDIENCE, GUIDE_AUDIENCE_META, TERM_GROUP, TERM_GROUP_META, searchTerms, termsForAudience,
} from '@/modules/progression/domain/gamificationGuide';
import { helpLinkFor } from '@/modules/help/domain/helpLink';
import { cn } from '@/core/lib/utils';
import {
  V2ContentHero, V2EmptyState, V2PageIntro, V2SearchInput, V2Surface,
} from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import { rolarAte } from '@/v2/ui/rolarAte';

/** Em que público cai um link `?termo=` (o primeiro que o tem e que a pessoa pode ver). */
function publicoDoTermo(guide, termoId, podeAdmin) {
  const t = guide.byId[termoId];
  if (!t) return null;
  return t.audiences.find((a) => a !== GUIDE_AUDIENCE.ADMIN || podeAdmin) || null;
}

/**
 * Como funciona a gamificação — o guia completo, por público, com busca.
 *
 * É para onde levam o "?" de cada conceito, o "Como funciona" de cada aba e a
 * Central de ajuda. Os textos e os números vêm de `gamificationGuide.js`, que
 * lê as mesmas constantes que o código usa e a configuração do admin.
 */
export default function V2GamificationGuide() {
  const on = useFeatureFlag(FEATURE_FLAG.GAMIFICATION_V2);
  if (!on) {
    return (
      <div className="mx-auto max-w-[760px]">
        <V2PageIntro title="Como funciona a gamificação" subtitle="XP, missões, temporada, recompensas e privacidade." />
        <V2Surface><V2EmptyState icon={Sparkles} title="Disponível em breve" description="Este guia chega junto com a gamificação." /></V2Surface>
      </div>
    );
  }
  return <V2GamificationGuideOn />;
}

function V2GamificationGuideOn() {
  const { isPlatformAdmin } = useAuth();
  const helpOn = useFeatureFlag(FEATURE_FLAG.HELP_CENTER);
  const { guide, isModuleOn } = useGamificationGuide();
  const [params, setParams] = useSearchParams();
  const termoUrl = params.get('termo') || '';
  const busca = params.get('q') || '';

  const publicos = useMemo(
    () => Object.values(GUIDE_AUDIENCE).filter((a) => a !== GUIDE_AUDIENCE.ADMIN || isPlatformAdmin),
    [isPlatformAdmin],
  );
  const paraUrl = params.get('para');
  const publico = publicos.includes(paraUrl)
    ? paraUrl
    : (publicoDoTermo(guide, termoUrl, isPlatformAdmin) || GUIDE_AUDIENCE.ATHLETE);

  const set = (mudancas) => {
    const next = new URLSearchParams(params);
    Object.entries(mudancas).forEach(([k, v]) => { if (v) next.set(k, v); else next.delete(k); });
    setParams(next, { replace: true });
  };

  const visiveis = useMemo(
    () => termsForAudience(guide, publico).filter((t) => !t.module || isModuleOn(t.module)),
    [guide, publico, isModuleOn],
  );
  const achados = useMemo(() => searchTerms(visiveis, busca), [visiveis, busca]);
  const grupos = useMemo(() => Object.values(TERM_GROUP)
    .map((g) => ({ id: g, ...TERM_GROUP_META[g], terms: achados.filter((t) => t.group === g) }))
    .filter((g) => g.terms.length > 0), [achados]);
  const perguntas = guide.faq.filter((f) => f.audience === publico);

  // Chegar por um "?" leva ao termo e o destaca.
  useEffect(() => {
    if (!termoUrl) return undefined;
    const t = setTimeout(() => rolarAte(document.getElementById(`termo-${termoUrl}`)), 60);
    return () => clearTimeout(t);
  }, [termoUrl, publico]);

  const tabs = publicos.map((a) => ({ value: a, label: GUIDE_AUDIENCE_META[a].label }));

  return (
    <div className="mx-auto max-w-[900px] space-y-5" data-testid="gamification-guide">
      <Link to="/gamification" className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Gamificação
      </Link>

      <V2ContentHero
        eyebrow="Guia da gamificação"
        title="Jogue. Evolua. Seja reconhecido."
        description="O que a gamificação mede, por que mede e o que você controla — sem letras miúdas. Tudo aqui vale para o que você faz de verdade na plataforma."
      />

      <V2Surface className="space-y-4" data-dica="guia-ciclo">
        <h2 className="font-display text-lg font-bold text-ink">Em um minuto</h2>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {guide.loop.map((passo, i) => (
            <li key={passo.id} className="flex gap-3 rounded-2xl bg-paper p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-acid" aria-hidden="true">{i + 1}</span>
              <div>
                <p className="text-sm font-bold text-ink">{passo.title}</p>
                <p className="mt-0.5 text-xs leading-5 text-gray-600">{passo.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </V2Surface>

      <div className="space-y-3">
        <V2SubTabs tabs={tabs} activeValue={publico} onSelect={(t) => set({ para: t.value === GUIDE_AUDIENCE.ATHLETE ? null : t.value, termo: null })} ariaLabel="Para quem é o guia" dica="guia-publico" />
        <p className="px-1 text-sm text-gray-500">{GUIDE_AUDIENCE_META[publico].summary}</p>
        <V2SearchInput
          icon={Search} value={busca} onChange={(e) => set({ q: e.target.value })} data-dica="guia-busca"
          placeholder="Buscar: sequência, duelo, privacidade…" aria-label="Buscar no guia"
        />
      </div>

      {grupos.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={Search}
            title="Nada encontrado"
            description={busca ? `Nenhum termo de “${busca}” neste público. Tente outra palavra ou troque o público acima.` : 'Não há termos para este público agora.'}
          />
        </V2Surface>
      ) : grupos.map((g) => (
        <section key={g.id} aria-labelledby={`grupo-${g.id}`} className="space-y-3">
          <div className="px-1">
            <h2 id={`grupo-${g.id}`} className="font-display text-xl font-bold text-ink">{g.label}</h2>
            <p className="text-sm text-gray-500">{g.summary}</p>
          </div>
          {g.terms.map((t) => (
            <article
              key={t.id} id={`termo-${t.id}`} data-term={t.id}
              className={cn('scroll-mt-24 rounded-4xl border bg-paper-pure p-6 shadow-organic-sm', termoUrl === t.id ? 'border-acid-dark ring-2 ring-acid/60' : 'border-gray-100')}
            >
              <h3 className="font-display text-lg font-bold text-ink">{t.title}</h3>
              <p className="mt-1 text-sm font-semibold leading-6 text-ink">{t.short}</p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-gray-600">
                {t.body.map((p) => <p key={p}>{p}</p>)}
              </div>
              {t.tip && (
                <p className="mt-3 flex gap-2 rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {t.tip}
                </p>
              )}
              {t.where && (
                <Link to={t.where.to} className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-ink hover:underline">
                  {t.where.label} <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
            </article>
          ))}
        </section>
      ))}

      {perguntas.length > 0 && !busca && (
        <V2Surface className="space-y-3" data-dica="guia-perguntas">
          <h2 className="font-display text-lg font-bold text-ink">Perguntas frequentes</h2>
          <div className="divide-y divide-gray-100">
            {perguntas.map((f) => (
              <details key={f.q} className="group py-3">
                <summary className="cursor-pointer select-none text-sm font-bold text-ink">{f.q}</summary>
                <p className="mt-2 text-sm leading-6 text-gray-600">{f.a}</p>
              </details>
            ))}
          </div>
        </V2Surface>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-gray-100 bg-paper-pure p-4 text-sm">
        <span className="text-gray-600">Quer ajustar o que os outros veem de você?</span>
        <span className="flex flex-wrap gap-4 font-bold">
          <Link to="/gamification/configuracoes" className="text-ink hover:underline">Abrir as preferências</Link>
          {helpOn && <Link to={helpLinkFor('/gamification')} className="text-ink hover:underline">Central de ajuda</Link>}
        </span>
      </div>
    </div>
  );
}
