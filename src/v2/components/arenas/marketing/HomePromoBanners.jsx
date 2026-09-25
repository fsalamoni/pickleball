/**
 * Promoções das arenas na TELA INICIAL — banners, com rolagem entre eles e
 * filtro por localidade (Onda BZ).
 *
 * Quem decide o que entra é o domínio (`homeBanners`): cupom divulgado E
 * marcado como banner pela arena, ainda valendo, de arena com o módulo de
 * cupons ligado, e da REGIÃO da pessoa. A região padrão é a cidade do perfil
 * (senão o estado); a pessoa troca para o estado, outra cidade (quem vai
 * viajar) ou todo o Brasil, e a escolha fica guardada — só no navegador, por
 * usuário. Sem cidade nem estado no perfil, a tela PEDE a cidade em vez de
 * mostrar promoções do Brasil inteiro.
 *
 * O carrossel:
 *  - avança sozinho a cada 7 s, e PARA quando a pessoa interage (passa o
 *    mouse, toca, foca) — e tem botão de pausar, porque conteúdo que se move
 *    sozinho precisa de um jeito de parar;
 *  - com "reduzir movimento" ligado no aparelho, não avança sozinho;
 *  - desliza com o dedo no celular; setas e pontos no resto;
 *  - não anuncia cada troca ao leitor de tela (seria um aviso a cada 7 s).
 *
 * Falha ao carregar não vira "não há promoções": a seção simplesmente não
 * aparece — ela é convite, não informação que alguém precise para agir.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, MapPin, Pause, Play, Tag } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';
import { useHomeBannerCoupons } from '@/modules/arenas/hooks/useArenaV3';
import { useModuleOnInArenas } from '@/modules/arenas/hooks/useArenaModules';
import { arenaQueries } from '@/modules/arenas/hooks/arenaQueries';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';
import {
  BANNER_REGION, bannerCities, homeBanners, regionLabel, resolveBannerRegion,
} from '@/modules/arenas/domain/homeBanners';
import { brandingOf } from '@/modules/arenas/domain/whiteLabel';
import { cn } from '@/core/lib/utils';

const PREF = 'home:promocoes:regiao';
const INTERVALO_MS = 7000;

function prefereMenosMovimento() {
  try {
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

/** O seletor de região. */
function SeletorDeRegiao({ region, cidades, profile, onChange }) {
  const valor = region.mode === BANNER_REGION.OTHER ? `${BANNER_REGION.OTHER}:${region.key}` : region.mode;
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-gray-500">
      <MapPin className="h-3.5 w-3.5" />
      <span className="sr-only">Mostrar promoções de</span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-full border border-gray-200 bg-paper-pure px-3 text-xs font-bold text-ink"
      >
        {region.mode === BANNER_REGION.UNKNOWN && <option value={BANNER_REGION.UNKNOWN}>Escolha a sua cidade…</option>}
        {profile?.city && <option value={BANNER_REGION.CITY}>Minha cidade ({profile.city})</option>}
        {profile?.state && <option value={BANNER_REGION.STATE}>Meu estado ({String(profile.state).toUpperCase()})</option>}
        {cidades.length > 0 && (
          <optgroup label="Outra cidade">
            {cidades.map((c) => (
              <option key={c.key} value={`${BANNER_REGION.OTHER}:${c.key}`}>
                {c.city}{c.state ? ` (${c.state})` : ''} · {c.count}
              </option>
            ))}
          </optgroup>
        )}
        <option value={BANNER_REGION.ALL}>Todo o Brasil</option>
      </select>
    </label>
  );
}

function Banner({ banner, posicao, total }) {
  const marca = brandingOf(banner.arena);
  const estilo = marca.on
    ? { backgroundColor: marca.color, color: marca.ink }
    : undefined;
  return (
    <div
      role="group"
      aria-roledescription="promoção"
      aria-label={`${posicao} de ${total}: ${banner.benefit} — ${banner.arenaName}`}
      className={cn(
        'relative flex w-[88%] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-3xl p-5 sm:w-[62%] lg:w-[46%]',
        marca.on ? '' : 'bg-ink text-white',
      )}
      style={estilo}
    >
      {!marca.on && <div className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-acid opacity-25 blur-[60px]" />}
      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">
          {banner.arenaName}{banner.city ? ` · ${banner.city}` : ''}
        </p>
        <p className="mt-1 font-display text-2xl font-bold leading-tight">{banner.benefit}</p>
        {banner.description && <p className="mt-1 text-sm opacity-90">{banner.description}</p>}
        {banner.conditions && <p className="mt-1 text-xs opacity-75">{banner.conditions}</p>}
      </div>
      <div className="relative mt-4 flex flex-wrap items-center gap-2">
        <span className={cn(
          'rounded-full border border-dashed px-3 py-1 font-display text-xs font-bold tracking-widest',
          marca.on ? 'border-current' : 'border-white/40',
        )}>
          {banner.code}
        </span>
        <Link
          to={`/arenas/${banner.arenaId}#arena-promocoes`}
          className={cn(
            'rounded-full px-4 py-2 text-xs font-bold transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            marca.on ? 'bg-paper-pure text-ink' : 'bg-acid text-ink',
          )}
        >
          {banner.bookable ? 'Reservar com esta promoção' : 'Ver na arena'}
        </Link>
      </div>
    </div>
  );
}

export default function HomePromoBanners() {
  const { user, userProfile } = useAuth();
  const uid = user?.uid || null;
  const cupons = useHomeBannerCoupons();
  const listaCupons = useMemo(() => (Array.isArray(cupons.data) ? cupons.data : []), [cupons.data]);
  const arenaIds = useMemo(() => [...new Set(listaCupons.map((c) => c.arena_id).filter(Boolean))].sort(), [listaCupons]);
  // Só as arenas que têm banner — com a MESMA chave de cache da página da arena.
  const arenasQ = useQueries({ queries: arenaIds.map((id) => ({ ...arenaQueries.arena(id), staleTime: 5 * 60_000 })) });
  const arenas = useMemo(() => arenasQ.map((q) => q.data).filter(Boolean), [arenasQ]);
  const cuponsLigados = useModuleOnInArenas(arenaIds, ARENA_MODULE_ID.MARKETING_COUPONS);

  const [pref, setPref] = useState(() => readViewPreference(uid, PREF));
  useEffect(() => { setPref(readViewPreference(uid, PREF)); }, [uid]);
  const region = resolveBannerRegion(pref, userProfile || {});
  const escolher = (valor) => {
    setPref(valor);
    writeViewPreference(uid, PREF, valor);
  };

  const dados = { coupons: listaCupons, arenas, isOnIn: cuponsLigados.isOnIn };
  const cidades = bannerCities(dados);
  const banners = homeBanners(dados, region);

  // O carrossel.
  const trilho = useRef(null);
  const [atual, setAtual] = useState(0);
  const [pausado, setPausado] = useState(prefereMenosMovimento);
  const [interagindo, setInteragindo] = useState(false);
  const irPara = useCallback((i) => {
    const el = trilho.current;
    const alvo = el?.children?.[i];
    if (el && alvo) el.scrollTo({ left: alvo.offsetLeft - el.offsetLeft, behavior: prefereMenosMovimento() ? 'auto' : 'smooth' });
    setAtual(i);
  }, []);
  // Trocou a região: o carrossel volta ao primeiro — senão o ponto marcado e a
  // rolagem ficam apontando para um banner que já não está lá.
  const chaveRegiao = `${region.mode}|${region.key || region.state || ''}`;
  useEffect(() => {
    setAtual(0);
    trilho.current?.scrollTo?.({ left: 0 });
  }, [chaveRegiao]);
  useEffect(() => {
    if (pausado || interagindo || banners.length < 2) return undefined;
    const t = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      irPara((atual + 1) % banners.length);
    }, INTERVALO_MS);
    return () => clearInterval(t);
  }, [pausado, interagindo, banners.length, atual, irPara]);
  const aoRolar = () => {
    const el = trilho.current;
    if (!el?.children?.length) return;
    const larg = el.children[0].getBoundingClientRect().width || 1;
    const i = Math.round(el.scrollLeft / larg);
    if (i !== atual && i >= 0 && i < banners.length) setAtual(i);
  };

  const carregando = cupons.isLoading || arenasQ.some((q) => q.isLoading) || cuponsLigados.isLoading;
  // Convite, não informação: falhando ou sem banner em lugar nenhum, não aparece.
  if (cupons.isError || carregando || cidades.length === 0) return null;

  return (
    <section
      aria-roledescription="carrossel"
      aria-label="Promoções das arenas"
      className="mb-8"
      onMouseEnter={() => setInteragindo(true)}
      onMouseLeave={() => setInteragindo(false)}
      onFocusCapture={() => setInteragindo(true)}
      onBlurCapture={() => setInteragindo(false)}
      onTouchStart={() => setInteragindo(true)}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <Tag className="h-4 w-4" /> Promoções {regionLabel(region.mode === BANNER_REGION.OTHER
            ? { ...region, city: cidades.find((c) => c.key === region.key)?.city || region.city }
            : region) || 'das arenas'}
        </h2>
        <div className="flex items-center gap-1.5">
          <SeletorDeRegiao region={region} cidades={cidades} profile={userProfile} onChange={escolher} />
          {banners.length > 1 && (
            <>
              <button type="button" onClick={() => setPausado((p) => !p)}
                aria-label={pausado ? 'Retomar a troca automática' : 'Pausar a troca automática'}
                className="rounded-full p-1.5 text-gray-500 hover:bg-paper hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink">
                {pausado ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
              <button type="button" onClick={() => irPara((atual - 1 + banners.length) % banners.length)}
                aria-label="Promoção anterior"
                className="hidden rounded-full p-1.5 text-gray-500 hover:bg-paper hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink sm:inline-flex">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => irPara((atual + 1) % banners.length)}
                aria-label="Próxima promoção"
                className="hidden rounded-full p-1.5 text-gray-500 hover:bg-paper hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink sm:inline-flex">
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {region.mode === BANNER_REGION.UNKNOWN ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-paper p-4 text-sm text-gray-600">
          Escolha a sua cidade acima para ver as promoções das arenas perto de você — ou{' '}
          <Link to="/perfil/editar" className="font-bold text-ink underline">informe a cidade no seu perfil</Link>.
        </p>
      ) : banners.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-paper p-4 text-sm text-gray-600">
          As arenas {regionLabel(region)} não divulgaram promoção agora. Troque a região acima para ver as de outros lugares.
        </p>
      ) : (
        <>
          <div
            ref={trilho}
            onScroll={aoRolar}
            className="hide-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
          >
            {banners.map((b, i) => <Banner key={b.id} banner={b} posicao={i + 1} total={banners.length} />)}
          </div>
          {banners.length > 1 && (
            <div className="mt-2 flex justify-center gap-1.5">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => irPara(i)}
                  aria-label={`Ir para a promoção ${i + 1} de ${banners.length}`}
                  aria-current={i === atual ? 'true' : undefined}
                  className={cn('h-1.5 rounded-full transition-all', i === atual ? 'w-5 bg-ink' : 'w-1.5 bg-gray-300 hover:bg-gray-400')}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
