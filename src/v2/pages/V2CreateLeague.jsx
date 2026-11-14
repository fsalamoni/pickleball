/**
 * /ligas/criar — o assistente de CRIAÇÃO da liga, em cinco passos:
 * quem organiza → formato → temporada → divisões → dados. A liga nasce em
 * rascunho (só a organização vê) e abre as inscrições quando ela quiser.
 * Torneio tem a sua própria tela (`/torneios/criar`); aqui nada se mistura.
 */
import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Building2, CalendarDays, Check, GraduationCap, Landmark, Layers, Plus, Shield, Trash2, Trophy, User, Users, Warehouse } from 'lucide-react';
import { t, tk } from '@/core/i18n';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { BR_UFS } from '@/core/domain/ufs';
import {
  V2BackLink, V2Badge, V2Button, V2Field, V2Input, V2Page, V2SectionHeader, V2Select, V2Surface, V2Textarea, V2Toggle,
} from '@/v2/ui/primitives';
import { CompetitionCreateHero } from '@/v2/components/competition/CompetitionHero';
import { CompetitionStepper, CompetitionWizardFooter } from '@/v2/components/competition/CompetitionNav';
import { SEASON_CADENCE_LABELS } from '@/modules/leagues/domain/leagueSeason';
import { useMyClubs } from '@/modules/clubs/hooks/useClubs';
import { useMyManagedArenas } from '@/modules/arenas/hooks/useArenas';
import { useCoach } from '@/modules/coaches/hooks/useCoaches';
import { useFederation, useMyFederationRoles } from '@/modules/federations/hooks/useFederations';
import { useLeagueAction, useLeaguesVisible } from '@/modules/leagues/hooks/useLeagues';
import { LEAGUE_FLAG_BY_ORGANIZER, LEAGUE_ORGANIZER, LEAGUE_ORGANIZER_LABELS, leagueOrganizerOptions } from '@/modules/leagues/domain/leagueAccess';
import { LEAGUE_FORMAT, LEAGUE_FORMAT_FAMILY, LEAGUE_FORMAT_META, formatMeta, isTeamFormat } from '@/modules/leagues/domain/leagueFormats';
import LeaguesGate from '@/v2/components/leagues/LeaguesGate';
import DivisionFields, { suggestedDivisions, emptyDivision, milpDivisions } from '@/v2/components/leagues/DivisionFields';
import SeasonFields from '@/v2/components/leagues/SeasonFields';
import PointsFields from '@/v2/components/leagues/PointsFields';
import { isLadderFormat } from '@/modules/leagues/domain/leagueLadder';
import { divisionSummary, shortDate } from '@/v2/components/leagues/leagueUi';

const PASSOS = [
  { id: 'org', label: tk('Quem organiza') },
  { id: 'formato', label: tk('Formato') },
  { id: 'temporada', label: tk('Temporada') },
  { id: 'divisoes', label: tk('Divisões') },
  { id: 'dados', label: tk('Dados') },
];

const ICONE_ORG = {
  [LEAGUE_ORGANIZER.ATHLETE]: User,
  [LEAGUE_ORGANIZER.CLUB]: Shield,
  [LEAGUE_ORGANIZER.ARENA]: Warehouse,
  [LEAGUE_ORGANIZER.COACH]: GraduationCap,
  [LEAGUE_ORGANIZER.FEDERATION]: Landmark,
};

export default function V2CreateLeague() {
  return <LeaguesGate><Criar /></LeaguesGate>;
}

function Criar() {
  const navigate = useNavigate();
  const { user, profile, isPlatformAdmin } = useAuth();
  const { flags } = useLeaguesVisible();
  const on = (type) => isPlatformAdmin || flags[LEAGUE_FLAG_BY_ORGANIZER[type]] === true;
  const clubs = useMyClubs({ enabled: on(LEAGUE_ORGANIZER.CLUB) });
  const arenas = useMyManagedArenas();
  const coach = useCoach(on(LEAGUE_ORGANIZER.COACH) ? user?.uid : null);
  const papeis = useMyFederationRoles({ enabled: on(LEAGUE_ORGANIZER.FEDERATION) });
  const criar = useLeagueAction();

  const opcoes = useMemo(() => leagueOrganizerOptions({
    flags,
    isPlatformAdmin,
    user: { uid: user?.uid, name: profile?.platform_name || profile?.full_name || user?.displayName || '' },
    clubs: clubs.data || [],
    arenas: on(LEAGUE_ORGANIZER.ARENA) ? arenas.data || [] : [],
    isCoach: Boolean(coach.data),
    federationRoles: papeis.data || [],
  }), [flags, isPlatformAdmin, user, profile, clubs.data, arenas.data, coach.data, papeis.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const carregandoOpcoes = clubs.isLoading || arenas.isLoading || coach.isLoading || papeis.isLoading;
  const falhouOpcoes = [clubs, arenas, coach, papeis].filter((q) => q.isError);

  const [passo, setPasso] = useState(0);
  const [org, setOrg] = useState(null);
  const [format, setFormat] = useState(LEAGUE_FORMAT.DIVISIONAL_PAIRS);
  const [season, setSeason] = useState({ cadence: 'weekly', start_date: '', legs: 1, skip_dates: [], custom_dates: [] });
  const [standings, setStandings] = useState({ mode: 'points', win: 3, loss: 1, wo_loss: 0 });
  const [divisoes, setDivisoes] = useState([emptyDivision(1)]);
  const [dados, setDados] = useState({ name: '', description: '', city: profile?.city || '', state: profile?.state || '', location: '', visibility: 'public', self_registration: true });
  const duplas = formatMeta(format)?.players === 2;
  const equipes = isTeamFormat(format);
  const ladder = isLadderFormat(format);

  // Equipe joga como a MiLP: a tabela por aproveitamento (a organização troca no passo 3).
  function escolherFormato(id) {
    setFormat(id);
    if (isTeamFormat(id) && !isTeamFormat(format)) setStandings((s) => ({ ...s, mode: 'win_pct' }));
  }

  const problema = (() => {
    if (passo === 0 && !org) return t('Escolha em nome de quem a liga é criada.');
    if (passo === 3) {
      if (!divisoes.length) return t('A liga precisa de pelo menos uma divisão.');
      if (divisoes.some((d) => !String(d.name || '').trim())) return t('Dê um nome a cada divisão.');
    }
    if (passo === 4 && String(dados.name || '').trim().length < 3) return t('O nome da liga precisa de pelo menos 3 letras.');
    return null;
  })();

  const avancar = () => {
    if (problema) { toast.error(problema); return; }
    setPasso((p) => Math.min(PASSOS.length - 1, p + 1));
  };

  async function concluir() {
    if (problema) { toast.error(problema); return; }
    try {
      const { leagueId } = await criar.mutateAsync({
        action: 'create',
        organizer: { type: org.type, id: org.id },
        format,
        season,
        standings,
        divisions: divisoes,
        ...dados,
        state: String(dados.state || '').toUpperCase(),
      });
      toast.success(t('Liga criada como rascunho. Abra as inscrições quando estiver pronta.'));
      navigate(`/ligas/${leagueId}/gerenciar`);
    } catch (err) {
      toast.error(err.message || t('Não foi possível criar a liga.'));
    }
  }

  return (
    <V2Page>
      <V2BackLink to="/ligas" className="mb-5">{t('Voltar às ligas')}</V2BackLink>

      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
      {/* A mesma coluna da criação do torneio: capa + prévia que se atualiza. */}
      <CompetitionCreateHero
        eyebrow={t('Nova liga')}
        title={t('Uma temporada inteira de jogos, rodada a rodada.')}
        description={(
          <>
            {t('A liga dura semanas ou meses: cada divisão joga em pontos corridos e a classificação se atualiza a cada placar. Quer um evento de um fim de semana?')}{' '}
            <Link to="/torneios/criar" className="font-bold text-acid underline-offset-4 hover:underline">{t('Crie um torneio')}</Link>
          </>
        )}
        preview={{
          name: dados.name.trim() || t('Sua liga ainda sem nome'),
          description: dados.description.trim() || t('Adicione uma descrição para dar contexto a atletas e público.'),
          location: [dados.city && `${dados.city}${dados.state ? ` / ${String(dados.state).toUpperCase()}` : ''}`, dados.location].filter(Boolean).join(' · ') || t('Cidade e local ainda não definidos'),
          facts: [
            { icon: Users, label: t('Organização'), value: org ? (org.type === LEAGUE_ORGANIZER.FEDERATION ? t(LEAGUE_ORGANIZER_LABELS[org.type]) : (org.name || t('Você'))) : t('A definir') },
            { icon: Trophy, label: t('Formato'), value: t(formatMeta(format)?.label || '') },
            { icon: CalendarDays, label: t('Temporada'), value: `${t(SEASON_CADENCE_LABELS[season.cadence] || '')}${season.start_date ? ` · ${shortDate(season.start_date)}` : ''}` },
            { icon: Layers, label: t('Divisões'), value: String(divisoes.length) },
          ],
        }}
      />

      <V2Surface className="space-y-6">
        <CompetitionStepper steps={PASSOS} current={passo} onGo={setPasso} dica="criar-liga-etapas" />

        {passo === 0 && (
          <section className="space-y-4">
            <V2SectionHeader eyebrow={t('Passo 1')} title={t('Em nome de quem é a liga?')} />
            {falhouOpcoes.length > 0 && (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {t('Parte das suas organizações não carregou. As que aparecem abaixo estão certas.')}{' '}
                <button type="button" className="font-bold underline" onClick={() => falhouOpcoes.forEach((q) => q.refetch())}>{t('Tentar de novo')}</button>
              </p>
            )}
            {carregandoOpcoes && !opcoes.length ? (
              <p className="text-sm text-gray-500">{t('Carregando…')}</p>
            ) : opcoes.length === 0 ? (
              <p className="rounded-2xl bg-paper p-4 text-sm leading-6 text-gray-500">
                {t('A criação de ligas ainda não foi liberada para você. Pode entrar nas ligas abertas.')}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {opcoes.map((o) => {
                  const Icone = ICONE_ORG[o.type] || Building2;
                  const ativo = org?.type === o.type && org?.id === o.id;
                  return (
                    <button type="button"
                      key={`${o.type}:${o.id}`}
                      aria-pressed={ativo}
                      onClick={() => setOrg(o)}
                      className={cn('flex items-center gap-3 rounded-3xl border p-4 text-left transition-colors', ativo ? 'border-ink bg-ink/5' : 'border-gray-100 hover:border-ink/40')}
                    >
                      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', ativo ? 'bg-ink text-acid' : 'bg-paper text-ink')}>
                        <Icone className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-2xs font-bold uppercase tracking-widest text-gray-500">{t(LEAGUE_ORGANIZER_LABELS[o.type])}</span>
                        <span className="block truncate font-semibold text-ink">
                          {o.type === LEAGUE_ORGANIZER.FEDERATION ? <NomeDaFederacao id={o.id} /> : (o.name || t('Você'))}
                        </span>
                      </span>
                      {ativo && <Check className="ml-auto h-5 w-5 text-ink" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {passo === 1 && (
          <section className="space-y-5">
            <V2SectionHeader eyebrow={t('Passo 2')} title={t('Como a liga é jogada?')} />
            {Object.values(LEAGUE_FORMAT_FAMILY).map((fam) => (
              <div key={fam.id}>
                <p className="mb-2 text-2xs font-bold uppercase tracking-widest text-gray-500">{t(fam.label)}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {Object.entries(LEAGUE_FORMAT_META).filter(([, m]) => m.family === fam.id).map(([id, m]) => {
                    const ativo = format === id;
                    return (
                      <button type="button"
                        key={id}
                        aria-pressed={ativo}
                        disabled={!m.available}
                        onClick={() => escolherFormato(id)}
                        className={cn(
                          'rounded-3xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                          ativo ? 'border-ink bg-ink/5' : 'border-gray-100 hover:border-ink/40',
                        )}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-ink">{t(m.label)}</span>
                          {m.available ? (ativo && <Check className="h-5 w-5 text-ink" aria-hidden="true" />) : <V2Badge tone="neutral">{t('Em breve')}</V2Badge>}
                        </span>
                        <span className="mt-1 block text-sm leading-6 text-gray-500">{t(m.summary)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </section>
        )}

        {passo === 2 && (
          <section className="space-y-6">
            <V2SectionHeader eyebrow={t('Passo 3')} title={t('Temporada e pontuação')} />
            <SeasonFields value={season} onChange={setSeason} ladder={ladder} />
            <PointsFields value={standings} onChange={setStandings} ladder={ladder} />
          </section>
        )}

        {passo === 3 && (
          <section className="space-y-5">
            <V2SectionHeader
              eyebrow={t('Passo 4')}
              title={t('Divisões')}
             
              description={t('Cada divisão é uma tabela própria: quem entra nela só enfrenta quem está nela. Separe por nível (DUPR) e por categoria.')}
            />
            <div className="flex flex-wrap gap-2">
              {equipes && (
                <V2Button type="button" variant="ghost" size="sm" onClick={() => setDivisoes(milpDivisions(formatMeta(format)?.players))}>
                  {t('Divisões da MiLP (teto da soma do DUPR)')}
                </V2Button>
              )}
              <V2Button type="button" variant="ghost" size="sm" onClick={() => setDivisoes(suggestedDivisions())}>
                {t('Uma divisão por faixa de DUPR')}
              </V2Button>
            </div>
            {divisoes.map((d, i) => (
              <div key={i} className="rounded-3xl border border-gray-100 p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-ink">{d.name || t('Divisão {n}', { n: i + 1 })} <span className="font-normal text-gray-500">· {divisionSummary(d)}</span></p>
                  {divisoes.length > 1 && (
                    <V2Button type="button" variant="danger" size="sm" onClick={() => setDivisoes((ds) => ds.filter((_, j) => j !== i))} aria-label={t('Tirar a divisão {nome}', { nome: d.name })}>
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </V2Button>
                  )}
                </div>
                <DivisionFields idPrefix={`div-${i}`} value={d} pairs={duplas || equipes} teams={equipes} onChange={(nova) => setDivisoes((ds) => ds.map((x, j) => (j === i ? nova : x)))} />
              </div>
            ))}
            {divisoes.length < 12 && (
              <V2Button type="button" variant="ghost" onClick={() => setDivisoes((ds) => [...ds, emptyDivision(ds.length + 1)])}>
                <Plus className="h-4 w-4" aria-hidden="true" /> {t('Mais uma divisão')}
              </V2Button>
            )}
          </section>
        )}

        {passo === 4 && (
          <section className="space-y-4">
            <V2SectionHeader eyebrow={t('Passo 5')} title={t('Nome e local')} />
            <V2Field label={t('Nome da liga')} htmlFor="liga-nome" required>
              <V2Input id="liga-nome" value={dados.name} maxLength={100} onChange={(e) => setDados({ ...dados, name: e.target.value })} placeholder={t('Ex.: Liga de Duplas do Verão')} />
            </V2Field>
            <V2Field label={t('Descrição')} htmlFor="liga-desc">
              <V2Textarea id="liga-desc" value={dados.description} maxLength={2000} onChange={(e) => setDados({ ...dados, description: e.target.value })} placeholder={t('Regras da casa, premiação, onde jogar…')} />
            </V2Field>
            <div className="grid gap-4 sm:grid-cols-[1fr,140px]">
              <V2Field label={t('Cidade')} htmlFor="liga-cidade"><V2Input id="liga-cidade" value={dados.city} maxLength={80} onChange={(e) => setDados({ ...dados, city: e.target.value })} /></V2Field>
              <V2Field label={t('UF')} htmlFor="liga-uf">
                <V2Select id="liga-uf" value={String(dados.state || '').toUpperCase()} onChange={(e) => setDados({ ...dados, state: e.target.value })} options={[{ value: '', label: '—' }, ...BR_UFS.map((u) => ({ value: u, label: u }))]} />
              </V2Field>
            </div>
            <V2Field label={t('Local dos jogos')} htmlFor="liga-local" hint={t('Opcional. Na liga flexível, cada dupla combina o local.')}>
              <V2Input id="liga-local" value={dados.location} maxLength={160} onChange={(e) => setDados({ ...dados, location: e.target.value })} />
            </V2Field>
            <div className="space-y-4 rounded-2xl bg-paper p-4">
              <V2Toggle
                id="liga-lista"
                checked={dados.visibility === 'public'}
                onChange={(v) => setDados({ ...dados, visibility: v ? 'public' : 'unlisted' })}
                label={t('Aparecer na lista de ligas')}
                hint={t('Desligado, só quem tem o link encontra a liga.')}
              />
              <V2Toggle
                id="liga-auto"
                checked={dados.self_registration}
                onChange={(v) => setDados({ ...dados, self_registration: v })}
                label={t('Os atletas se inscrevem sozinhos')}
                hint={t('Desligado, só a organização inscreve.')}
              />
            </div>
          </section>
        )}

        <p className="rounded-2xl bg-gray-50 p-4 text-sm leading-6 text-gray-600">
          {t('A liga nasce como rascunho: só a organização a vê. Monte as divisões e, quando estiver pronta, abra as inscrições em "Gerenciar liga".')}
        </p>

        {/* Os mesmos botões do assistente do torneio. */}
        <CompetitionWizardFooter
          step={passo}
          last={passo === PASSOS.length - 1}
          onCancel={() => navigate('/ligas')}
          onBack={() => setPasso((p) => p - 1)}
          next={{ onClick: avancar, disabled: passo === 0 && !opcoes.length }}
          create={{ label: t('Criar liga'), onClick: concluir, busy: criar.isPending }}
        />
      </V2Surface>
      </div>
    </V2Page>
  );
}

function NomeDaFederacao({ id }) {
  const q = useFederation(id);
  return q.data?.name || q.data?.acronym || t('Federação');
}

