import React, { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Trophy, Search, Medal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { genderLabel } from '@/modules/athletes/domain/constants';
import ErrorState from '@/components/ErrorState';
import { useNationalRanking } from '../hooks/useRating.js';

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

function medalEmoji(position) {
  if (position === 1) return '🥇';
  if (position === 2) return '🥈';
  if (position === 3) return '🥉';
  return null;
}

export default function NationalRanking() {
  const enabled = useFeatureFlag(FEATURE_FLAG.PLAYER_RATING);
  const profilePageOn = useFeatureFlag(FEATURE_FLAG.ATHLETE_PROFILE_PAGE);
  const rankingFiltersOn = useFeatureFlag(FEATURE_FLAG.RANKING_FILTERS);
  const { data: players = [], isLoading, isError, refetch } = useNationalRanking();
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
    const q = search.trim().toLowerCase();
    return players.filter((p) => {
      if (stateFilter !== ALL && p.state !== stateFilter) return false;
      if (levelFilter !== ALL && p.level !== levelFilter) return false;
      if (rankingFiltersOn) {
        if (genderFilter !== ALL && p.gender !== genderFilter) return false;
        if (clubFilter !== ALL && !(p.club_ids || []).includes(clubFilter)) return false;
        if (ageFilter !== ALL && !inAgeBucket(p.age, ageFilter)) return false;
      }
      if (!q) return true;
      return [p.platform_name, p.city, p.state, p.level]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [players, search, stateFilter, levelFilter, rankingFiltersOn, genderFilter, clubFilter, ageFilter]);

  if (!enabled) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 to-white">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 font-bold text-emerald-700">
            <Trophy className="w-5 h-5" /> Pickleholics
          </Link>
          <Badge variant="success" className="text-xs">
            <Medal className="w-3 h-3 mr-1" /> Ranking nacional
          </Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <Card>
          <CardContent className="p-5">
            <h1 className="text-2xl font-bold arena-heading flex items-center gap-2">
              <Medal className="w-6 h-6 text-emerald-600" /> Ranking nacional
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Rating calculado a partir dos jogos disputados nos torneios da plataforma.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, cidade, estado ou nível"
                className="h-11 rounded-full pl-11 pr-11"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Limpar busca"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FilterSelect
                label="Estado"
                value={stateFilter}
                onChange={setStateFilter}
                options={[{ value: ALL, label: 'Todos os estados' }, ...stateOptions.map((s) => ({ value: s, label: s }))]}
              />
              <FilterSelect
                label="Nível"
                value={levelFilter}
                onChange={setLevelFilter}
                options={[{ value: ALL, label: 'Todos os níveis' }, ...levelOptions.map((l) => ({ value: l, label: l }))]}
              />
            </div>
            {rankingFiltersOn && (
              <div className="grid gap-3 sm:grid-cols-3">
                <FilterSelect
                  label="Gênero"
                  value={genderFilter}
                  onChange={setGenderFilter}
                  options={[{ value: ALL, label: 'Todos os gêneros' }, ...genderOptions.map((g) => ({ value: g, label: genderLabel(g) || g }))]}
                />
                <FilterSelect
                  label="Clube"
                  value={clubFilter}
                  onChange={setClubFilter}
                  options={[{ value: ALL, label: 'Todos os clubes' }, ...clubOptions.map((c) => ({ value: c.id, label: c.name }))]}
                />
                <FilterSelect
                  label="Faixa etária"
                  value={ageFilter}
                  onChange={setAgeFilter}
                  options={[{ value: ALL, label: 'Todas as idades' }, ...AGE_BUCKETS.map((b) => ({ value: b.value, label: b.label }))]}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {isError ? (
          <ErrorState message="Não foi possível carregar o ranking." onRetry={refetch} />
        ) : isLoading ? (
          <Skeleton className="h-72" />
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-slate-500">
              {players.length === 0
                ? 'O ranking ainda não foi calculado. Assim que houver jogos finalizados e o recálculo for feito, os atletas aparecerão aqui.'
                : 'Nenhum atleta para o filtro atual.'}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="arena-table-wrap">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr className="text-left">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Atleta</th>
                      <th className="px-3 py-2">Cidade/UF</th>
                      <th className="px-3 py-2 text-center">Jogos</th>
                      <th className="px-3 py-2 text-center">V–D</th>
                      <th className="px-3 py-2 text-right">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => {
                      const medal = medalEmoji(p.position);
                      return (
                        <tr key={p.id} className="border-t">
                          <td className="px-3 py-2 font-semibold tabular-nums">
                            {medal ? `${medal} ` : ''}{p.position}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {p.photo_url ? (
                                <img src={p.photo_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                              ) : (
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-900 text-xs font-semibold text-emerald-50">
                                  {String(p.platform_name || 'A')[0]?.toUpperCase()}
                                </span>
                              )}
                              {profilePageOn ? (
                                <Link to={`/atleta/${p.id}`} className="font-medium text-emerald-800 hover:underline">
                                  {p.platform_name}
                                </Link>
                              ) : (
                                <span className="font-medium">{p.platform_name}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {[p.city, p.state].filter(Boolean).join(' / ') || '—'}
                          </td>
                          <td className="px-3 py-2 text-center tabular-nums">{p.games}</td>
                          <td className="px-3 py-2 text-center tabular-nums">{p.wins}–{p.losses}</td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums text-emerald-700">{p.rating}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="text-center text-xs text-slate-400 py-6">Pickleholics · Ranking nacional</footer>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700/75">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}
