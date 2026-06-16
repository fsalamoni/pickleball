import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Building2,
  Mail,
  MapPin,
  Phone,
  Search,
  Shield,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import ChatLauncherButton from '@/modules/chat/components/ChatLauncherButton';
import {
  ATHLETE_GENDER_LABELS,
  genderLabel,
} from '@/modules/athletes/domain/constants';
import { PICKLEBALL_EXPERIENCE_LABELS } from '@/modules/tournament/domain/constants';

const ALL = 'all';

function initialsFor(name) {
  return String(name || 'A')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'A';
}

function locationText(athlete) {
  return [athlete.city, athlete.state].filter(Boolean).join(' / ') || null;
}

export default function AthletesDirectory() {
  const { isAuthAvailable, authUnavailableReason } = useAuth();
  const { data: athletes = [], isLoading } = useAthletes();
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState(ALL);
  const [levelFilter, setLevelFilter] = useState(ALL);
  const [clubFilter, setClubFilter] = useState(ALL);
  const [selected, setSelected] = useState(null);
  const isPreviewMode = import.meta.env.DEV && !isAuthAvailable;

  const levelOptions = useMemo(() => {
    const set = new Set();
    athletes.forEach((a) => a.level && set.add(a.level));
    return Array.from(set).sort();
  }, [athletes]);

  const clubOptions = useMemo(() => {
    const map = new Map();
    athletes.forEach((a) => (a.clubs || []).forEach((c) => c?.id && map.set(c.id, c.name)));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [athletes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return athletes
      .filter((a) => {
        if (genderFilter !== ALL && a.gender !== genderFilter) return false;
        if (levelFilter !== ALL && a.level !== levelFilter) return false;
        if (clubFilter !== ALL && !(a.clubs || []).some((c) => c.id === clubFilter)) return false;
        if (!q) return true;
        const haystack = [a.platform_name, a.city, a.state, a.level, ...(a.clubs || []).map((c) => c.name)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => String(a.platform_name || '').localeCompare(String(b.platform_name || ''), 'pt-BR'));
  }, [athletes, search, genderFilter, levelFilter, clubFilter]);

  const stats = useMemo(() => {
    const cities = new Set(athletes.map(locationText).filter(Boolean));
    const withClub = athletes.filter((a) => (a.clubs || []).length > 0).length;
    return [
      { label: 'atletas no diretório', value: athletes.length, hint: 'perfis públicos da comunidade', icon: Users },
      { label: 'cidades representadas', value: cities.size, hint: 'alcance atual da comunidade', icon: MapPin },
      { label: 'atletas com clube', value: withClub, hint: 'vinculados a pelo menos um clube', icon: Building2 },
    ];
  }, [athletes]);

  const hasActiveFilters = search || genderFilter !== ALL || levelFilter !== ALL || clubFilter !== ALL;

  const clearFilters = () => {
    setSearch('');
    setGenderFilter(ALL);
    setLevelFilter(ALL);
    setClubFilter(ALL);
  };

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.08fr,0.92fr]">
        <Card className="arena-panel-strong overflow-hidden rounded-[2rem] border-0">
          <CardContent className="relative p-7 sm:p-8 lg:p-10">
            <div className="relative max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-50/80">
                <Sparkles className="h-3.5 w-3.5" /> Comunidade de atletas
              </span>
              <h2 className="mt-5 text-3xl font-semibold leading-tight text-white lg:text-4xl">
                Conheça os atletas inscritos na plataforma.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-emerald-50/75 sm:text-base">
                Encontre parceiros de jogo por nível, cidade e clube. Cada atleta controla
                quais informações de contato deseja tornar públicas.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild className="bg-white text-slate-950 hover:bg-emerald-50">
                  <Link to="/perfil">Editar meu perfil e privacidade</Link>
                </Button>
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    className="border-white/20 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                    onClick={clearFilters}
                  >
                    Limpar filtros
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-white/80 bg-white/82">
          <CardContent className="p-6 sm:p-7">
            <span className="arena-chip">Panorama</span>
            <h3 className="mt-4 text-2xl font-semibold text-slate-950">Resumo da comunidade</h3>
            <div className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {stats.map(({ label, value, hint, icon: Icon }) => (
                <div key={label} className="rounded-[1.35rem] border border-emerald-950/8 bg-secondary/35 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-2xl font-semibold text-slate-950">{value}</div>
                      <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700/75">{label}</div>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-600">{hint}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-[2rem] border-white/80 bg-white/82">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, cidade, nível ou clube"
              className="h-12 rounded-full border-white/80 bg-white/80 pl-11 pr-11"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpar busca"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <FilterSelect
              label="Gênero"
              value={genderFilter}
              onChange={setGenderFilter}
              options={[{ value: ALL, label: 'Todos os gêneros' }, ...Object.entries(ATHLETE_GENDER_LABELS).map(([value, label]) => ({ value, label }))]}
            />
            <FilterSelect
              label="Nível"
              value={levelFilter}
              onChange={setLevelFilter}
              options={[{ value: ALL, label: 'Todos os níveis' }, ...levelOptions.map((level) => ({ value: level, label: level }))]}
            />
            <FilterSelect
              label="Clube"
              value={clubFilter}
              onChange={setClubFilter}
              options={[{ value: ALL, label: 'Todos os clubes' }, ...clubOptions.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>

          <div className="border-t border-emerald-950/8 pt-4 text-sm text-slate-600">
            <span className="font-semibold text-slate-950">{filtered.length}</span> atleta(s) para o filtro atual.
          </div>
        </CardContent>
      </Card>

      {isPreviewMode && (
        <Card className="rounded-[2rem] border-amber-300/70 bg-amber-50/85">
          <CardContent className="p-5 text-sm leading-6 text-amber-950">
            Prévia local sem Firebase: o diretório de atletas não é carregado neste ambiente.
            {authUnavailableReason ? ` ${authUnavailableReason}` : ''}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Skeleton key={item} className="h-48 rounded-[1.75rem]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-[2rem] border-white/80 bg-white/82">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center sm:px-10">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-emerald-100 text-emerald-700">
              <Users className="h-8 w-8" />
            </div>
            <h3 className="mt-5 text-2xl font-semibold text-slate-950">Nenhum atleta encontrado</h3>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              {athletes.length === 0
                ? 'Ainda não há atletas listados. Complete seu perfil para aparecer aqui e ajude a comunidade a crescer.'
                : 'Ajuste a busca ou os filtros para ver mais atletas.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link to="/perfil">Completar meu perfil</Link>
              </Button>
              {hasActiveFilters && (
                <Button variant="outline" onClick={clearFilters}>Limpar filtros</Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((athlete) => (
            <AthleteCard key={athlete.id} athlete={athlete} onOpen={() => setSelected(athlete)} />
          ))}
        </div>
      )}

      <AthleteDialog athlete={selected} open={!!selected} onClose={() => setSelected(null)} />
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

function AthleteAvatar({ athlete, size = 'md' }) {
  const dimension = size === 'lg' ? 'h-16 w-16 text-xl' : 'h-12 w-12 text-base';
  if (athlete.photo_url) {
    return <img src={athlete.photo_url} alt="" className={`${dimension} shrink-0 rounded-full border border-emerald-900/10 object-cover`} />;
  }
  return (
    <div className={`${dimension} flex shrink-0 items-center justify-center rounded-full bg-emerald-900 font-semibold text-emerald-50`}>
      {initialsFor(athlete.platform_name)}
    </div>
  );
}

function AthleteCard({ athlete, onOpen }) {
  const location = locationText(athlete);
  const clubs = athlete.clubs || [];
  return (
    <Card className="match-surface h-full rounded-[1.75rem] border-white/80 bg-white/85">
      <CardContent className="flex h-full flex-col p-5">
        <div className="flex items-start gap-3">
          <AthleteAvatar athlete={athlete} />
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-lg font-semibold text-slate-950">{athlete.platform_name}</h4>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
              {Number.isFinite(athlete.age) && <span>{athlete.age} anos</span>}
              {genderLabel(athlete.gender) && <span>· {genderLabel(athlete.gender)}</span>}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm text-slate-600">
          {location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-emerald-700" />
              <span className="truncate">{location}</span>
            </div>
          )}
          {athlete.level && (
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 shrink-0 text-emerald-700" />
              <span className="truncate">{athlete.level}</span>
            </div>
          )}
        </div>

        {clubs.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {clubs.slice(0, 3).map((club) => (
              <Badge key={club.id} variant="success" className="rounded-full">
                <Building2 className="mr-1 h-3 w-3" /> {club.name}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-auto flex gap-2 pt-5">
          <Button variant="outline" size="sm" className="flex-1" onClick={onOpen}>
            Ver detalhes
          </Button>
          <ChatLauncherButton athlete={athlete} size="sm" className="flex-1" />
        </div>
      </CardContent>
    </Card>
  );
}

function AthleteDialog({ athlete, open, onClose }) {
  if (!athlete) return null;
  const location = locationText(athlete);
  const clubs = athlete.clubs || [];
  const contacts = [
    athlete.phone_public && athlete.phone ? { icon: Phone, label: 'Telefone', value: athlete.phone } : null,
    athlete.email_public && athlete.email ? { icon: Mail, label: 'E-mail', value: athlete.email } : null,
    athlete.address_public && athlete.address ? { icon: MapPin, label: 'Endereço', value: athlete.address } : null,
  ].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <AthleteAvatar athlete={athlete} size="lg" />
            <span className="min-w-0">
              <span className="block truncate text-xl">{athlete.platform_name}</span>
              <span className="mt-0.5 block text-sm font-normal text-slate-500">
                {[Number.isFinite(athlete.age) ? `${athlete.age} anos` : null, genderLabel(athlete.gender)].filter(Boolean).join(' · ') || 'Atleta'}
              </span>
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">Detalhes do atleta {athlete.platform_name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ChatLauncherButton athlete={athlete} className="w-full" label="Conversar com este atleta" />

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow icon={MapPin} label="Cidade" value={location} />
            <InfoRow icon={Award} label="Nível" value={athlete.level} />
            <InfoRow
              icon={User}
              label="Experiência"
              value={PICKLEBALL_EXPERIENCE_LABELS[athlete.pickleball_experience] || null}
            />
          </div>

          {clubs.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700/75">
                <Building2 className="h-3.5 w-3.5" /> Clubes
              </div>
              <div className="flex flex-wrap gap-1.5">
                {clubs.map((club) => (
                  <Link key={club.id} to={`/clubes/${club.id}`} onClick={onClose}>
                    <Badge variant="success" className="rounded-full hover:opacity-90">{club.name}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700/75">
              <Shield className="h-3.5 w-3.5" /> Contato
            </div>
            {contacts.length === 0 ? (
              <p className="text-sm text-slate-500">Este atleta optou por manter os contatos privados.</p>
            ) : (
              <div className="space-y-2">
                {contacts.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-2 text-sm text-slate-700">
                    <Icon className="h-4 w-4 shrink-0 text-emerald-700" />
                    <span className="font-medium">{label}:</span>
                    <span className="truncate">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="rounded-[1rem] border border-emerald-950/8 bg-secondary/30 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700/75">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-sm text-slate-800">{value}</div>
    </div>
  );
}
