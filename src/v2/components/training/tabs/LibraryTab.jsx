/**
 * Aba BIBLIOTECA do treino: os itens públicos aprovados, os dos meus
 * professores (inclusive o conteúdo antigo `cc_…`) e os destaques da Equipe
 * PickleRush no topo.
 *
 * Filtros na URL (`libraryFilters.js`). Falha ≠ vazio: a fonte que falhou é
 * dita; "nada encontrado" só com tudo o que importa carregado.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, Heart, Library, Plus, Route, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useCoachTrainingItems, usePublicTrainingItems } from '@/modules/training/hooks/useTrainingItems';
import { useMetaActions, useTrainingMeta } from '@/modules/training/hooks/useTrainingMeta';
import { useMyUnifiedLevel } from '@/modules/rating/hooks/useMyUnifiedLevel';
import { filterItems, sortLibrary } from '@/modules/training/domain/trainingItem';
import { buildTechniqueTrail } from '@/modules/training/domain/techniqueTrail';
import {
  ITEM_KINDS, ITEM_KIND_LABELS, PLACES, PLACE_LABELS, skillOptions,
} from '@/modules/training/domain/taxonomy';
import {
  V2Button, V2EmptyState, V2ErrorState, V2FilterChip, V2SearchInput, V2Select, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import ItemCard from '@/v2/components/training/ItemCard';
import {
  MAX_MINUTES, ORIGINS, activeFilterCount, libraryFiltersToParams, libraryPool, readLibraryFilters, toFilterItems,
} from './libraryFilters';
import { fmtNumero, t, tn } from '@/core/i18n';

const PAGINA = 24;
const fmtNivel = (n) => fmtNumero(Number(n), { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Favoritar({ item, favorito, onToggle, disabled }) {
  return (
    <V2Button
      variant="ghost"
      size="sm"
      aria-pressed={favorito}
      aria-label={favorito ? t('Tirar "{titulo}" dos salvos', { titulo: item.title }) : t('Salvar "{titulo}"', { titulo: item.title })}
      onClick={onToggle}
      disabled={disabled}
    >
      <Heart className={cn('h-4 w-4', favorito && 'fill-current text-red-500')} aria-hidden="true" />
      {favorito ? t('Salvo') : t('Salvar')}
    </V2Button>
  );
}

function Filtros({ f, setF, level, levelLoading, mostrar, setMostrar, temProfessor }) {
  const SKILLS = skillOptions();
  const ligados = activeFilterCount(f);
  return (
    <div className="space-y-3" data-dica="treino-biblioteca-filtros">
      <form
        role="search"
        onSubmit={(e) => { e.preventDefault(); setF({ q: e.currentTarget.elements.q.value.trim() }); }}
        className="flex gap-2"
      >
        <V2SearchInput
          icon={Search}
          name="q"
          key={f.q}
          defaultValue={f.q}
          placeholder={t('Buscar drill, treino, regra…')}
          aria-label={t('Buscar na biblioteca')}
          wrapperClassName="flex-1"
          maxLength={80}
        />
        <V2Button type="submit" variant="secondary" size="sm" className="shrink-0">{t('Buscar')}</V2Button>
      </form>

      <div className="flex flex-wrap gap-2">
        <V2FilterChip active={!f.tipo} onClick={() => setF({ tipo: '' })} className="px-3 py-1.5">{t('Tudo')}</V2FilterChip>
        {ITEM_KINDS.map((k) => (
          <V2FilterChip key={k} active={f.tipo === k} aria-pressed={f.tipo === k} onClick={() => setF({ tipo: f.tipo === k ? '' : k })} className="px-3 py-1.5">
            {t(ITEM_KIND_LABELS[k])}
          </V2FilterChip>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <V2FilterChip
          active={f.nivel}
          aria-pressed={f.nivel}
          onClick={() => setF({ nivel: !f.nivel })}
          className="px-3 py-1.5"
          data-dica="treino-biblioteca-nivel"
          disabled={levelLoading}
        >
          {t('Do meu nível')}{f.nivel && Number.isFinite(level) ? ` (${fmtNivel(level)})` : ''}
        </V2FilterChip>
        <V2FilterChip active={f.origem === 'salvos'} aria-pressed={f.origem === 'salvos'} onClick={() => setF({ origem: f.origem === 'salvos' ? '' : 'salvos' })} className="px-3 py-1.5">
          <Heart className="h-3.5 w-3.5" aria-hidden="true" />{' '}{t('Salvos')}
        </V2FilterChip>
        <V2Button variant="ghost" size="sm" aria-expanded={mostrar} onClick={() => setMostrar(!mostrar)}>
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />{' '}{t('Mais filtros')}
        </V2Button>
        {ligados > 0 && (
          <V2Button variant="ghost" size="sm" onClick={() => setF(null)}>
            <X className="h-4 w-4" aria-hidden="true" /> {t('Limpar filtros ({n})', { n: ligados })}
          </V2Button>
        )}
      </div>
      {f.nivel && !levelLoading && !Number.isFinite(level) && (
        <p className="text-xs text-gray-500">{t('Ainda não sabemos o seu nível, então nada foi escondido. Ele aparece depois dos primeiros jogos ou no seu perfil.')}</p>
      )}

      {mostrar && (
        <div className="grid gap-3 rounded-3xl bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1 text-sm font-semibold text-ink">
            {t('Habilidade')}
            <V2Select value={f.habilidade} onChange={(e) => setF({ habilidade: e.target.value })}>
              <option value="">{t('Todas')}</option>
              {SKILLS.map((a) => (
                <optgroup key={a.value} label={a.label}>
                  <option value={a.value}>{t('{nome} (tudo)', { nome: a.label })}</option>
                  {a.children.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </optgroup>
              ))}
            </V2Select>
          </label>
          <label className="space-y-1 text-sm font-semibold text-ink">
            {t('Jogadores')}
            <V2Select value={f.jogadores || ''} onChange={(e) => setF({ jogadores: Number(e.target.value) || null })}>
              <option value="">{t('Qualquer')}</option>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 1 ? t('Sozinho') : t('{n} jogadores', { n })}</option>)}
            </V2Select>
          </label>
          <label className="space-y-1 text-sm font-semibold text-ink">
            {t('Onde')}
            <V2Select value={f.local} onChange={(e) => setF({ local: e.target.value })}>
              <option value="">{t('Qualquer lugar')}</option>
              {PLACES.map((p) => <option key={p} value={p}>{t(PLACE_LABELS[p])}</option>)}
            </V2Select>
          </label>
          <label className="space-y-1 text-sm font-semibold text-ink">
            {t('Tempo máximo')}
            <V2Select value={f.tempo || ''} onChange={(e) => setF({ tempo: Number(e.target.value) || null })}>
              <option value="">{t('Qualquer')}</option>
              {MAX_MINUTES.map((m) => <option key={m} value={m}>{t('Até {n} min', { n: m })}</option>)}
            </V2Select>
          </label>
          <label className="space-y-1 text-sm font-semibold text-ink">
            {t('Quem fez')}
            <V2Select value={f.origem} onChange={(e) => setF({ origem: e.target.value })}>
              <option value="">{t('Todos')}</option>
              {ORIGINS.filter((o) => o.value !== 'meus_professores' || temProfessor).map((o) => (
                <option key={o.value} value={o.value}>{t(o.label)}</option>
              ))}
            </V2Select>
          </label>
        </div>
      )}
    </div>
  );
}

function Lista({ itens, favoritos, onFav, favDisabled, vazio }) {
  const [limite, setLimite] = useState(PAGINA);
  if (itens.length === 0) return vazio;
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        {itens.slice(0, limite).map((it) => (
          <ItemCard
            key={it.id}
            item={it}
            actions={favoritos ? (
              <Favoritar item={it} favorito={favoritos.has(it.id)} onToggle={() => onFav(it, !favoritos.has(it.id))} disabled={favDisabled} />
            ) : null}
          />
        ))}
      </div>
      {itens.length > limite && (
        <div className="flex justify-center">
          <V2Button variant="secondary" onClick={() => setLimite((n) => n + PAGINA)}>
            {t('Mostrar mais ({n})', { n: itens.length - limite })}
          </V2Button>
        </div>
      )}
    </>
  );
}

export default function LibraryTab({ identity, params, irPara }) {
  const pub = usePublicTrainingItems();
  const temProfessor = identity.activeCoachIds.length > 0;
  const coach = useCoachTrainingItems(identity.activeCoachIds);
  const meta = useTrainingMeta(identity.uid);
  const metaActions = useMetaActions(identity.uid);
  const { level, isLoading: levelLoading } = useMyUnifiedLevel();
  const [mostrar, setMostrar] = useState(false);

  const f = useMemo(() => readLibraryFilters(params), [params]);
  const setF = (patch) => irPara('biblioteca', libraryFiltersToParams(patch === null ? {} : { ...f, ...patch }));

  const coachItems = coach.data?.items || [];
  const favoritos = meta.isSuccess ? new Set(meta.data?.favorites || []) : null;
  const filtrando = activeFilterCount(f) > 0;

  const resultado = useMemo(() => {
    const pool = libraryPool(f, { pub: pub.data || [], coach: coachItems, favorites: [...(favoritos || [])] });
    return sortLibrary(filterItems(pool, toFilterItems(f, { level })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, pub.data, coach.data, meta.data, level]);

  const onFav = (item, on) => metaActions.favorite.mutate({ itemId: item.id, on }, {
    onSuccess: () => toast.success(on ? t('Salvo. Veja em "Salvos".') : t('Tirado dos salvos.')),
    onError: () => toast.error(t('Não foi possível salvar agora.')),
  });

  if (pub.isPending) return <V2Skeleton className="h-64 rounded-4xl" />;
  if (pub.isError) {
    return (
      <V2Surface>
        <V2ErrorState title={t('Não foi possível carregar a biblioteca')} onRetry={() => pub.refetch()} />
      </V2Surface>
    );
  }

  const coachFalhou = temProfessor && (coach.isError || coach.data?.incompleto);
  const coachCarregando = temProfessor && coach.isPending;
  const salvosFalhou = f.origem === 'salvos' && meta.isError;
  // O vazio só é afirmado com as fontes do recorte carregadas.
  const podeAfirmarVazio = !coachCarregando && !(f.origem === 'meus_professores' && coach.isError)
    && !(f.origem === 'salvos' && !meta.isSuccess);

  const trilha = buildTechniqueTrail(pub.data || [], meta.data?.mastery || {});
  const destaques = !filtrando ? sortLibrary((pub.data || []).filter((it) => it.featured)) : [];
  const vazio = !podeAfirmarVazio ? (
    <V2Skeleton className="h-40 rounded-4xl" />
  ) : filtrando ? (
    <V2Surface>
      <V2EmptyState
        icon={Search}
        title={t('Nada com esses filtros')}
        description={f.origem === 'salvos' ? t('Toque em "Salvar" num item para guardá-lo aqui.') : t('Tente tirar um filtro ou buscar por outra palavra.')}
        action={<V2Button variant="secondary" onClick={() => setF(null)}>{t('Limpar filtros')}</V2Button>}
      />
    </V2Surface>
  ) : (
    <V2Surface>
      <V2EmptyState
        icon={Library}
        title={t('A biblioteca ainda está vazia')}
        description={t('Os primeiros drills e treinos da equipe aparecem aqui assim que forem publicados. Você também pode criar os seus.')}
        action={(
          <V2Button asChild>
            <Link to="/treino/novo"><Plus className="h-4 w-4" aria-hidden="true" />{' '}{t('Criar drill ou treino')}</Link>
          </V2Button>
        )}
      />
    </V2Surface>
  );

  return (
    <div className="space-y-6">
      <Filtros
        f={f}
        setF={setF}
        level={level}
        levelLoading={levelLoading}
        mostrar={Boolean(mostrar || f.habilidade || f.jogadores || f.local || f.tempo || (f.origem && f.origem !== 'salvos'))}
        setMostrar={setMostrar}
        temProfessor={temProfessor}
      />

      {coachFalhou && (
        <V2ErrorState
          inline
          title={t('Ficaram de fora itens dos seus professores')}
          description={t('A biblioteca abaixo está sem uma parte do que eles publicaram.')}
          onRetry={() => coach.refetch()}
        />
      )}
      {salvosFalhou && <V2ErrorState inline title={t('Não foi possível carregar os seus salvos')} onRetry={() => meta.refetch()} />}

      {!filtrando && trilha.counts.total > 0 && (
        <Link
          to="/treino/golpes"
          data-dica="treino-biblioteca-golpes"
          className="flex items-center gap-4 rounded-4xl border border-ink bg-paper-pure p-5 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-acid text-ink">
            <Route className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-bold text-ink">{t('Trilha dos golpes')}</span>
            <span className="block text-sm text-gray-600">
              {t('{n} golpes e movimentos, do básico ao avançado: o corpo ponto a ponto, o certo e o errado.', { n: trilha.counts.total })}
              {meta.isSuccess && trilha.counts.dominado > 0 ? ` ${t('Você domina {n}.', { n: trilha.counts.dominado })}` : ''}
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
        </Link>
      )}

      {destaques.length > 0 && (
        <section aria-labelledby="treino-destaques" className="space-y-3">
          <h2 id="treino-destaques" className="flex items-center gap-1.5 font-display text-lg font-bold text-ink">
            <Star className="h-4 w-4 fill-current text-amber-500" aria-hidden="true" />{' '}{t('Destaques da Equipe PickleRush')}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {destaques.slice(0, 4).map((it) => <ItemCard key={it.id} item={it} />)}
          </div>
        </section>
      )}

      {!filtrando && temProfessor && coachItems.length > 0 && (
        <section aria-labelledby="treino-dos-professores" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="treino-dos-professores" className="font-display text-lg font-bold text-ink">{t('Dos meus professores')}</h2>
            <V2Button variant="ghost" size="sm" onClick={() => setF({ origem: 'meus_professores' })}>{t('Ver todos ({n})', { n: coachItems.length })}</V2Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {sortLibrary(coachItems).slice(0, 4).map((it) => <ItemCard key={it.id} item={it} />)}
          </div>
        </section>
      )}

      <section aria-labelledby="treino-toda-biblioteca" className="space-y-3">
        <h2 id="treino-toda-biblioteca" className="font-display text-lg font-bold text-ink">
          {filtrando ? tn(resultado.length, '{n} item encontrado', '{n} itens encontrados') : t('Toda a biblioteca')}
        </h2>
        <Lista
          key={JSON.stringify(f)}
          itens={resultado}
          favoritos={favoritos}
          onFav={onFav}
          favDisabled={metaActions.favorite.isPending}
          vazio={vazio}
        />
      </section>
    </div>
  );
}
