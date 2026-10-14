import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Crown, Search, TrendingUp, Users2 } from 'lucide-react';
import { useNationalRanking } from '@/modules/rating/hooks/useRating';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { genderLabel } from '@/modules/athletes/domain/constants';
import {
  V2Avatar,
  V2EmptyState,
  V2ErrorState,
  V2PageIntro,
  V2SearchInput,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import V2DuprRankingView from '@/v2/components/rating/V2DuprRankingView';
import { t } from '@/core/i18n';

function medalEmoji(position) {
  if (position === 1) return '🥇';
  if (position === 2) return '🥈';
  if (position === 3) return '🥉';
  return null;
}

const ALL = 'all';
const AGE_BUCKETS = [
  { value: '18-29', label: '18–29', min: 18, max: 29 },
  { value: '30-39', label: '30–39', min: 30, max: 39 },
  { value: '40-49', label: '40–49', min: 40, max: 49 },
  { value: '50+', label: '50+', min: 50, max: 200 },
];

function inAgeBucket(age, bucketValue) {
  const b = AGE_BUCKETS.find((x) => x.value === bucketValue);
  if (!b || !Number.isFinite(age)) return false;
  return age >= b.min && age <= b.max;
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-2xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-gray-200 bg-paper-pure px-3 text-sm"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** Saldo de pontos com sinal (+12 / -5 / 0), ou "—" quando ausente. */
function formatBalance(balance) {
  if (balance == null || Number.isNaN(Number(balance))) return '—';
  const n = Number(balance);
  return n > 0 ? `+${n}` : String(n);
}

/** Bloco compacto de estatística usado na linha do ranking. */
function Stat({ label, value }) {
  return (
    <div className="text-right">
      <p className="text-2xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="font-semibold text-ink tabular-nums">{value}</p>
    </div>
  );
}

/** Explicação, em linguagem natural, de como o ranking é formado. */
function RankingExplainer() {
  return (
    <V2Surface className="mb-8" data-dica="ranking-como-funciona">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
          <span className="font-semibold text-ink">{t('Como funciona o ranking?')}</span>
          <span className="text-xs text-gray-500 group-open:hidden">{t('ver explicação')}</span>
          <span className="hidden text-xs text-gray-500 group-open:inline">{t('ocultar')}</span>
        </summary>
        <div className="mt-3 space-y-3 text-sm leading-6 text-gray-600">
          <p>
            {t('O ranking é um rating de habilidade calculado pela própria plataforma (estilo Elo), a partir dos jogos já finalizados. A cada atualização, todos os jogos são reprocessados do zero, em ordem cronológica — então o resultado é sempre consistente.')}
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>{t('Cada atleta começa com uma pontuação derivada do seu nível declarado (nível mais alto começa mais alto; sem nível, começa no meio).')}</li>
            <li>{t('A cada jogo, quem vence ganha pontos e quem perde cede pontos. O ajuste depende da força do adversário: vencer alguém mais forte vale mais; perder para alguém mais fraco custa mais.')}</li>
            <li>{t('Nos primeiros jogos a pontuação se move mais rápido e depois estabiliza.')}</li>
            <li>{t('Em duplas, a dupla é avaliada pela média e cada jogador recebe o próprio ajuste.')}</li>
            <li>{t('Entram os jogos de torneios públicos — a partir do momento em que o resultado é lançado, sem esperar o encerramento — e os de dias de jogo publicados por quem organiza. Torneio em rascunho, privado ou cancelado não conta.')}</li>
            <li>{t('Só entram partidas em que todos os atletas têm conta na plataforma. Se alguém foi inscrito ou inserido só pelo nome, a partida fica de fora para todos — quem organiza resolve ligando essa pessoa à conta dela, e os jogos passam a contar sozinhos.')}</li>
            <li>
              {t('A atualização é automática: cada resultado que entra, muda ou sai recalcula o ranking em instantes.')}{' '}
              <Link to="/meu-desempenho" className="font-semibold text-ink underline">{t('Meu desempenho')}</Link>
              {': '}{t('você vê todos os seus jogos e, se algum não estiver no ranking, o porquê.')}
            </li>
          </ul>
          <p className="text-xs text-gray-500">
            <strong>{t('Colunas:')}</strong> {t('Torneios (disputados), Jogos, V–D (vitórias–derrotas), Saldo (pontos marcados − sofridos) e Rating (ordena o ranking).')}
          </p>
          <p className="text-xs text-gray-500">
            {t('É um rating próprio da plataforma, para leitura interna — não é um rating oficial de federação (como DUPR ou UTPR).')}
          </p>
        </div>
      </details>
    </V2Surface>
  );
}

function NationalRankingView() {
  const { data: players = [], isLoading, isError, refetch } = useNationalRanking();
  const profilePageOn = true;
  const rankingFiltersOn = true;
  const doublesRankingOn = true;
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState(ALL);
  const [levelFilter, setLevelFilter] = useState(ALL);
  const [genderFilter, setGenderFilter] = useState(ALL);
  const [clubFilter, setClubFilter] = useState(ALL);
  const [ageFilter, setAgeFilter] = useState(ALL);

  const stateOptions = useMemo(() => {
    const set = new Set();
    players.forEach((p) => p.state && set.add(p.state));
    return Array.from(set).sort();
  }, [players]);
  const levelOptions = useMemo(() => {
    const set = new Set();
    players.forEach((p) => p.level && set.add(p.level));
    return Array.from(set).sort();
  }, [players]);
  const genderOptions = useMemo(() => {
    const set = new Set();
    players.forEach((p) => p.gender && set.add(p.gender));
    return Array.from(set);
  }, [players]);
  const clubOptions = useMemo(() => {
    const map = new Map();
    players.forEach((p) => (p.clubs || []).forEach((c) => c?.id && map.set(c.id, c.name)));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [players]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return players.filter((p) => {
      if (rankingFiltersOn) {
        if (stateFilter !== ALL && p.state !== stateFilter) return false;
        if (levelFilter !== ALL && p.level !== levelFilter) return false;
        if (genderFilter !== ALL && p.gender !== genderFilter) return false;
        if (clubFilter !== ALL && !(p.club_ids || []).includes(clubFilter)) return false;
        if (ageFilter !== ALL && !inAgeBucket(p.age, ageFilter)) return false;
      }
      if (!term) return true;
      return [p.platform_name, p.city, p.state, p.level]
        .filter(Boolean).join(' ').toLowerCase().includes(term);
    });
  }, [players, search, rankingFiltersOn, stateFilter, levelFilter, genderFilter, clubFilter, ageFilter]);

  return (
    <div className="mx-auto max-w-[1100px]">
      <V2PageIntro
        title={t('Ranking nacional')}
        subtitle={t('Rating calculado a partir dos jogos de torneios e dias de jogo da plataforma.')}
        action={doublesRankingOn ? (
          <Link to="/ranking/duplas" data-dica="ranking-duplas-link" className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-paper-pure px-4 py-2 text-sm font-semibold text-ink hover:bg-white">
            <Users2 className="h-4 w-4" /> {t('Ranking de duplas')}
          </Link>
        ) : null}
      />

      <RankingExplainer />

      <V2Surface className="mb-8 space-y-4" data-dica="ranking-busca">
        <V2SearchInput
          icon={Search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('Buscar por nome, cidade, estado ou nível')}
        />
        {rankingFiltersOn && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <FilterSelect
              label={t('Estado')}
              value={stateFilter}
              onChange={setStateFilter}
              options={[{ value: ALL, label: t('Todos os estados') }, ...stateOptions.map((s) => ({ value: s, label: s }))]}
            />
            <FilterSelect
              label={t('Nível')}
              value={levelFilter}
              onChange={setLevelFilter}
              options={[{ value: ALL, label: t('Todos os níveis') }, ...levelOptions.map((l) => ({ value: l, label: l }))]}
            />
            <FilterSelect
              label={t('Gênero')}
              value={genderFilter}
              onChange={setGenderFilter}
              options={[{ value: ALL, label: t('Todos os gêneros') }, ...genderOptions.map((g) => ({ value: g, label: genderLabel(g) || g }))]}
            />
            <FilterSelect
              label={t('Clube')}
              value={clubFilter}
              onChange={setClubFilter}
              options={[{ value: ALL, label: t('Todos os clubes') }, ...clubOptions.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <FilterSelect
              label={t('Faixa etária')}
              value={ageFilter}
              onChange={setAgeFilter}
              options={[{ value: ALL, label: t('Todas as idades') }, ...AGE_BUCKETS.map((b) => ({ value: b.value, label: b.label }))]}
            />
          </div>
        )}
      </V2Surface>

      {isLoading ? (
        <V2Skeleton className="h-96 rounded-4xl" />
      ) : isError ? (
        // Falha não é "ranking ainda não calculado" (docs/27-FALHA-NAO-E-VAZIO.md).
        <V2Surface>
          <V2ErrorState
            title={t('Não foi possível carregar o ranking')}
            description={t('O ranking continua calculado — só não conseguimos buscá-lo agora.')}
            onRetry={() => refetch()}
          />
        </V2Surface>
      ) : filtered.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={TrendingUp}
            title={players.length === 0 ? t('O ranking ainda não foi calculado') : t('Nenhum atleta para o filtro')}
            description={players.length === 0
              ? t('Assim que houver jogos finalizados e o recálculo for feito, os atletas aparecerão aqui.')
              : t('Ajuste a busca para ampliar a leitura do ranking.')}
          />
        </V2Surface>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const isMe = p.id === user?.uid || p.uid === user?.uid;
            const medal = medalEmoji(p.position);
            const row = (
              <div
                className={cn(
                  'flex items-center gap-4 rounded-3xl border p-4 shadow-organic-sm transition-all',
                  isMe ? 'border-acid/40 bg-acid/10' : 'border-gray-100 bg-paper-pure hover:shadow-organic',
                )}
              >
                <div className={cn('w-8 text-center font-display text-xl font-black', p.position <= 3 ? 'text-ink' : 'text-gray-400')}>
                  {medal || p.position}
                </div>
                <div className="relative">
                  <V2Avatar name={p.platform_name} photoUrl={p.photo_url} size="md" />
                  {p.position === 1 && (
                    <div className="absolute -right-1 -top-1 rounded-full bg-white text-xs text-yellow-500"><Crown className="h-3.5 w-3.5" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{p.platform_name}{isMe && <span className="ml-2 text-xs font-bold text-ink-lighter">{t('(você)')}</span>}</p>
                  <p className="text-xs text-gray-500">{[p.city, p.state].filter(Boolean).join(' / ') || t('Local não informado')}</p>
                </div>
                <div className="hidden items-center gap-4 sm:flex">
                  <Stat label={t('Torneios')} value={p.tournaments ?? '—'} />
                  <Stat label={t('Jogos')} value={p.games ?? '—'} />
                  <Stat label={t('V–D')} value={`${p.wins ?? 0}–${p.losses ?? 0}`} />
                  <Stat label={t('Saldo')} value={formatBalance(p.points_balance)} />
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-gray-500">{t('Rating')}</p>
                  <p className="font-display text-xl font-bold text-ink tabular-nums">{p.rating}</p>
                </div>
              </div>
            );
            return profilePageOn ? (
              <Link key={p.id} to={`/atleta/${p.id}`} className="block">{row}</Link>
            ) : (
              <div key={p.id}>{row}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Página de Ranking. Com a flag `skill_rating_dupr` LIGADA, mostra uma barra de
 * abas: "Nacional" (rating ELO existente, inalterado) e "Nível 2.0–8.0" (ranking
 * estilo DUPR, apartado). Desligada, renderiza apenas o ranking nacional — a
 * página fica idêntica ao comportamento anterior.
 */
export default function V2Ranking() {
  const duprOn = true;
  const [params, setParams] = useSearchParams();

  if (!duprOn) return <NationalRankingView />;

  // Aba controlada pela URL (?tab=dupr) — permite links diretos de outros locais.
  const tab = params.get('tab') === 'dupr' ? 'dupr' : 'national';
  const setTab = (t) => setParams(t === 'dupr' ? { tab: 'dupr' } : {}, { replace: true });

  const TABS = [
    { id: 'national', get label() { return t('Nacional'); } },
    { id: 'dupr', get label() { return t('Nível 2.0–8.0'); } },
  ];

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-6 overflow-x-auto">
        <div data-dica="ranking-abas" className="inline-flex gap-1.5 rounded-full border border-gray-100 bg-paper-pure p-1.5 shadow-sm">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-bold transition-colors',
                tab === t.id ? 'bg-ink text-white shadow-md' : 'text-gray-500 hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'dupr' ? <V2DuprRankingView /> : <NationalRankingView />}
    </div>
  );
}
