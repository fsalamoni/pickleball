import React, { useState } from 'react';
import { useParams, Navigate, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  Layers,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AvatarGroup } from '@/components/ui/user-avatar';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import {
  useTournament,
  useIsTournamentAdmin,
  useModalities,
  useRegistrations,
} from '@/modules/tournament/hooks/useTournament';
import {
  MODALITY_FORMAT_LABELS,
  SKILL_LEVEL_LABELS,
  GENDER_CATEGORY_LABELS,
  AGE_CATEGORY_LABELS,
  REGISTRATION_STATUS,
  TOURNAMENT_STAGE_TYPE_LABELS,
  TOURNAMENT_VISIBILITY,
} from '@/modules/tournament/domain/constants';
import {
  countOccupiedRegistrations,
  hasUnlimitedEntries,
  isRegistrationCapacityReached,
} from '@/modules/tournament/domain/capacity';
import { describeFormat, describeStage } from '@/modules/tournament/domain/formatExplain';
import ModalityInfoContent from '../components/ModalityInfoContent';
import ModalityRegistrationDialog from '../components/ModalityRegistrationDialog';
import ModalityGallery from '../components/ModalityGallery';
import { ModalityMatchesBlock } from '../components/TournamentMatchesTab';
import { ModalityRankingBlock } from '../components/TournamentRankingTab';

const TAB_TRIGGER_CLASSNAME = 'rounded-full px-4 py-2 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-950 data-[state=active]:shadow-[0_14px_30px_-22px_rgba(15,23,42,0.45)]';

function formatDate(value) {
  if (!value) return null;
  try {
    const date = typeof value === 'string'
      ? new Date(`${value}T00:00:00`)
      : value?.toDate
        ? value.toDate()
        : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

function formatBRL(cents) {
  const value = Number(cents || 0) / 100;
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function formatTimeWindow(start, end) {
  if (start && end) return `${start} às ${end}`;
  if (start) return `a partir das ${start}`;
  if (end) return `até ${end}`;
  return null;
}

function buildScheduleLabel(modality) {
  const dateLabel = formatDate(modality.play_date);
  const timeLabel = formatTimeWindow(modality.play_start_time, modality.play_end_time);
  if (dateLabel && timeLabel) return `${dateLabel} · ${timeLabel}`;
  if (dateLabel) return dateLabel;
  if (timeLabel) return timeLabel;
  return 'Programação em definição';
}

function buildCompetitionLabel(modality) {
  const stages = Array.isArray(modality.stages) ? modality.stages : [];
  if (stages.length > 1) return `${stages.length} fases encadeadas`;
  return TOURNAMENT_STAGE_TYPE_LABELS[stages[0]?.type] || 'Formato competitivo definido';
}

function buildEligibilityLine(modality) {
  return `${GENDER_CATEGORY_LABELS[modality.gender_category]} · ${AGE_CATEGORY_LABELS[modality.age_category]} · ${SKILL_LEVEL_LABELS[modality.skill_level]}`;
}

function buildHeroCopy(modality, tournament) {
  const formatLabel = (MODALITY_FORMAT_LABELS[modality.format] || 'modalidade').toLowerCase();
  const competitionLabel = buildCompetitionLabel(modality).toLowerCase();
  return `${tournament.name} abre uma disputa de ${formatLabel} com ${competitionLabel}, pensada para atletas que valorizam jogos organizados, leitura transparente do ranking e progressão competitiva do início ao fim.`;
}

function buildExpectationCopy(modality, tournament) {
  const scheduleLabel = buildScheduleLabel(modality);
  const courtCopy = modality.court_count
    ? `${modality.court_count} quadra(s) reservada(s) para sustentar o ritmo da disputa.`
    : 'A distribuição de quadras e horários segue a programação do torneio.';
  return `${scheduleLabel}. ${courtCopy} O atleta acompanha tudo dentro de ${tournament.name}, com pontuação e critérios unificados na plataforma.`;
}

function resolveRegisterButtonLabel({ alreadyRegistered, canRegister, slotsFull, isAdmin }) {
  if (alreadyRegistered) return 'Você já está inscrito';
  if (!canRegister) return 'Torneio privado: exige código';
  if (slotsFull && !isAdmin) return 'Modalidade lotada';
  return isAdmin ? 'Inscrever jogador' : 'Inscrever-se';
}

function RegistrationTab({ tournament, modality, isAdmin, onRegister }) {
  const { data: registrations = [] } = useRegistrations(modality.id);
  const confirmed = registrations.filter((r) => r.status === REGISTRATION_STATUS.CONFIRMED);
  const hasPrivateAccess =
    typeof window !== 'undefined' && Boolean(sessionStorage.getItem(`tournament_access_${tournament.id}`));
  const isPublic = (tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE) === TOURNAMENT_VISIBILITY.PUBLIC;
  const canRegister = isAdmin || isPublic || hasPrivateAccess;
  const occupied = countOccupiedRegistrations(registrations);
  const slotsFull = isRegistrationCapacityReached(occupied, modality.max_entries);

  return (
    <div className="space-y-4">
      <Card className="rounded-[1.75rem] border-white/80 bg-white/82">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
          <div>
            <div className="text-sm font-semibold text-slate-800">Inscrição na modalidade</div>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {confirmed.length} inscrição(ões) confirmada(s)
              {!isPublic && !hasPrivateAccess && !isAdmin ? ' · torneio privado (use o código para liberar)' : ''}
            </p>
          </div>
          {canRegister ? (
            <Button onClick={onRegister} disabled={slotsFull && !isAdmin}>
              <Plus className="h-4 w-4" />
              <span className="ml-1">{slotsFull && !isAdmin ? 'Modalidade lotada' : isAdmin ? 'Inscrever jogador' : 'Inscrever-se'}</span>
            </Button>
          ) : (
            <Badge variant="secondary">Privado: exige código</Badge>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[1.75rem] border-white/80 bg-white/82">
        <CardContent className="p-5 sm:p-6">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Users className="h-4 w-4 text-emerald-600" /> Inscritos confirmados
          </h3>
          {confirmed.length === 0 ? (
            <p className="text-sm text-slate-500">Ainda não há inscritos confirmados nesta modalidade.</p>
          ) : (
            <div className="space-y-2">
              {confirmed.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-[1.1rem] border border-emerald-950/10 bg-white/80 p-3">
                  <AvatarGroup
                    size="sm"
                    people={[
                      { name: r.player_a_name, photoUrl: r.player_a_photo },
                      ...(r.player_b_name ? [{ name: r.player_b_name, photoUrl: r.player_b_photo }] : []),
                    ]}
                  />
                  <span className="text-sm text-slate-700">{r.label || r.player_a_name}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ModalityInfoTab({
  tournament,
  modality,
  confirmedCount,
  occupiedCount,
  slotsFull,
  canRegister,
  alreadyRegistered,
  isAdmin,
  onRegister,
}) {
  const fee = Number(modality.entry_fee_cents || 0);
  const competitionLabel = buildCompetitionLabel(modality);
  const scheduleLabel = buildScheduleLabel(modality);
  const stages = Array.isArray(modality.stages) ? modality.stages : [];
  const stageType = stages[0]?.type;
  const details = [
    {
      label: 'Perfil competitivo',
      value: SKILL_LEVEL_LABELS[modality.skill_level],
      description: buildEligibilityLine(modality),
      icon: Target,
    },
    {
      label: 'Formato de inscrição',
      value: MODALITY_FORMAT_LABELS[modality.format],
      description: competitionLabel,
      icon: Layers,
    },
    {
      label: 'Programação',
      value: scheduleLabel,
      description: modality.court_count
        ? `${modality.court_count} quadra(s) previstas para a operação desta modalidade`
        : 'Quadras e janela de jogo seguem a programação central do torneio',
      icon: Calendar,
    },
    {
      label: 'Taxa e ocupação',
      value: fee > 0 ? formatBRL(fee) : 'Gratuita',
      description: hasUnlimitedEntries(modality.max_entries)
        ? `${confirmedCount} inscrição(ões) confirmada(s) até aqui`
        : `${occupiedCount}/${modality.max_entries} vaga(s) ocupada(s) no panorama atual`,
      icon: Wallet,
    },
  ];
  const joinReasons = [
    `A modalidade já nasce com um perfil competitivo definido: ${buildEligibilityLine(modality)}.`,
    stages.length > 1
      ? `A disputa foi estruturada em ${stages.length} fases, o que cria narrativa esportiva e mantém o torneio interessante até os momentos decisivos.`
      : describeStage(stageType),
    hasUnlimitedEntries(modality.max_entries)
      ? 'As vagas seguem abertas sem limite formal, o que amplia a porta de entrada sem perder a organização da modalidade.'
      : slotsFull
        ? 'A capacidade configurada está no limite agora, sinal de procura real e de uma modalidade já aquecida dentro do torneio.'
        : `A leitura de ocupação está clara: ${Math.max(Number(modality.max_entries || 0) - occupiedCount, 0)} vaga(s) ainda disponíveis no cenário atual.`,
  ];
  const registerLabel = resolveRegisterButtonLabel({ alreadyRegistered, canRegister, slotsFull, isAdmin });

  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[1.08fr,0.92fr]">
        <Card className="rounded-[2rem] border-white/80 bg-white/82">
          <CardContent className="p-6 sm:p-7">
            <span className="arena-chip">
              <Sparkles className="h-3.5 w-3.5 text-emerald-700" /> Apresentação da modalidade
            </span>
            <h2 className="mt-4 text-3xl font-semibold leading-tight text-slate-950">
              Uma modalidade para quem quer competir com contexto claro e boa cadência de jogos
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              {buildHeroCopy(modality, tournament)}
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              {describeFormat(modality.format)}
            </p>
          </CardContent>
        </Card>

        <Card className="arena-panel-strong rounded-[2rem] border-0">
          <CardContent className="p-6 sm:p-7">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-50/75">Por que entrar</div>
            <h3 className="mt-4 text-3xl font-semibold leading-tight text-white">
              O atleta entende rápido o nível, a dinâmica e o caminho até o pódio.
            </h3>

            <div className="mt-6 space-y-3">
              {joinReasons.map((reason, index) => (
                <HighlightLine key={index} index={index} description={reason} />
              ))}
            </div>

            <div className="mt-6 rounded-[1.35rem] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-50/75">Expectativa esportiva</div>
              <p className="mt-2 text-sm leading-6 text-emerald-50/80">
                {buildExpectationCopy(modality, tournament)}
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                onClick={onRegister}
                disabled={alreadyRegistered || !canRegister || (slotsFull && !isAdmin)}
                className="bg-white text-slate-950 hover:bg-slate-100"
              >
                <Plus className="h-4 w-4" />
                <span className="ml-1">{registerLabel}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {details.map(({ label, value, description, icon: Icon }) => (
          <DetailMetric
            key={label}
            label={label}
            value={value}
            description={description}
            icon={Icon}
          />
        ))}
      </div>

      <Card className="rounded-[2rem] border-white/80 bg-white/82">
        <CardContent className="p-6 sm:p-7">
          <div className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
            <div className="space-y-4">
              <InfoPanel
                icon={Target}
                title="Para quem esta modalidade foi montada"
                description={`${buildEligibilityLine(modality)}. A ideia é oferecer um ambiente coerente com esse perfil, reduzindo ruído na inscrição e aumentando a chance de confrontos compatíveis.`}
              />
              <InfoPanel
                icon={Layers}
                title="Como a experiência se desenrola"
                description={stages.length > 1
                  ? `A competição foi estruturada em ${stages.length} fases, permitindo evolução esportiva ao longo do torneio e leitura mais rica da campanha de cada inscrito.`
                  : describeStage(stageType)}
              />
              <InfoPanel
                icon={ShieldCheck}
                title="O que o atleta deve esperar"
                description={hasUnlimitedEntries(modality.max_entries)
                  ? `${confirmedCount} atleta(s) ou dupla(s) já confirmaram presença. A modalidade segue aberta e a organização ajusta a operação conforme o volume final de inscritos.`
                  : `${confirmedCount} inscrição(ões) confirmada(s) e ${occupiedCount} vaga(s) ocupada(s) no total. Isso ajuda o atleta a decidir com base no ritmo real da modalidade.`}
              />
            </div>

            <div className="rounded-[1.75rem] border border-emerald-950/10 bg-white/85 p-5 sm:p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700/80">Detalhamento técnico</div>
              <h3 className="mt-3 text-2xl font-semibold text-slate-950">
                Estrutura, regras e critérios oficiais da modalidade
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Aqui ficam os detalhes práticos para quem quer entrar já sabendo como a disputa será conduzida.
              </p>
              <div className="mt-5">
                <ModalityInfoContent
                  modality={modality}
                  tournament={tournament}
                  registrationsCount={confirmedCount}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ModalityPage() {
  const enabled = useFeatureFlag(FEATURE_FLAG.MODALITY_PAGES);
  const { tournamentId, modalityId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: tournament, isLoading } = useTournament(tournamentId);
  const { data: isAdmin } = useIsTournamentAdmin(tournamentId);
  const { data: modalities = [] } = useModalities(tournamentId);
  const { data: registrations = [] } = useRegistrations(modalityId);
  const [registerOpen, setRegisterOpen] = useState(false);

  if (!enabled) return <Navigate to={`/torneios/${tournamentId}/visao-geral`} replace />;

  if (isLoading) {
    return <div className="mx-auto max-w-4xl space-y-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  }

  const modality = modalities.find((m) => m.id === modalityId);
  if (!tournament || !modality) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <Trophy className="mx-auto h-10 w-10 text-slate-300" />
        <h2 className="mt-3 font-semibold">Modalidade não encontrada</h2>
        <Link to={`/torneios/${tournamentId}/visao-geral`} className="mt-1 inline-block text-sm text-emerald-700 underline">
          Voltar ao torneio
        </Link>
      </div>
    );
  }

  const confirmedRegistrations = registrations.filter((r) => r.status === REGISTRATION_STATUS.CONFIRMED);
  const confirmedCount = confirmedRegistrations.length;
  const occupiedCount = countOccupiedRegistrations(registrations);
  const slotsFull = isRegistrationCapacityReached(occupiedCount, modality.max_entries);
  const hasPrivateAccess =
    typeof window !== 'undefined' && Boolean(sessionStorage.getItem(`tournament_access_${tournament.id}`));
  const isPublic = (tournament.visibility || TOURNAMENT_VISIBILITY.PRIVATE) === TOURNAMENT_VISIBILITY.PUBLIC;
  const canRegister = !!isAdmin || isPublic || hasPrivateAccess;
  const alreadyRegistered = registrations.some(
    (registration) =>
      registration.user_id === user?.uid
      || registration.player_a_user_id === user?.uid
      || registration.player_b_user_id === user?.uid,
  );
  const stageLabel = buildCompetitionLabel(modality);
  const scheduleLabel = buildScheduleLabel(modality);
  const registerLabel = resolveRegisterButtonLabel({ alreadyRegistered, canRegister, slotsFull, isAdmin: !!isAdmin });
  const summaryCards = [
    {
      label: 'Formato competitivo',
      value: stageLabel,
      description: MODALITY_FORMAT_LABELS[modality.format],
      icon: Layers,
    },
    {
      label: 'Perfil do atleta',
      value: SKILL_LEVEL_LABELS[modality.skill_level],
      description: `${GENDER_CATEGORY_LABELS[modality.gender_category]} · ${AGE_CATEGORY_LABELS[modality.age_category]}`,
      icon: Target,
    },
    {
      label: 'Inscrições',
      value: hasUnlimitedEntries(modality.max_entries)
        ? `${confirmedCount} confirmadas`
        : `${occupiedCount}/${modality.max_entries} ocupadas`,
      description: slotsFull ? 'capacidade preenchida no momento' : 'acompanhamento em tempo real',
      icon: Users,
    },
    {
      label: 'Programação',
      value: scheduleLabel,
      description: feeLabel(modality),
      icon: Calendar,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link to={`/torneios/${tournamentId}/visao-geral`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> {tournament.name}
      </Link>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr,0.85fr]">
        <Card className="arena-panel-strong overflow-hidden rounded-[2rem] border-0">
          <CardContent className="relative p-6 sm:p-8 lg:p-9">
            <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_50%)] lg:block" />
            <div className="relative max-w-4xl">
              <span className="arena-chip border-white/15 bg-white/10 text-emerald-50/90">
                <Sparkles className="h-3.5 w-3.5 text-emerald-50" /> Modalidade do torneio
              </span>

              <div className="mt-5 flex flex-wrap items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] bg-white/10 text-white backdrop-blur-sm sm:h-14 sm:w-14 sm:rounded-[1.5rem]">
                  <Trophy className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-semibold leading-tight text-white sm:text-3xl lg:text-4xl">{modality.name}</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-emerald-50/80 sm:text-base">
                    {buildHeroCopy(modality, tournament)}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full border-0 bg-white/15 px-3 py-1 text-xs text-white shadow-none">
                  {MODALITY_FORMAT_LABELS[modality.format]}
                </Badge>
                <Badge variant="secondary" className="rounded-full border-0 bg-white/15 px-3 py-1 text-xs text-white shadow-none">
                  {SKILL_LEVEL_LABELS[modality.skill_level]}
                </Badge>
                <Badge variant="secondary" className="rounded-full border-0 bg-white/15 px-3 py-1 text-xs text-white shadow-none">
                  {GENDER_CATEGORY_LABELS[modality.gender_category]}
                </Badge>
                <Badge variant="secondary" className="rounded-full border-0 bg-white/15 px-3 py-1 text-xs text-white shadow-none">
                  {AGE_CATEGORY_LABELS[modality.age_category]}
                </Badge>
                {alreadyRegistered && (
                  <Badge variant="secondary" className="rounded-full border-0 bg-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-950 shadow-none">
                    <ShieldCheck className="mr-1 h-3 w-3" /> Você já está inscrito
                  </Badge>
                )}
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map(({ label, value, description, icon: Icon }) => (
                  <div key={label} className="rounded-[1.35rem] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-50/70">{label}</div>
                      <Icon className="h-4 w-4 text-emerald-50/80" />
                    </div>
                    <div className="mt-3 text-sm font-medium leading-6 text-white">{value}</div>
                    <div className="mt-1 text-xs leading-5 text-emerald-50/70">{description}</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[1.75rem] border-white/80 bg-white/82">
          <CardContent className="p-6 sm:p-7">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700/80">Decisão de inscrição</div>
            <h2 className="mt-4 text-3xl font-semibold leading-tight text-slate-950">
              A modalidade já mostra, logo na entrada, o que o atleta precisa para decidir com confiança.
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
              {buildExpectationCopy(modality, tournament)}
            </p>

            <div className="mt-6 space-y-3">
              <InfoPanel
                icon={Target}
                title="Perfil esportivo"
                description={buildEligibilityLine(modality)}
              />
              <InfoPanel
                icon={Layers}
                title="Dinâmica da disputa"
                description={stageLabel}
              />
              <InfoPanel
                icon={Wallet}
                title="Taxa e status"
                description={`${feeLabel(modality)} · ${registerLabel}`}
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => setRegisterOpen(true)} disabled={alreadyRegistered || !canRegister || (slotsFull && !isAdmin)}>
                <Plus className="h-4 w-4" />
                <span className="ml-1">{registerLabel}</span>
              </Button>
              <Button asChild variant="outline">
                <Link to={`/torneios/${tournamentId}/jogos`}>Ver jogos do torneio</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <Tabs defaultValue="info" className="w-full">
        <div className="rounded-[1.75rem] border border-white/80 bg-white/82 p-3 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.28)]">
          <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex h-auto min-w-full justify-start gap-2 rounded-[1.5rem] bg-secondary/45 p-2 sm:min-w-0">
              <TabsTrigger value="info" className={TAB_TRIGGER_CLASSNAME}>Visão geral</TabsTrigger>
              <TabsTrigger value="inscricao" className={TAB_TRIGGER_CLASSNAME}>Inscrição</TabsTrigger>
              <TabsTrigger value="jogos" className={TAB_TRIGGER_CLASSNAME}>Jogos</TabsTrigger>
              <TabsTrigger value="ranking" className={TAB_TRIGGER_CLASSNAME}>Ranking</TabsTrigger>
              <TabsTrigger value="fotos" className={TAB_TRIGGER_CLASSNAME}>Fotos</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="info" className="mt-4">
          <ModalityInfoTab
            tournament={tournament}
            modality={modality}
            confirmedCount={confirmedCount}
            occupiedCount={occupiedCount}
            slotsFull={slotsFull}
            canRegister={canRegister}
            alreadyRegistered={alreadyRegistered}
            isAdmin={!!isAdmin}
            onRegister={() => setRegisterOpen(true)}
          />
        </TabsContent>

        <TabsContent value="inscricao" className="mt-4">
          <RegistrationTab tournament={tournament} modality={modality} isAdmin={!!isAdmin} onRegister={() => setRegisterOpen(true)} />
        </TabsContent>

        <TabsContent value="jogos" className="mt-4">
          <ModalityMatchesBlock tournament={tournament} modality={modality} isAdmin={false} />
        </TabsContent>

        <TabsContent value="ranking" className="mt-4">
          <ModalityRankingBlock modality={modality} />
        </TabsContent>

        <TabsContent value="fotos" className="mt-4">
          <ModalityGallery tournamentId={tournament.id} modalityId={modality.id} canManage={!!isAdmin} />
        </TabsContent>
      </Tabs>

      <ModalityRegistrationDialog
        modality={modality}
        tournament={tournament}
        isAdmin={!!isAdmin}
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
      />

      {isAdmin && (
        <p className="text-center text-xs text-slate-400">
          A administração (sorteio de grupos, jogos e resultados) continua na aba{' '}
          <button type="button" className="underline" onClick={() => navigate(`/torneios/${tournamentId}/admin`)}>Admin</button> do torneio.
        </p>
      )}
    </div>
  );
}

function DetailMetric({ label, value, description, icon: Icon }) {
  return (
    <Card className="rounded-[1.75rem] border-white/80 bg-white/82">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700/75">{label}</div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
        <div className="mt-3 text-lg font-semibold text-slate-950">{value}</div>
        <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
      </CardContent>
    </Card>
  );
}

function HighlightLine({ index, description }) {
  return (
    <div className="rounded-[1.35rem] border border-white/12 bg-white/10 p-4 backdrop-blur-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-50/75">0{index + 1}</div>
      <p className="mt-2 text-sm leading-6 text-emerald-50/80">{description}</p>
    </div>
  );
}

function InfoPanel({ icon: Icon, title, description }) {
  return (
    <div className="rounded-[1.35rem] border border-emerald-950/10 bg-white/75 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <Icon className="h-4 w-4 text-emerald-700" /> {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

function feeLabel(modality) {
  return Number(modality.entry_fee_cents || 0) > 0
    ? `Taxa ${formatBRL(modality.entry_fee_cents)}`
    : 'Inscrição gratuita';
}
