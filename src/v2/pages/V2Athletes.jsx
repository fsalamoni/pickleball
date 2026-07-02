import React, { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Award, Building2, GraduationCap, MapPin, Search, Users } from 'lucide-react';
import { useAthletes } from '@/modules/athletes/hooks/useAthletes';
import { genderLabel } from '@/modules/athletes/domain/constants';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  V2Avatar,
  V2Badge,
  V2EmptyState,
  V2PageIntro,
  V2SearchInput,
  V2Skeleton,
  V2Surface,
} from '@/v2/ui/primitives';

function clubNames(athlete) {
  return (athlete.clubs || []).map((c) => (typeof c === 'string' ? c : c?.name)).filter(Boolean);
}

export default function V2Athletes() {
  const { data: athletes = [], isLoading } = useAthletes();
  const profilePageOn = useFeatureFlag(FEATURE_FLAG.ATHLETE_PROFILE_PAGE);
  const coachDirectoryOn = useFeatureFlag(FEATURE_FLAG.COACH_DIRECTORY);
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';

  const setQ = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    setParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return athletes
      .filter((a) => {
        if (!term) return true;
        return [a.platform_name, a.city, a.state, a.level, ...clubNames(a)]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => String(a.platform_name || '').localeCompare(String(b.platform_name || ''), 'pt-BR'));
  }, [athletes, q]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <V2PageIntro title="Atletas" subtitle="Encontre parceiros de jogo por nível, cidade e clube." />

      <V2Surface className="mb-8">
        <V2SearchInput
          icon={Search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, cidade, nível ou clube"
        />
        <p className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-500">
          <span className="font-bold text-ink">{filtered.length}</span> atleta(s) na comunidade.
        </p>
      </V2Surface>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <V2Skeleton key={i} className="h-52 rounded-4xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <V2Surface>
          <V2EmptyState
            icon={Users}
            title="Nenhum atleta encontrado"
            description="Ajuste a busca ou volte mais tarde para descobrir novos perfis na comunidade."
          />
        </V2Surface>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((athlete) => (
            <AthleteCard key={athlete.id} athlete={athlete} profilePageOn={profilePageOn} coachOn={coachDirectoryOn} />
          ))}
        </div>
      )}
    </div>
  );
}

function AthleteCard({ athlete, profilePageOn, coachOn }) {
  const location = [athlete.city, athlete.state].filter(Boolean).join(' / ');
  const clubs = clubNames(athlete);
  const isCoach = coachOn && athlete.is_coach === true;
  const Wrapper = profilePageOn ? Link : 'div';
  const wrapperProps = profilePageOn ? { to: `/v2/atleta/${athlete.id}` } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="group flex h-full flex-col rounded-4xl border border-gray-100 bg-paper-pure p-6 shadow-organic-sm transition-all hover:shadow-organic"
    >
      <div className="flex items-start gap-4">
        <V2Avatar name={athlete.platform_name} photoUrl={athlete.photo_url} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-bold text-ink">{athlete.platform_name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
            {Number.isFinite(athlete.age) && <span>{athlete.age} anos</span>}
            {genderLabel(athlete.gender) && <span>· {genderLabel(athlete.gender)}</span>}
          </div>
          {isCoach && (
            <V2Badge tone="green" className="mt-2">
              <GraduationCap className="h-3 w-3" /> Treinador
            </V2Badge>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2 text-sm text-gray-500">
        {location && (
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-gray-400" /> <span className="truncate">{location}</span>
          </div>
        )}
        {athlete.level && (
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 shrink-0 text-gray-400" /> <span className="truncate">{athlete.level}</span>
          </div>
        )}
      </div>

      {clubs.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {clubs.slice(0, 3).map((name) => (
            <V2Badge key={name} tone="neutral">
              <Building2 className="h-3 w-3" /> {name}
            </V2Badge>
          ))}
        </div>
      )}

      {profilePageOn && (
        <div className="mt-auto flex items-center justify-between pt-5 text-sm font-bold text-ink">
          <span>Ver perfil</span>
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </div>
      )}
    </Wrapper>
  );
}
