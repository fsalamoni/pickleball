import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, EyeOff, Medal, Settings2, Sparkles, Trophy, TrendingUp } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { BR_UFS, BR_UF_NAMES } from '@/core/domain/ufs';
import { useHallOfFame, useMyHallRow } from '@/modules/progression/hooks/useHallOfFame';
import { useSeasonTop, useUserCurrentSeason } from '@/modules/progression/hooks/useUserSeasonRanking';
import { useGamificationConfig } from '@/modules/progression/hooks/useGamificationConfig';
import {
  V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2PageIntro, V2Select, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import { cn } from '@/core/lib/utils';
import TermHint, { TermNote } from '@/v2/components/gamification/TermHint';

const TABS = [
  { value: 'temporada', label: 'Temporada', icon: Trophy },
  { value: 'sempre', label: 'Todos os tempos', icon: Crown },
];

/**
 * V2HallOfFame — o placar público: a temporada do mês (XP ganho no mês) e o
 * Hall de todos os tempos (XP de vida), com nome, foto e estado. Só aparece
 * quem aceitou — a regra é aplicada pelo servidor.
 */
export default function V2HallOfFame() {
  const gamificationOn = useFeatureFlag(FEATURE_FLAG.GAMIFICATION_V2);
  if (!gamificationOn) {
    return (
      <div className="mx-auto max-w-[1000px]">
        <V2PageIntro title="Hall da Fama" subtitle="Os maiores atletas do PickleRush por XP acumulado." />
        <V2Surface>
          <V2EmptyState
            icon={Crown}
            title="Hall da Fama em construção"
            description="A gamificação V2 precisa estar ativa pra ver este ranking."
            action={<V2Button asChild><a href="/meu-desempenho">Ir para Meu desempenho</a></V2Button>}
          />
        </V2Surface>
      </div>
    );
  }
  return <HallOfFameOn />;
}

/** Normaliza uma linha da temporada ou do Hall para o que a lista desenha. */
function toRow(r, kind) {
  if (kind === 'temporada') {
    return {
      uid: r.uid, position: r.publicPosition, xp: r.xp, tier: r.tier, level: r.level || 1,
      name: r.displayName || 'Atleta', photoUrl: r.photoUrl || '', state: r.state, city: r.city,
      delta: r.deltaPosition || 0, sub: 'XP no mês',
    };
  }
  return {
    uid: r.uid, position: r.position, xp: r.xpTotal, tier: r.tier, level: r.level,
    name: r.name, photoUrl: r.photoUrl, state: r.state, city: r.city, delta: 0,
    sub: `${r.achievementsUnlocked}/${r.achievementsTotal} conquistas`,
  };
}

function HallOfFameOn() {
  const { user } = useAuth();
  const { config, isModuleOn } = useGamificationConfig();
  const [aba, setAba] = useState('temporada');
  const [uf, setUf] = useState('');
  const state = uf || null;

  const season = useSeasonTop({ limit: 50, state, enabled: aba === 'temporada' });
  const hall = useHallOfFame({ limit: 50, state, enabled: aba === 'sempre' });
  const mySeason = useUserCurrentSeason(user?.uid, !!user);
  const myHall = useMyHallRow(user?.uid, !!user);
  const q = aba === 'temporada' ? season : hall;
  const linhas = (q.data || []).map((r) => toRow(r, aba));
  const podium = linhas.slice(0, 3);
  const rest = linhas.slice(3);

  if (!isModuleOn('hall_of_fame')) {
    return (
      <div className="mx-auto max-w-[1000px]">
        <V2PageIntro title="Hall da Fama" subtitle="Os maiores atletas do PickleRush." />
        <V2Surface><V2EmptyState icon={EyeOff} title="O placar público está desligado" description="A plataforma pausou o Hall da Fama e a temporada por enquanto. Seu XP e suas conquistas continuam valendo." /></V2Surface>
      </div>
    );
  }

  const euAparecoNaTemporada = mySeason.season?.public === true;
  const minTier = config.season.publicMinTier;

  return (
    <div className="mx-auto max-w-[1000px] space-y-5" data-testid="hall-of-fame">
      <V2PageIntro
        title="Hall da Fama"
        subtitle={aba === 'temporada'
          ? 'A temporada de cada mês: quem mais ganhou XP neste mês. Todo mês recomeça do zero.'
          : `Os maiores atletas do PickleRush por XP acumulado (a partir do tier ${minTier}).`}
        action={<V2Badge tone="amber"><Trophy className="h-3.5 w-3.5" /> Top 50</V2Badge>}
      />
      <TermNote term={aba === 'temporada' ? 'temporada' : 'hall'} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <V2SubTabs tabs={TABS} activeValue={aba} onSelect={(t) => setAba(t.value)} ariaLabel="Placar" dica="hall-abas" />
        <label className="flex items-center gap-2 text-xs font-semibold text-gray-500" data-dica="hall-estado">
          Estado
          <V2Select value={uf} onChange={(e) => setUf(e.target.value)} aria-label="Filtrar por estado" className="!py-1.5 !text-xs">
            <option value="">Brasil todo</option>
            {BR_UFS.map((u) => <option key={u} value={u}>{BR_UF_NAMES[u]}</option>)}
          </V2Select>
        </label>
      </div>

      {user && (
        <V2Surface className="!p-4" data-testid="hof-me" data-dica="hall-minha-posicao">
          {aba === 'temporada' ? (
            mySeason.season ? (
              <p className="text-sm text-gray-700">
                Na temporada você tem <strong className="text-ink">{mySeason.season.xp.toLocaleString('pt-BR')} XP</strong>
                {' '}— {euAparecoNaTemporada ? <>posição pública <strong className="text-ink">#{mySeason.season.publicPosition}</strong>.</> : <>posição <strong className="text-ink">#{mySeason.season.position}</strong>, que só você vê.</>}
              </p>
            ) : <p className="text-sm text-gray-600">Sua posição aparece depois da próxima atualização do placar (a cada dia).</p>
          ) : myHall.data ? (
            <p className="text-sm text-gray-700">Você está no Hall em <strong className="text-ink">#{myHall.data.position}</strong>.</p>
          ) : (
            <p className="text-sm text-gray-600">Você não aparece no Hall público (por escolha, pelo tier mínimo ou porque o perfil está oculto).</p>
          )}
          <Link to="/gamification/configuracoes#privacidade" className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline">
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" /> Escolher se apareço aqui
          </Link>
        </V2Surface>
      )}

      {q.isLoading && <V2Skeleton className="h-96 rounded-4xl" />}
      {q.isError && <V2Surface><V2ErrorState title="Não deu para carregar o placar" onRetry={q.refetch} /></V2Surface>}

      {!q.isLoading && !q.isError && linhas.length === 0 && (
        <V2Surface>
          <V2EmptyState
            icon={Sparkles}
            title={uf ? `Ninguém de ${BR_UF_NAMES[uf]} no placar ainda` : 'O placar ainda está em formação'}
            description={aba === 'temporada' ? 'Os números são atualizados uma vez por dia. Jogue, e o seu XP do mês começa a contar.' : 'Conforme os atletas acumulam XP, eles aparecem aqui.'}
          />
        </V2Surface>
      )}

      {podium.length > 0 && (
        <V2Surface>
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-ink"><Crown className="h-5 w-5 text-amber-500" /> Pódio <TermHint term="hall" /></h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {podium.map((p) => <PodiumCard key={p.uid} row={p} me={p.uid === user?.uid} />)}
          </div>
        </V2Surface>
      )}

      {rest.length > 0 && (
        <V2Surface>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink"><TrendingUp className="h-5 w-5" /> Ranking</h2>
          <ol className="divide-y divide-gray-100" data-testid="hall-of-fame-list" aria-label="Ranking">
            {rest.map((p) => (
              <li key={p.uid} data-testid="hof-row" data-uid={p.uid} className={cn('flex items-center gap-3 py-2.5', p.uid === user?.uid && 'rounded-2xl bg-acid/10 px-2')}>
                <span className="w-10 text-right font-mono text-sm font-bold tabular-nums text-gray-500">#{p.position}</span>
                <V2Avatar name={p.name} photoUrl={p.photoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link to={`/atleta/${p.uid}`} className="block truncate text-sm font-bold text-ink hover:underline">{p.name}</Link>
                  <p className="truncate text-xs text-gray-500">{p.tier}{p.state ? ` · ${p.city ? `${p.city}/` : ''}${p.state}` : ''} · {p.sub}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums text-ink">{p.xp.toLocaleString('pt-BR')} XP</p>
                  <p className="text-[10px] text-gray-500">Nível {p.level}{p.delta !== 0 ? ` · ${p.delta > 0 ? '▲' : '▼'}${Math.abs(p.delta)}` : ''}</p>
                </div>
              </li>
            ))}
          </ol>
        </V2Surface>
      )}
      <p className="text-center text-[11px] text-gray-400">Atualizado uma vez por dia. Só aparece quem aceitou — em Preferências você escolhe.</p>
    </div>
  );
}

function PodiumCard({ row, me }) {
  const colors = {
    1: { bg: 'from-amber-300 to-amber-500', text: 'text-amber-900', icon: Crown },
    2: { bg: 'from-slate-300 to-slate-400', text: 'text-slate-900', icon: Medal },
    3: { bg: 'from-orange-300 to-orange-400', text: 'text-orange-900', icon: Medal },
  };
  const { bg, text, icon: Icon } = colors[row.position] || colors[3];
  return (
    <div data-testid="hof-podium" data-position={row.position} className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${bg} p-4 ${text} shadow-lg ${me ? 'ring-4 ring-acid' : ''}`}>
      <div className="absolute -right-4 -top-4 opacity-20"><Icon className="h-24 w-24" /></div>
      <div className="relative">
        <p className="text-xs font-bold uppercase tracking-wider">#{row.position}</p>
        <div className="mt-2 flex items-center gap-2">
          <V2Avatar name={row.name} photoUrl={row.photoUrl} size="md" />
          <div className="min-w-0">
            <Link to={`/atleta/${row.uid}`} className="block truncate text-lg font-bold hover:underline">{row.name}</Link>
            <p className="text-xs opacity-80">{row.tier}{row.state ? ` · ${row.state}` : ''}</p>
          </div>
        </div>
        <p className="mt-3 text-3xl font-bold tabular-nums">{row.xp.toLocaleString('pt-BR')}</p>
        <p className="text-[10px] uppercase tracking-wide opacity-80">{row.sub}</p>
        <p className="mt-1 text-xs">Nível {row.level}</p>
      </div>
    </div>
  );
}
