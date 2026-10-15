/**
 * Procura-se jogo (`/procura-jogo`) — onde dá para jogar nos próximos dias.
 *
 * É o "ver todos" do "Jogar" do início, com as MESMAS regras
 * (`usePlayDiscovery` → `buildPlayList`):
 *  - ⭐ os DIAS DE JOGO públicos — do atleta e da ARENA. 🐞 O dia que a arena
 *    marca no calendário nunca aparecia aqui (nem no início): ele não cria
 *    convite, e a tela só lia convites;
 *  - os jogos abertos das arenas (com entrar, fila e nível ali mesmo);
 *  - os convites soltos dos atletas.
 *
 * ⭐ Cada cartão tem o BOTÃO de entrar e de sair ali mesmo (`PlayItemAction`),
 * pelo caminho de cada origem; o título leva para DENTRO do dia de jogo, onde
 * estão o formato e quem vai. O que a pessoa já tem fica na lista, com "Você
 * vai" e o "Sair" — sumir no clique que entrou pareceria falha.
 *
 * ⭐ Os dias de jogo dos CLUBES da pessoa entram também: são privados do
 * clube, e é por ser membro que ela os vê (uma consulta por clube, que a
 * regra só deixa passar para quem é do clube). O dia da ARENA é sempre
 * público — não há dia de arena "só para membros".
 *
 * "O que já passou, não mostre mais": convite vencido de outra pessoa não
 * aparece (antes ficava numa seção de "passados"); o SEU convite vencido
 * continua na sua caixa, marcado, para você encerrar.
 *
 * Com a MINHA REGIÃO (flag `my_region`), tudo obedece à região da pessoa,
 * com a barra no topo dizendo qual é.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavRotulos } from '@/core/lib/useNavRotulos';
import {
  ArrowRight, CalendarDays, Clock, Dices, MapPin, Megaphone, Plus, Trophy, X,
} from 'lucide-react';
import { useRelogio } from '@/core/lib/useRelogio';
import { useMyOpenGames, useCloseOpenGame } from '@/modules/games/hooks/useOpenGames';
import { usePlayDiscovery } from '@/modules/games/hooks/usePlayDiscovery';
import { OPEN_GAME_FORMAT_LABELS, OPEN_GAME_STATUS } from '@/modules/games/domain/openGames';
import { PLAY_KIND } from '@/modules/games/domain/playDiscovery';
import { hojeLocal } from '@/modules/home/domain/freshness';
import { getLevelByCode } from '@/modules/leveling/data/levels';
import { useRegionalList } from '@/core/lib/useMyRegion';
import { distanceLabel } from '@/core/domain/region';
import CreateOpenGameDialog from '@/modules/games/components/CreateOpenGameDialog';
import V2ChatLauncherButton from '@/v2/components/chat/V2ChatLauncherButton';
import OpenSlotsDiscovery from '@/v2/components/arenas/openMatch/OpenSlotsDiscovery';
import PlayGameDayCard from '@/v2/components/games/play/PlayGameDayCard';
import RegionBar, { RegionEmptyHint, RegionForaNote } from '@/v2/components/region/RegionBar';
import {
  V2Avatar,
  V2Badge,
  V2Button,
  V2EmptyState,
  V2PageIntro,
  V2Skeleton,
  V2Surface, V2ErrorState, V2Page,
} from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

function levelLabel(code) {
  if (!code) return null;
  return getLevelByCode(code)?.name || code;
}

function formatDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
}

const lugarDe = (item) => item.place;

/** Um convite solto de "Procura-se jogo". */
function OpenGameCard({ g, distancia }) {
  const dateLabel = formatDate(g.date);
  return (
    <V2Surface className="flex h-full flex-col p-6 transition-all hover:shadow-organic sm:p-6">
      <div className="flex items-center gap-3">
        <V2Avatar name={g.creator_name} photoUrl={g.creator_photo} size="md" />
        <span className="truncate font-bold text-ink">{g.creator_name}</span>
      </div>
      <div className="mt-4 space-y-1.5 text-sm text-gray-500">
        {dateLabel && <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-gray-400" /> <span className="font-semibold text-ink">{dateLabel}</span></div>}
        {g.when_text && <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-gray-400" /> {g.when_text}</div>}
        {(g.city || g.state) && (
          <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-gray-400" /> {[g.city, g.state].filter(Boolean).join(' / ')}{distancia ? ` · ${distancia}` : ''}</div>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {g.kind === 'game_day'
          ? <V2Badge tone="blue"><Dices className="h-3 w-3" /> {t('Dia de jogo')}</V2Badge>
          : <V2Badge tone="neutral">{t(OPEN_GAME_FORMAT_LABELS[g.format]) || g.format}</V2Badge>}
        {levelLabel(g.level) && <V2Badge tone="acid"><Trophy className="h-3 w-3" /> {levelLabel(g.level)}</V2Badge>}
      </div>
      {g.notes && <p className="mt-3 text-sm text-gray-500">{g.notes}</p>}
      <div className="mt-auto space-y-2 pt-5">
        {/* O dia de jogo se abre por DENTRO: lá estão o formato, quem vai e o
            botão de participar. */}
        {g.kind === 'game_day' && g.game_day_id && (
          <V2Button asChild className="w-full">
            <Link to={`/dia-de-jogo/${g.game_day_id}`}>{t('Ver e participar')} <ArrowRight className="h-4 w-4" /></Link>
          </V2Button>
        )}
        <V2ChatLauncherButton
          athlete={{ id: g.created_by, platform_name: g.creator_name, photo_url: g.creator_photo }}
          className="w-full"
          label={t('Chamar para jogar')}
        />
      </div>
    </V2Surface>
  );
}

export default function V2OpenGames() {
  const rotulos = useNavRotulos();
  const { ms: agora } = useRelogio(60_000);
  const hoje = hojeLocal(new Date(agora));
  const jogos = usePlayDiscovery({ hoje, agora });
  const { data: myGames = [] } = useMyOpenGames();
  const closeGame = useCloseOpenGame();
  const [createOpen, setCreateOpen] = useState(false);

  // As duas listas desta tela, na ordem da lista única (do mais cedo ao mais
  // tarde). O jogo aberto tem a seção própria, com entrar e fila.
  const itensDia = useMemo(() => jogos.itens.filter((i) => i.kind === PLAY_KIND.DIA), [jogos.itens]);
  const itensConvite = useMemo(() => jogos.itens.filter((i) => i.kind === PLAY_KIND.CONVITE), [jogos.itens]);
  const dias = useRegionalList(itensDia, lugarDe);
  const convites = useRegionalList(itensConvite, lugarDe);
  const conviteDoc = useMemo(() => new Map(jogos.convites.map((g) => [g.id, g])), [jogos.convites]);

  const myOpen = useMemo(
    () => myGames.filter((g) => g.status === OPEN_GAME_STATUS.OPEN)
      .sort((a, b) => {
        if (a.date && b.date) return a.date < b.date ? -1 : 1;
        if (a.date && !b.date) return -1;
        if (!a.date && b.date) return 1;
        return (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0);
      }),
    [myGames],
  );

  const carregando = jogos.carregando || dias.carregando;
  const nada = !carregando && !jogos.isError
    && dias.itens.length === 0 && convites.itens.length === 0 && dias.fora === 0 && convites.fora === 0;

  return (
    <V2Page>
      <V2PageIntro
        title={rotulos.vagas}
        subtitle={t('Dias de jogo com vaga, jogos abertos das arenas e convites — de hoje em diante.')}
        action={<V2Button onClick={() => setCreateOpen(true)} data-dica="procura-publicar"><Plus className="h-4 w-4" /> {t('Publicar convite')}</V2Button>}
      />

      {/* A região vale para a tela inteira; o que ficou de fora é dito em cada seção. */}
      <RegionBar regional={dias} className="mb-6" mostrarFora={false} />

      {myOpen.length > 0 && (
        <V2Surface className="mb-8">
          <p className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Seus convites abertos')}</p>
          <div className="mt-4 space-y-2">
            {myOpen.map((g) => {
              const dateLabel = formatDate(g.date);
              const isPast = g.date && g.date < hoje;
              return (
                <div key={g.id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-paper p-3">
                  <div className="min-w-0 text-sm">
                    <span className="font-bold text-ink">{dateLabel || g.when_text || t('Dia de jogo')}</span>
                    {dateLabel && g.when_text && <span className="text-gray-500"> · {g.when_text}</span>}
                    <span className="text-gray-500"> · {[g.city, g.state].filter(Boolean).join(' / ')}</span>
                    {isPast && <V2Badge tone="neutral" className="ml-2">{t('Data passada — encerre')}</V2Badge>}
                  </div>
                  <V2Button variant="ghost" size="sm" onClick={() => closeGame.mutate(g.id)} disabled={closeGame.isPending}>
                    <X className="h-4 w-4" /> {t('Encerrar')}
                  </V2Button>
                </div>
              );
            })}
          </div>
        </V2Surface>
      )}

      {jogos.falhas.dias && (
        <div className="mb-6">
          <V2ErrorState inline title={t('Não foi possível carregar os dias de jogo')} description={t('A conexão falhou. Os dias de jogo continuam lá — tente de novo.')} onRetry={jogos.recarregar.dias} />
        </div>
      )}
      {jogos.falhas.clubes && (
        <div className="mb-6">
          <V2ErrorState inline title={t('Não foi possível carregar os dias de jogo dos seus clubes')} description={t('A conexão falhou. Os dias marcados nos seus clubes continuam lá — tente de novo.')} onRetry={jogos.recarregar.clubes} />
        </div>
      )}
      {jogos.falhas.convites && (
        <div className="mb-6">
          <V2ErrorState inline title={t('Não foi possível carregar os convites')} description={t('A conexão falhou. Os convites publicados continuam lá — tente de novo.')} onRetry={jogos.recarregar.convites} />
        </div>
      )}

      {carregando ? (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => <V2Skeleton key={i} className="h-64 rounded-4xl" />)}
        </div>
      ) : (
        <div data-dica="procura-lista" className="space-y-10">
          {(dias.itens.length > 0 || dias.fora > 0) && (
            <section>
              <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-widest text-gray-500">
                <Dices className="h-3.5 w-3.5" aria-hidden="true" /> {t('Dias de jogo com vaga')}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {t('Os públicos, dos atletas e das arenas, e os dos seus clubes. Entre direto — ou abra para ver o formato e quem vai.')}
              </p>
              <RegionForaNote regional={dias} nomeItens={[t('dia de jogo'), t('dias de jogo')]} className="mt-1 block text-sm" />
              <RegionEmptyHint regional={dias} oque={t('Nenhum dia de jogo com vaga')} className="mt-4" />
              {dias.itens.length > 0 && (
                <div className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {dias.itens.map((item) => (
                    <PlayGameDayCard
                      key={item.key}
                      item={item}
                      distancia={dias.ativa ? distanceLabel(dias.infoDe(item)?.km) : null}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Os jogos com vaga que as ARENAS publicaram — entrar e fila ali mesmo. */}
          <OpenSlotsDiscovery />

          {(convites.itens.length > 0 || convites.fora > 0) && (
            <section>
              <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-widest text-gray-500">
                <Megaphone className="h-3.5 w-3.5" aria-hidden="true" /> {t('Convites de quem procura jogo')}
              </p>
              <RegionForaNote regional={convites} nomeItens={[t('convite'), t('convites')]} className="mt-1 block text-sm" />
              <RegionEmptyHint regional={convites} oque={t('Nenhum convite')} className="mt-4" />
              {convites.itens.length > 0 && (
                <div className="mt-4 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                  {convites.itens.map((item) => {
                    const g = conviteDoc.get(item.id);
                    if (!g) return null;
                    return (
                      <OpenGameCard
                        key={item.key}
                        g={g}
                        distancia={convites.ativa ? distanceLabel(convites.infoDe(item)?.km) : null}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {nada && (
            <V2Surface>
              <V2EmptyState
                icon={Megaphone}
                title={t('Nenhum jogo marcado para os próximos dias')}
                description={dias.limita ? t('Nenhum dia de jogo nem convite {regiao} de hoje em diante — nem nos seus clubes. Publique um convite ou crie um dia de jogo público: ele aparece aqui para quem procura jogo.', { regiao: dias.frase }) : t('Nenhum dia de jogo nem convite de hoje em diante — nem nos seus clubes. Publique um convite ou crie um dia de jogo público: ele aparece aqui para quem procura jogo.')}
                action={(
                  <div className="flex flex-wrap justify-center gap-2">
                    <V2Button onClick={() => setCreateOpen(true)}>{t('Publicar convite')}</V2Button>
                    <V2Button asChild variant="secondary"><Link to="/dia-de-jogo?criar=1">{t('Criar dia de jogo')}</Link></V2Button>
                  </div>
                )}
              />
            </V2Surface>
          )}
        </div>
      )}

      {createOpen && <CreateOpenGameDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </V2Page>
  );
}
