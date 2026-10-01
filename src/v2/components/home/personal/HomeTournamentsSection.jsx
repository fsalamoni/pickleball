/**
 * "Torneios" na tela inicial — para quem quer competir.
 *
 * Em cima, "Seus torneios": os que a pessoa JOGA (acontecendo ou por começar)
 * e os que ela ORGANIZA, numa lista só — quem criou o torneio e se inscreveu
 * nele vê UMA linha, com as duas marcas. Embaixo, os com inscrição aberta DE
 * VERDADE (status + prazo), perto dela primeiro, SEM os dela. Nenhum
 * encerrado, nenhum com prazo vencido — é a régua de `freshness.js`.
 *
 * 🐞 Antes o "seu" era só `my_role === 'player'`, e organizar vence jogar no
 * papel: o torneio que a pessoa criou e em que se inscreveu sumia de "Você
 * está inscrito" e aparecia em "Inscrições abertas" com "inscreva-se".
 *
 * Com a MINHA REGIÃO (flag `my_region`), os abertos são os da região da
 * pessoa (a cidade e o raio que ela escolheu), com a distância ao lado e o
 * que ficou de fora dito — nunca escondido calado.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, MapPin, Trophy } from 'lucide-react';
import { usePublicTournaments } from '@/modules/tournament/hooks/useTournament';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { TOURNAMENT_PHASE, TOURNAMENT_PHASE_LABEL } from '@/modules/home/domain/freshness';
import {
  localTexto, meuPapelTexto, myTournamentsForHome, openTournamentsForMe, periodoTexto, prazoTexto,
} from '@/modules/home/domain/homeTournaments';
import { useRegionalList } from '@/core/lib/useMyRegion';
import { distanceLabel } from '@/core/domain/region';
import RegionBar, { RegionEmptyHint } from '@/v2/components/region/RegionBar';
import { HomeAction, HomeEmpty, HomeRow, HomeSection } from './HomeSection';

const LIMITE_ABERTOS = 4;
const LIMITE_MEUS = 4;

const TOM_DA_FASE = {
  [TOURNAMENT_PHASE.LIVE]: 'acid',
  [TOURNAMENT_PHASE.STALE]: 'amber',
  [TOURNAMENT_PHASE.OPEN]: 'green',
  [TOURNAMENT_PHASE.UPCOMING]: 'blue',
  [TOURNAMENT_PHASE.DRAFT]: 'neutral',
};

export default function HomeTournamentsSection({ reason, hoje, perfil, meus = [], meusQ, podeCriar = false }) {
  const publicos = usePublicTournaments();
  const meusAtuais = useMemo(() => myTournamentsForHome(meus, hoje), [meus, hoje]);
  // "Já é meu": os que eu jogo E os que eu organizo — nenhum dos dois volta
  // embaixo como "inscreva-se".
  const jaMeus = useMemo(() => new Set(meusAtuais.map((x) => x.tournament.id)), [meusAtuais]);
  const abertos = useMemo(
    () => openTournamentsForMe(publicos.data || [], { hoje, perfil, inscritos: jaMeus }),
    [publicos.data, hoje, perfil, jaMeus],
  );
  const naoInscritoTodos = useMemo(() => abertos.filter((a) => !a.inscrito), [abertos]);
  const regional = useRegionalList(naoInscritoTodos, (a) => ({ city: a.tournament.city, state: a.tournament.state }));
  const naoInscrito = regional.itens;

  return (
    <HomeSection id="torneios" icon={Trophy} title="Torneios" reason={reason} action={{ to: '/torneios', label: 'Ver todos' }}>
      <div className="space-y-4">
        {meusQ?.isError ? (
          <V2ErrorState inline title="Não carregou os seus torneios" description="Os seus torneios continuam lá." onRetry={meusQ.refetch} />
        ) : meusAtuais.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">Seus torneios</p>
            <ul className="space-y-1">
              {meusAtuais.slice(0, LIMITE_MEUS).map((item) => {
                const { tournament: t, phase, organizo, inscrito } = item;
                return (
                  <li key={t.id}>
                    <HomeRow
                      // Só organiza: direto à gestão. Joga (organizando ou não):
                      // a página do torneio, que mostra a inscrição e, para quem
                      // organiza, o botão de gerenciar.
                      to={organizo && !inscrito ? `/torneios/${t.id}/gerenciar` : `/torneios/${t.id}`}
                      icon={organizo ? ClipboardList : Trophy}
                      title={t.name}
                      subtitle={[meuPapelTexto(item), periodoTexto(t, hoje), localTexto(t)].filter(Boolean).join(' · ')}
                      badge={TOURNAMENT_PHASE_LABEL[phase]}
                      badgeTone={TOM_DA_FASE[phase] || 'blue'}
                      highlight={organizo && phase === TOURNAMENT_PHASE.STALE}
                    />
                  </li>
                );
              })}
            </ul>
            {meusAtuais.length > LIMITE_MEUS && (
              <p className="mt-1 px-3 text-xs text-gray-500">
                E mais {meusAtuais.length - LIMITE_MEUS} — em <Link to="/perfil/torneios" className="font-semibold text-ink underline">Meus torneios</Link>.
              </p>
            )}
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">Inscrições abertas</p>
          <RegionBar regional={regional} compacta className="mb-2" nomeItens={['torneio', 'torneios']} />
          {/* Espera os MEUS também: sem eles, o torneio que eu organizo apareceria
              aqui como "inscreva-se" por um instante. */}
          {publicos.isLoading || regional.carregando || meusQ?.isLoading ? (
            <V2Skeleton lines={3} />
          ) : publicos.isError ? (
            <V2ErrorState
              inline
              title="Não carregou os torneios abertos"
              description="Pode haver torneio com inscrição aberta — tente de novo."
              onRetry={publicos.refetch}
            />
          ) : naoInscrito.length === 0 && regional.fora > 0 ? (
            <RegionEmptyHint regional={regional} oque="Nenhum torneio com inscrição aberta" />
          ) : naoInscrito.length === 0 ? (
            <HomeEmpty
              icon={Trophy}
              actions={(
                <>
                  <HomeAction to="/torneios">Ver torneios</HomeAction>
                  {podeCriar && <HomeAction to="/torneios/criar" primary>Criar torneio</HomeAction>}
                </>
              )}
            >
              {abertos.length > 0
                ? 'Os torneios com inscrição aberta agora já são seus — você joga ou organiza cada um deles.'
                : `Nenhum torneio com inscrição aberta agora${regional.limita ? ` ${regional.frase}` : ''}. Novos torneios aparecem aqui assim que abrirem.`}
            </HomeEmpty>
          ) : (
            <ul className="space-y-1">
              {naoInscrito.slice(0, LIMITE_ABERTOS).map((item) => { const { tournament: t, perto } = item; return (
                <li key={t.id}>
                  <HomeRow
                    to={`/torneios/${t.id}`}
                    icon={perto > 0 ? MapPin : Trophy}
                    title={t.name}
                    subtitle={[prazoTexto(t, hoje), localTexto(t), regional.ativa ? distanceLabel(regional.infoDe(item)?.km) : null].filter(Boolean).join(' · ')}
                    // Só entra aqui quem ainda NÃO se inscreveu: o selo diz o
                    // que o toque faz (a inscrição, dentro do torneio).
                    badge={regional.ativa || !perto ? 'Inscreva-se' : (perto === 2 ? 'Na sua cidade · inscreva-se' : 'No seu estado · inscreva-se')}
                    badgeTone="green"
                  />
                </li>
              ); })}
            </ul>
          )}
        </div>
      </div>
    </HomeSection>
  );
}
