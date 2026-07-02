import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AvatarGroup } from '@/components/ui/user-avatar';
import { Trophy, MapPin, Calendar, Hash, Eye, Printer, Share2, Copy, Check } from 'lucide-react';
import { getTournament } from '@/modules/tournament/services/tournamentService';
import { listModalities } from '@/modules/tournament/services/modalityService';
import { listAllMatchesForModality } from '@/modules/tournament/services/matchService';
import { listRegistrations } from '@/modules/tournament/services/registrationService';
import { computeModalityRanking } from '@/modules/tournament/services/rankingService';
import {
  TOURNAMENT_STATUS,
  TOURNAMENT_STATUS_LABELS,
  MATCH_STATUS_LABELS,
  MODALITY_FORMAT_LABELS,
} from '@/modules/tournament/domain/constants';
import { useClipboard } from '@/core/lib/useClipboard';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import ShareCardButton from '@/modules/sharing/components/ShareCardButton';
import CertificateButton from '@/modules/tournament/components/CertificateButton';
import TournamentGallery from '@/modules/tournament/components/TournamentGallery';

function formatPublicMatchTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function roundLabel(m) {
  if (m.third_place) return '3º lugar';
  if (m.bracket === 'gf') return m.round === 2 ? 'Final (reset)' : 'Grande final';
  if (m.bracket === 'wb') return `Venc. R${m.round}`;
  if (m.bracket === 'lb') return `Repesc. R${m.round}`;
  return m.round;
}

/**
 * Página pública (sem autenticação) de visualização ao vivo de um torneio.
 * Inspirado em evroon/bracket e CourtHive/TMX — permite que espectadores,
 * familiares e jogadores acompanhem o andamento sem precisar criar conta.
 */
export default function PublicTournament() {
  const { tournamentId } = useParams();
  const { copy, copied } = useClipboard();
  const shareCardsOn = useFeatureFlag(FEATURE_FLAG.SHARE_CARDS);
  const publicUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/p/${tournamentId}` : '';

  async function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Torneio PickleRush', url: publicUrl });
        return;
      } catch {
        // usuário cancelou ou share não disponível → cai no copy
      }
    }
    copy(publicUrl, 'Link público copiado!');
  }

  const { data: tournament, isLoading: loadingT } = useQuery({
    queryKey: ['public', 'tournament', tournamentId],
    queryFn: () => getTournament(tournamentId),
    refetchInterval: 30_000,
  });
  const { data: modalities = [] } = useQuery({
    queryKey: ['public', 'modalities', tournamentId],
    queryFn: () => listModalities(tournamentId),
    enabled: !!tournament,
    refetchInterval: 60_000,
  });

  if (loadingT) {
    return (
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <Trophy className="w-10 h-10 mx-auto text-slate-300" />
        <h2 className="mt-3 font-semibold">Torneio não encontrado</h2>
        <p className="text-sm text-slate-600 mt-1">
          Verifique o link recebido. <Link to="/" className="text-emerald-700 underline">Voltar</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/50 to-white">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-3 font-bold text-emerald-700">
            <img src="/logo-claro.png" alt="PickleRush" className="h-7 w-auto object-contain" />
            <span className="text-xl font-bold tracking-tight text-slate-900">PickleRush</span>
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            {shareCardsOn ? (
              <ShareCardButton tournament={tournament} />
            ) : (
              <Button size="sm" variant="outline" onClick={handleShare}>
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
                <span className="ml-1 hidden sm:inline">Compartilhar</span>
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => copy(publicUrl, 'Link copiado!')}>
              <Copy className="w-4 h-4" />
              <span className="ml-1 hidden sm:inline">Copiar link</span>
            </Button>
            {tournament.status === TOURNAMENT_STATUS.FINISHED && (
              <CertificateButton tournament={tournament} />
            )}
            <Badge variant="success" className="text-xs">
              <Eye className="w-3 h-3 mr-1" /> Visão pública
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-4">
        <Card>
          <CardContent className="p-5">
            <h1 className="text-2xl font-bold arena-heading flex items-center gap-2">
              <Trophy className="w-6 h-6 text-emerald-600" /> {tournament.name}
            </h1>
            {tournament.description && (
              <p className="text-sm text-slate-600 mt-1">{tournament.description}</p>
            )}
            <div className="mt-3 flex items-center gap-3 text-xs text-slate-600 flex-wrap">
              {tournament.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {tournament.city}
                  {tournament.state ? ` / ${tournament.state}` : ''}
                </span>
              )}
              {tournament.invite_code && (
                <span className="inline-flex items-center gap-1">
                  <Hash className="w-3 h-3" /> Código: <strong>{tournament.invite_code}</strong>
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />{' '}
                {TOURNAMENT_STATUS_LABELS[tournament.status] || tournament.status}
              </span>
              <Link
                to={`/torneios/${tournament.id}/imprimir`}
                className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
              >
                <Printer className="w-3 h-3" /> Versão para impressão
              </Link>
            </div>
          </CardContent>
        </Card>

        {modalities.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-slate-500 text-center">
              Nenhuma modalidade publicada ainda.
            </CardContent>
          </Card>
        )}

        {modalities.map((m) => (
          <PublicModalityBlock key={m.id} modality={m} />
        ))}

        <TournamentGallery tournamentId={tournament.id} canManage={false} />
      </main>

      <footer className="text-center text-xs text-slate-400 py-6">
        Plataforma PickleRush · Atualização automática a cada 30s
      </footer>
    </div>
  );
}

function PublicModalityBlock({ modality }) {
  const { data: matches = [] } = useQuery({
    queryKey: ['public', 'matches', modality.id, 'all'],
    queryFn: () => listAllMatchesForModality(modality.id),
    refetchInterval: 20_000,
  });
  const multiPhase = matches.some((m) => (m.stage_index ?? 0) > 0);
  const { data: ranking = [] } = useQuery({
    queryKey: ['public', 'ranking', modality.id],
    queryFn: () => computeModalityRanking(modality.id),
    refetchInterval: 30_000,
  });
  const { data: registrations = [] } = useQuery({
    queryKey: ['public', 'registrations', modality.id],
    queryFn: () => listRegistrations(modality.id),
    refetchInterval: 60_000,
  });
  const labelById = useMemo(() => {
    const map = new Map();
    registrations.forEach((r) =>
      map.set(r.id, r.label || `${r.player_a_name || ''}${r.player_b_name ? ' / ' + r.player_b_name : ''}`),
    );
    return map;
  }, [registrations]);
  const peopleById = useMemo(() => {
    const map = new Map();
    registrations.forEach((r) => map.set(r.id, [
      { name: r.player_a_name, photoUrl: r.player_a_photo },
      ...(r.player_b_name ? [{ name: r.player_b_name, photoUrl: r.player_b_photo }] : []),
    ]));
    return map;
  }, [registrations]);

  function sidePeople(match, key) {
    const ids = match[`${key}_ids`];
    return Array.isArray(ids) ? ids.flatMap((id) => peopleById.get(id) || []) : [];
  }

  function renderSide(match, key) {
    const ids = match[`${key}_ids`];
    if (Array.isArray(ids) && ids.length > 0) {
      return ids.map((id) => labelById.get(id) || id).join(' + ');
    }
    const raw = match[key];
    if (!raw) return '—';
    return String(raw)
      .split('+')
      .map((id) => labelById.get(id.trim()) || id.trim())
      .join(' + ');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>{modality.name}</span>
          <Badge variant="secondary" className="text-xs">
            {MODALITY_FORMAT_LABELS[modality.format] || modality.format}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {ranking.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Ranking</h4>
            <div className="hidden sm:block arena-table-wrap">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left">
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Participante</th>
                    <th className="px-3 py-2 text-center">PJ</th>
                    <th className="px-3 py-2 text-center">V</th>
                    <th className="px-3 py-2 text-center">Sets</th>
                    <th className="px-3 py-2 text-right" title="Saldo de pontos (PF − PC)">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.slice(0, 16).map((r) => {
                    const balance = (r.points_for || 0) - (r.points_against || 0);
                    return (
                      <tr key={r.participant_id} className="border-t">
                        <td className="px-3 py-2 font-semibold">{r.position}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <AvatarGroup size="sm" people={r.players || []} />
                            <span>{r.label || r.participant_id}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">{r.played}</td>
                        <td className="px-3 py-2 text-center font-semibold">{r.wins}</td>
                        <td className="px-3 py-2 text-center">{r.sets_won}–{r.sets_lost}</td>
                        <td className={`px-3 py-2 text-right font-medium ${balance > 0 ? 'text-emerald-700' : balance < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                          {balance > 0 ? `+${balance}` : balance}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 space-y-2 sm:hidden">
              {ranking.slice(0, 16).map((r) => {
                const balance = (r.points_for || 0) - (r.points_against || 0);
                return (
                  <div key={r.participant_id} className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold tabular-nums">{r.position}</span>
                      <AvatarGroup size="sm" people={r.players || []} />
                      <span className="min-w-0 flex-1 truncate font-medium">{r.label || r.participant_id}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-600">
                      <span>PJ <strong className="tabular-nums text-slate-900">{r.played}</strong></span>
                      <span>V <strong className="tabular-nums text-slate-900">{r.wins}</strong></span>
                      <span>Sets <strong className="tabular-nums text-slate-900">{r.sets_won}–{r.sets_lost}</strong></span>
                      <span className={`ml-auto font-semibold tabular-nums ${balance > 0 ? 'text-emerald-700' : balance < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                        Saldo {balance > 0 ? `+${balance}` : balance}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {matches.length > 0 ? (
          <div>
            <h4 className="text-sm font-semibold mb-2">Jogos</h4>
            <div className="hidden sm:block arena-table-wrap">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left">
                    {multiPhase && <th className="px-3 py-2">Fase</th>}
                    <th className="px-3 py-2">Rod.</th>
                    {matches.some((m) => m.group) && <th className="px-3 py-2">Grupo</th>}
                    {matches.some((m) => m.court || m.scheduled_at) && (
                      <>
                        <th className="px-3 py-2">Quadra</th>
                        <th className="px-3 py-2">Horário</th>
                      </>
                    )}
                    <th className="px-3 py-2">Lado A</th>
                    <th className="px-3 py-2">Lado B</th>
                    <th className="px-3 py-2 text-right">Placar</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => (
                    <tr key={m.id} className="border-t">
                      {multiPhase && <td className="px-3 py-2 tabular-nums">{(m.stage_index ?? 0) + 1}</td>}
                      <td className="px-3 py-2">{roundLabel(m)}</td>
                      {matches.some((mm) => mm.group) && (
                        <td className="px-3 py-2">{m.group || '—'}</td>
                      )}
                      {matches.some((mm) => mm.court || mm.scheduled_at) && (
                        <>
                          <td className="px-3 py-2">{m.court || '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{formatPublicMatchTime(m.scheduled_at)}</td>
                        </>
                      )}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <AvatarGroup size="xs" people={sidePeople(m, 'side_a')} />
                          <span>{renderSide(m, 'side_a')}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <AvatarGroup size="xs" people={sidePeople(m, 'side_b')} />
                          <span>{renderSide(m, 'side_b')}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {(m.games || []).map((g, i) => (
                          <span key={i} className="ml-1">
                            {g.a}-{g.b}
                          </span>
                        ))}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary" className="text-xs">
                          {MATCH_STATUS_LABELS[m.status] || m.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 space-y-2.5 sm:hidden">
              {matches.map((m) => {
                const hasGroup = Boolean(m.group);
                const hasSched = Boolean(m.court || m.scheduled_at);
                const hasScore = (m.games || []).length > 0;
                return (
                  <div key={m.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      {multiPhase && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Fase {(m.stage_index ?? 0) + 1}</span>
                      )}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">Rod. {roundLabel(m)}</span>
                      {hasGroup && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{m.group}</span>
                      )}
                      {hasSched && m.court && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{m.court}</span>
                      )}
                      {hasSched && m.scheduled_at && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600">{formatPublicMatchTime(m.scheduled_at)}</span>
                      )}
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {MATCH_STATUS_LABELS[m.status] || m.status}
                      </Badge>
                    </div>
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <AvatarGroup size="xs" people={sidePeople(m, 'side_a')} />
                          <span className="truncate">{renderSide(m, 'side_a')}</span>
                        </div>
                        {hasScore && (
                          <span className="shrink-0 tabular-nums font-semibold text-slate-700">{m.games.map((g) => g.a).join('  ')}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                        <span className="h-px flex-1 bg-slate-100" />vs<span className="h-px flex-1 bg-slate-100" />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <AvatarGroup size="xs" people={sidePeople(m, 'side_b')} />
                          <span className="truncate">{renderSide(m, 'side_b')}</span>
                        </div>
                        {hasScore && (
                          <span className="shrink-0 tabular-nums font-semibold text-slate-700">{m.games.map((g) => g.b).join('  ')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Jogos ainda não publicados.</p>
        )}
      </CardContent>
    </Card>
  );
}
