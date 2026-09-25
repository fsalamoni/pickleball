/**
 * O RANKING DA CASA (Onda CB) — o mesmo corpo na Central da arena e na página
 * pública da arena. A arena e o atleta olham a MESMA conta.
 *
 * Três coisas que a tela precisa dizer, além da tabela:
 *  - **de onde vêm os pontos** (a tabela de pontos e os eventos que entraram):
 *    ranking sem explicação vira "por que ele está na minha frente?";
 *  - **o que ainda não entrou, e por quê** (torneio em andamento, dia sem
 *    resultado, Play): sem isso, a arena procura o jogo de ontem, não acha e
 *    conclui que o sistema errou;
 *  - **o que ficou de fora por FALHA**: uma leitura que falha não pode sumir
 *    da soma calada — o ranking estaria errado e pareceria certo.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Crown, Info, Medal, Plus, Swords, Trophy } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { useHouseRanking } from '@/modules/arenas/hooks/useHouseRanking';
import {
  HOUSE_ALL, HOUSE_EVENT_KIND, HOUSE_TOURNAMENT_WEIGHT, houseFormatLabel, houseRankingPointsTable,
} from '@/modules/arenas/domain/houseRanking';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import {
  V2Avatar, V2Badge, V2Button, V2EmptyState, V2ErrorState, V2FilterChip, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';

/** Quantas linhas aparecem antes de "ver todos". */
const PRIMEIRAS = 20;

function Chip({ active, onClick, children }) {
  return (
    <V2FilterChip active={active} aria-pressed={active} onClick={onClick} className="px-3.5 py-1.5 text-xs">
      {children}
    </V2FilterChip>
  );
}

function pts(n) {
  return `${n} ${n === 1 ? 'ponto' : 'pontos'}`;
}

function metaDaLinha(r) {
  const partes = [`${r.events} ${r.events === 1 ? 'evento' : 'eventos'}`];
  if (r.wins > 0) partes.push(`${r.wins} ${r.wins === 1 ? 'vitória' : 'vitórias'}`);
  if (r.titles > 0) partes.push(`${r.titles} ${r.titles === 1 ? 'título' : 'títulos'}`);
  return partes.join(' · ');
}

const PODIO = [
  { tom: 'bg-acid text-ink', icone: Crown, rotulo: 'Líder' },
  { tom: 'bg-ink text-white', icone: Medal, rotulo: '2º' },
  { tom: 'bg-paper text-ink', icone: Medal, rotulo: '3º' },
];

function Podio({ rows, meuUid }) {
  if (rows.length === 0) return null;
  return (
    <ol className="grid gap-2 sm:grid-cols-3" aria-label="Pódio da temporada">
      {rows.slice(0, 3).map((r, i) => {
        const estilo = PODIO[i];
        const Icone = estilo.icone;
        return (
          <li key={r.user_id} className={cn('flex items-center gap-3 rounded-3xl p-4', estilo.tom)}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 font-display text-lg font-black">
              {r.position}º
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate font-bold">
                <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{r.name}</span>
                {r.user_id === meuUid && <span className="shrink-0 text-[10px] font-black uppercase">· você</span>}
              </p>
              <p className="text-xs opacity-80">{metaDaLinha(r)}</p>
            </div>
            <p className="shrink-0 text-right font-display text-xl font-black leading-none">
              {r.points}
              <span className="block text-[10px] font-bold uppercase tracking-wider opacity-70">pts</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function Linha({ r, eu }) {
  return (
    <li className={cn(
      'flex items-center gap-3 rounded-2xl border px-3 py-2.5',
      eu ? 'border-ink bg-acid/15' : 'border-gray-100 bg-paper-pure',
    )}>
      <span className="w-8 shrink-0 text-center font-display text-sm font-black text-ink">{r.position}º</span>
      <V2Avatar name={r.name} photoUrl={r.photo_url} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-bold text-ink">
          <span className="truncate">{r.name}</span>
          {eu && <V2Badge tone="acid" className="shrink-0 px-2 py-0 text-[10px]">você</V2Badge>}
        </p>
        <p className="text-xs text-gray-500">{metaDaLinha(r)}</p>
      </div>
      <p className="shrink-0 font-display text-base font-black text-ink">{r.points}</p>
    </li>
  );
}

function TabelaDePontos() {
  const t = houseRankingPointsTable();
  const Coluna = ({ titulo, linhas }) => (
    <div className="rounded-2xl bg-paper p-3">
      <p className="text-xs font-bold text-ink">{titulo}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {linhas.map((l) => (
          <li key={l.label} className="rounded-full bg-paper-pure px-2.5 py-0.5 text-xs text-ink">
            <strong>{l.label}</strong> {l.points}
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Coluna titulo="Jogo aberto e dia de jogo com placar" linhas={t.gameDay} />
      <Coluna titulo={`Torneio da casa, por categoria (vale ${HOUSE_TOURNAMENT_WEIGHT}×)`} linhas={t.tournament} />
    </div>
  );
}

function resumoDasFontes(s) {
  const partes = [];
  if (s.gameDays > 0) {
    partes.push(s.openMatches === s.gameDays
      ? `${s.gameDays} ${s.gameDays === 1 ? 'jogo aberto' : 'jogos abertos'}`
      : `${s.gameDays} ${s.gameDays === 1 ? 'dia de jogo' : 'dias de jogo'} (${s.openMatches} ${s.openMatches === 1 ? 'jogo aberto' : 'jogos abertos'})`);
  }
  if (s.tournaments > 0) {
    partes.push(`${s.tournaments} ${s.tournaments === 1 ? 'torneio' : 'torneios'} (${s.categories} ${s.categories === 1 ? 'categoria' : 'categorias'})`);
  }
  if (s.legacy) partes.push('os torneios internos antigos');
  return partes.join(', ');
}

function DeOndeVem({ events, waiting, summary }) {
  const [aberto, setAberto] = useState(false);
  const ordenados = useMemo(
    () => [...events].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))),
    [events],
  );
  const texto = resumoDasFontes(summary);
  return (
    <div className="rounded-3xl border border-gray-100 bg-paper-pure">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-ink">
          <Info className="h-4 w-4 shrink-0" /> De onde vêm os pontos
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-500 transition-transform', aberto && 'rotate-180')} />
      </button>
      {aberto && (
        <div className="space-y-4 border-t border-gray-100 px-4 py-4">
          <p className="text-sm text-gray-600">
            {texto ? <>Nesta temporada entraram {texto}.</> : 'Nesta temporada ainda não entrou nenhum resultado.'}
            {' '}Cada evento dá pontos pela colocação; quem jogou e não ficou entre os quatro leva os pontos de presença.
            Empate em pontos: vale quem tem mais títulos, depois mais vitórias, depois quem somou em menos eventos.
          </p>
          <TabelaDePontos />

          {ordenados.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">O que entrou</p>
              <ul className="mt-2 space-y-1.5">
                {ordenados.map((e) => (
                  <li key={e.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-sm">
                    <span className="min-w-0">
                      {e.link ? (
                        <Link to={e.link} className="font-bold text-ink hover:underline">{e.title}</Link>
                      ) : <strong className="text-ink">{e.title}</strong>}
                      {e.subtitle ? <span className="text-gray-500"> · {e.subtitle}</span> : null}
                    </span>
                    <span className="text-xs text-gray-500">
                      {[e.date ? formatDateShortBR(e.date) : '', e.kind === HOUSE_EVENT_KIND.LEGACY ? 'pontos acumulados' : e.formatLabel]
                        .filter(Boolean).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {waiting.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Ainda não entrou</p>
              <ul className="mt-2 space-y-1.5">
                {waiting.map((w) => (
                  <li key={w.key} className="text-sm">
                    <Link to={w.link} className="font-bold text-ink hover:underline">{w.title}</Link>
                    {w.date ? <span className="text-xs text-gray-500"> · {formatDateShortBR(w.date)}</span> : null}
                    <span className="block text-xs text-gray-500">{w.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * @param {{ arena: object, audience?: 'arena'|'public', className?: string }} props
 */
export default function HouseRankingPanel({ arena, audience = 'public', className }) {
  const { user } = useAuth();
  const anoCorrente = new Date().getFullYear();
  const [season, setSeason] = useState(anoCorrente);
  const [format, setFormat] = useState(HOUSE_ALL);
  const [todos, setTodos] = useState(false);

  const r = useHouseRanking(arena?.id, { season, format });
  const meuUid = user?.uid || null;
  const minhaLinha = meuUid ? r.rows.find((x) => x.user_id === meuUid) : null;
  const visiveis = todos ? r.rows : r.rows.slice(0, PRIMEIRAS);
  const restante = r.rows.length - visiveis.length;
  const nomeDaTemporada = season === HOUSE_ALL ? 'todas as temporadas' : `a temporada ${season}`;
  // Filtro de modalidade só aparece quando há mais de uma para escolher.
  const mostraModalidades = r.formats.length > 1;

  const trocaTemporada = (s) => { setSeason(s); setFormat(HOUSE_ALL); setTodos(false); };

  return (
    <V2Surface className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
            <Trophy className="h-5 w-5 shrink-0" /> Ranking da casa
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Soma os jogos abertos e os dias de jogo com placar e os torneios da casa. Atualiza sozinho a cada resultado.
          </p>
        </div>
        {audience === 'arena' && (
          <V2Button asChild size="sm" variant="secondary">
            <Link to={`/arenas/${arena.id}/torneios`}>
              Ver como o atleta vê <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </V2Button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Temporada">
          {r.seasons.map((s) => (
            <Chip key={s} active={season === s} onClick={() => trocaTemporada(s)}>{s}</Chip>
          ))}
          <Chip active={season === HOUSE_ALL} onClick={() => trocaTemporada(HOUSE_ALL)}>Todas</Chip>
        </div>
        {mostraModalidades && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Modalidade">
            {[HOUSE_ALL, ...r.formats].map((f) => (
              <Chip key={f} active={format === f} onClick={() => { setFormat(f); setTodos(false); }}>
                {houseFormatLabel(f)}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {r.isError && !r.fatal && (
        <V2ErrorState
          inline
          title="Parte dos resultados não carregou"
          description={`Ficou de fora: ${r.failures.map((f) => f.label).join(', ')}. O ranking abaixo pode estar incompleto.`}
          onRetry={r.refetch}
        />
      )}

      {r.isLoading ? (
        <V2Skeleton lines={5} />
      ) : r.fatal ? (
        <V2ErrorState
          title="Não foi possível montar o ranking da casa"
          description="A conexão falhou ao buscar os jogos e os torneios da arena. Nenhum resultado foi perdido — tente de novo."
          onRetry={r.refetch}
        />
      ) : (
        <>
          {r.isFetchingDetails && (
            <p className="text-xs text-gray-500" aria-live="polite">
              Somando os resultados… ({r.progress.done} de {r.progress.total})
            </p>
          )}

          {minhaLinha && minhaLinha.position > 3 && (
            <p className="rounded-2xl bg-paper px-3 py-2 text-sm text-ink">
              Você está em <strong>{minhaLinha.position}º</strong> com <strong>{pts(minhaLinha.points)}</strong> em {nomeDaTemporada}.
            </p>
          )}

          {r.rows.length > 0 ? (
            <>
              <Podio rows={r.rows} meuUid={meuUid} />
              {r.rows.length > 3 && (
                <ol className="space-y-1.5" aria-label="Classificação">
                  {visiveis.slice(3).map((linha) => (
                    <Linha key={linha.user_id} r={linha} eu={linha.user_id === meuUid} />
                  ))}
                </ol>
              )}
              {restante > 0 && (
                <V2Button variant="ghost" size="sm" onClick={() => setTodos(true)}>
                  Ver todos ({r.rows.length})
                </V2Button>
              )}
            </>
          ) : r.complete ? (
            <V2EmptyState
              icon={Trophy}
              title={season === HOUSE_ALL ? 'Ninguém pontuou ainda' : `Ninguém pontuou em ${season} ainda`}
              description={audience === 'arena'
                ? 'O ranking nasce do primeiro jogo aberto com placar ou do primeiro torneio da casa que terminar. Não há nada para configurar: ele se monta sozinho.'
                : 'O ranking da casa começa no primeiro jogo aberto com placar. Entre num e comece a somar.'}
              action={audience === 'arena' ? (
                <>
                  <V2Button asChild size="sm">
                    <Link to={`/arenas/${arena.id}/gerir?aba=jogo-aberto`}><Swords className="h-4 w-4" /> Publicar um jogo aberto</Link>
                  </V2Button>
                  <V2Button asChild size="sm" variant="secondary">
                    <Link to={`/torneios/criar?arena=${arena.id}`}><Plus className="h-4 w-4" /> Criar torneio aqui</Link>
                  </V2Button>
                </>
              ) : (
                <V2Button asChild size="sm">
                  <Link to={`/arenas/${arena.id}#arena-jogos-abertos`}><Swords className="h-4 w-4" /> Ver os jogos abertos</Link>
                </V2Button>
              )}
            />
          ) : null}

          <DeOndeVem events={r.events} waiting={r.waiting} summary={r.summary} />
        </>
      )}
    </V2Surface>
  );
}
