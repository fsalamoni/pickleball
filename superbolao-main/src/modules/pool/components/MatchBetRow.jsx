import { Lock } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { getPenaltyWinner, MAX_PENALTY_SCORE, normalizePenaltyScore } from '@/modules/pool/domain/penaltyShootout';

/**
 * Linha de palpite em um único jogo.
 *
 * Props:
 *  - match: documento da partida
 *  - homeTeam, awayTeam, zebraTeam: objetos team (ou null se ainda placeholder)
 *  - bet: palpite atual {predicted_home, predicted_away, predicted_home_penalties?, predicted_away_penalties?, penalty_winner_team_id?} ou null
 *  - locked: boolean
 *  - onChange(matchId, partial)
 *  - showPenalty: boolean (true em mata-mata)
 */
export function MatchBetRow({ match, homeTeam, awayTeam, zebraTeam, bet, locked, onChange, showPenalty, sportConfig: sportConfigProp = null }) {
  const home = match.home_team_id ? homeTeam?.name : match.home_placeholder;
  const away = match.away_team_id ? awayTeam?.name : match.away_placeholder;
  const isPlaceholder = !match.home_team_id || !match.away_team_id;
  const placeholderDisabled = isPlaceholder || locked;
  const sportConfig = sportConfigProp || match.sport_config || {};
  const maxScore = Number(sportConfig.max_score || 20);
  const scoreStep = Number(sportConfig.score_step || 1);
  const scoreLabel = sportConfig.score_label || 'Placar';

  return (
    <div
      className={cn(
        'match-surface p-3 sm:p-4',
        locked && 'from-slate-100/85 via-slate-50/80 to-emerald-50/45 opacity-90',
      )}
    >
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
        <TeamLabel name={home} code={homeTeam?.code} align="right" />

        <div className="mx-auto flex min-w-[9rem] items-center justify-center gap-2 rounded-md border border-emerald-950/10 bg-white/80 px-2 py-2 shadow-inner shadow-emerald-950/5">
          <Input
            type="number"
            min={0}
            max={maxScore}
            step={scoreStep}
            inputMode={scoreStep < 1 ? 'decimal' : 'numeric'}
            disabled={placeholderDisabled}
            value={bet?.predicted_home ?? ''}
            onChange={(e) => onChange(match.id, { predicted_home: e.target.value })}
            className="h-12 w-14 border-emerald-900/20 bg-white text-center text-lg font-bold tabular-nums focus-visible:ring-emerald-600"
            placeholder="-"
          />
          <span className="text-sm font-bold text-emerald-900/55">x</span>
          <Input
            type="number"
            min={0}
            max={maxScore}
            step={scoreStep}
            inputMode={scoreStep < 1 ? 'decimal' : 'numeric'}
            disabled={placeholderDisabled}
            value={bet?.predicted_away ?? ''}
            onChange={(e) => onChange(match.id, { predicted_away: e.target.value })}
            className="h-12 w-14 border-emerald-900/20 bg-white text-center text-lg font-bold tabular-nums focus-visible:ring-emerald-600"
            placeholder="-"
          />
        </div>

        <TeamLabel name={away} code={awayTeam?.code} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-emerald-950/10 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          {match.zebra_team_id && match.zebra_multiplier && (
            <Badge variant="zebra" title={`Vitória da Zebra (${zebraTeam?.name || ''}) multiplica pontos por ${match.zebra_multiplier}x`}>
              {zebraTeam?.code || 'Zebra'} {match.zebra_multiplier}x
            </Badge>
          )}
          {isPlaceholder && <span className="arena-chip bg-slate-100 text-slate-600">A definir</span>}
          <span className="arena-chip bg-white/75 text-slate-600">{scoreLabel}: 0 a {maxScore}</span>
          {sportConfig.supports_draw === false && <span className="arena-chip bg-amber-50 text-amber-800">Empate bloqueado</span>}
        </div>
        {locked && (
          <span className="inline-flex h-7 items-center gap-1 rounded-md bg-slate-900 px-2 text-xs font-medium text-white">
            <Lock className="w-3 h-3" /> Bloqueado
          </span>
        )}
      </div>

      {showPenalty && (
        <div className="mt-3 flex flex-col gap-2 rounded-md border border-emerald-950/10 bg-white/55 p-2 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold text-slate-800">Pênaltis, se houver</div>
            <div>Informe o placar do desempate mesmo que seu palpite do jogo normal não seja empate.</div>
          </div>
          <PenaltyScore
            bet={bet}
            home={{ id: match.home_team_id, name: home }}
            away={{ id: match.away_team_id, name: away }}
            disabled={placeholderDisabled}
            onChange={(partial) => onChange(match.id, partial)}
          />
        </div>
      )}
    </div>
  );
}

function TeamLabel({ name, code, align = 'left' }) {
  return (
    <div className={cn('min-w-0 text-center sm:text-left', align === 'right' && 'sm:text-right')}>
      {code && <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">{code}</div>}
      <div className="truncate text-sm font-semibold text-slate-900 sm:text-base" title={name}>{name}</div>
    </div>
  );
}

function PenaltyScore({ bet, home, away, disabled, onChange }) {
  const homeScore = bet?.predicted_home_penalties ?? '';
  const awayScore = bet?.predicted_away_penalties ?? '';
  const penaltyWinner = getPenaltyWinner(home.id, away.id, homeScore, awayScore);
  const clear = () => onChange({ predicted_home_penalties: null, predicted_away_penalties: null, penalty_winner_team_id: null });
  const updateScore = (side, value) => {
    const nextHome = side === 'home' ? value : homeScore;
    const nextAway = side === 'away' ? value : awayScore;
    onChange({
      predicted_home_penalties: normalizePenaltyScore(nextHome),
      predicted_away_penalties: normalizePenaltyScore(nextAway),
      penalty_winner_team_id: getPenaltyWinner(home.id, away.id, nextHome, nextAway),
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="truncate font-medium text-slate-700">{home.name}</span>
      <Input
        type="number"
        min={0}
        max={MAX_PENALTY_SCORE}
        step={1}
        inputMode="numeric"
        disabled={disabled || !home.id}
        value={homeScore}
        onChange={(e) => updateScore('home', e.target.value)}
        className="h-9 w-14 bg-white text-center font-bold tabular-nums"
        placeholder="-"
      />
      <span className="font-bold text-emerald-900/55">x</span>
      <Input
        type="number"
        min={0}
        max={MAX_PENALTY_SCORE}
        step={1}
        inputMode="numeric"
        disabled={disabled || !away.id}
        value={awayScore}
        onChange={(e) => updateScore('away', e.target.value)}
        className="h-9 w-14 bg-white text-center font-bold tabular-nums"
        placeholder="-"
      />
      <span className="truncate font-medium text-slate-700">{away.name}</span>
      {penaltyWinner && (
        <span className="arena-chip bg-emerald-50 text-emerald-800">
          Vencedor: {penaltyWinner === home.id ? home.name : away.name}
        </span>
      )}
      <Choice label="Sem pênaltis" active={!homeScore && !awayScore} disabled={disabled} onClick={clear} />
    </div>
  );
}

function Choice({ label, active, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'min-h-7 px-2 py-0.5 rounded-md border text-xs transition-colors',
        active ? 'bg-emerald-900 border-emerald-900 text-white' : 'bg-white/80 border-emerald-900/15 text-slate-700 hover:bg-emerald-50',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      {label}
    </button>
  );
}
