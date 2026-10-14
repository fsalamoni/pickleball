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
import { t, tn, tk } from '@/core/i18n';

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
  return tn(n, '{n} ponto', '{n} pontos');
}

function metaDaLinha(r) {
  const partes = [tn(r.events, '{n} evento', '{n} eventos')];
  if (r.wins > 0) partes.push(tn(r.wins, '{n} vitória', '{n} vitórias'));
  if (r.titles > 0) partes.push(tn(r.titles, '{n} título', '{n} títulos'));
  return partes.join(' · ');
}

const PODIO = [
  { tom: 'bg-acid text-ink', icone: Crown, rotulo: tk('Líder') },
  { tom: 'bg-ink text-white', icone: Medal, rotulo: '2º' },
  { tom: 'bg-paper text-ink', icone: Medal, rotulo: '3º' },
];

function Podio({ rows, meuUid }) {
  if (rows.length === 0) return null;
  return (
    <ol className="grid gap-2 sm:grid-cols-3" aria-label={t('Pódio da temporada')}>
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
                {r.user_id === meuUid && <span className="shrink-0 text-2xs font-black uppercase">· {t('você')}</span>}
              </p>
              <p className="text-xs opacity-80">{metaDaLinha(r)}</p>
            </div>
            <p className="shrink-0 text-right font-display text-xl font-black leading-none">
              {r.points}
              <span className="block text-2xs font-bold uppercase tracking-wider opacity-70">{t('pts')}</span>
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
          {eu && <V2Badge tone="acid" className="shrink-0 px-2 py-0 text-2xs">{t('você')}</V2Badge>}
        </p>
        <p className="text-xs text-gray-500">{metaDaLinha(r)}</p>
      </div>
      <p className="shrink-0 font-display text-base font-black text-ink">{r.points}</p>
    </li>
  );
}

function TabelaDePontos() {
  const tabela = houseRankingPointsTable();
  const Coluna = ({ titulo, linhas }) => (
    <div className="rounded-2xl bg-paper p-3">
      <p className="text-xs font-bold text-ink">{titulo}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {linhas.map((l) => (
          <li key={l.label} className="rounded-full bg-paper-pure px-2.5 py-0.5 text-xs text-ink">
            <strong>{t(l.label)}</strong> {l.points}
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Coluna titulo={t('Jogo aberto e dia de jogo com placar')} linhas={tabela.gameDay} />
      <Coluna titulo={t('Torneio da casa, por categoria (vale {peso}×)', { peso: HOUSE_TOURNAMENT_WEIGHT })} linhas={tabela.tournament} />
    </div>
  );
}

function resumoDasFontes(s) {
  const partes = [];
  if (s.gameDays > 0) {
    partes.push(s.openMatches === s.gameDays
      ? tn(s.gameDays, '{n} jogo aberto', '{n} jogos abertos')
      : `${tn(s.gameDays, '{n} dia de jogo', '{n} dias de jogo')} (${tn(s.openMatches, '{n} jogo aberto', '{n} jogos abertos')})`);
  }
  if (s.tournaments > 0) {
    partes.push(`${tn(s.tournaments, '{n} torneio', '{n} torneios')} (${tn(s.categories, '{n} categoria', '{n} categorias')})`);
  }
  if (s.legacy) partes.push(t('os torneios internos antigos'));
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
          <Info className="h-4 w-4 shrink-0" /> {t('De onde vêm os pontos')}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-500 transition-transform', aberto && 'rotate-180')} />
      </button>
      {aberto && (
        <div className="space-y-4 border-t border-gray-100 px-4 py-4">
          <p className="text-sm text-gray-600">
            {texto ? t('Nesta temporada entraram {texto}.', { texto }) : t('Nesta temporada ainda não entrou nenhum resultado.')}
            {' '}{t('Cada evento dá pontos pela colocação; quem jogou e não ficou entre os quatro leva os pontos de presença.')}
            {' '}{t('Empate em pontos: vale quem tem mais títulos, depois mais vitórias, depois quem somou em menos eventos.')}
          </p>
          <TabelaDePontos />

          {ordenados.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('O que entrou')}</p>
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
                      {[e.date ? formatDateShortBR(e.date) : '', e.kind === HOUSE_EVENT_KIND.LEGACY ? t('pontos acumulados') : t(e.formatLabel || '')]
                        .filter(Boolean).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {waiting.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('Ainda não entrou')}</p>
              <ul className="mt-2 space-y-1.5">
                {waiting.map((w) => (
                  <li key={w.key} className="text-sm">
                    <Link to={w.link} className="font-bold text-ink hover:underline">{w.title}</Link>
                    {w.date ? <span className="text-xs text-gray-500"> · {formatDateShortBR(w.date)}</span> : null}
                    <span className="block text-xs text-gray-500">{t(w.reason || '')}</span>
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
  const nomeDaTemporada = season === HOUSE_ALL ? t('todas as temporadas') : t('a temporada {ano}', { ano: season });
  // Filtro de modalidade só aparece quando há mais de uma para escolher.
  const mostraModalidades = r.formats.length > 1;

  const trocaTemporada = (s) => { setSeason(s); setFormat(HOUSE_ALL); setTodos(false); };

  return (
    <V2Surface className={cn('space-y-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
            <Trophy className="h-5 w-5 shrink-0" /> {t('Ranking da casa')}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {t('Soma os jogos abertos e os dias de jogo com placar e os torneios da casa. Atualiza sozinho a cada resultado.')}
          </p>
        </div>
        {audience === 'arena' && (
          <V2Button asChild size="sm" variant="secondary">
            <Link to={`/arenas/${arena.id}/torneios`}>
              {t('Ver como o atleta vê')} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </V2Button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('Temporada')}>
          {r.seasons.map((s) => (
            <Chip key={s} active={season === s} onClick={() => trocaTemporada(s)}>{s}</Chip>
          ))}
          <Chip active={season === HOUSE_ALL} onClick={() => trocaTemporada(HOUSE_ALL)}>{t('Todas')}</Chip>
        </div>
        {mostraModalidades && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('Modalidade')}>
            {[HOUSE_ALL, ...r.formats].map((f) => (
              <Chip key={f} active={format === f} onClick={() => { setFormat(f); setTodos(false); }}>
                {t(houseFormatLabel(f))}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {r.isError && !r.fatal && (
        <V2ErrorState
          inline
          title={t('Parte dos resultados não carregou')}
          description={t('Ficou de fora: {itens}. O ranking abaixo pode estar incompleto.', { itens: r.failures.map((f) => t(f.label)).join(', ') })}
          onRetry={r.refetch}
        />
      )}

      {r.isLoading ? (
        <V2Skeleton lines={5} />
      ) : r.fatal ? (
        <V2ErrorState
          title={t('Não foi possível montar o ranking da casa')}
          description={t('A conexão falhou ao buscar os jogos e os torneios da arena. Nenhum resultado foi perdido — tente de novo.')}
          onRetry={r.refetch}
        />
      ) : (
        <>
          {r.isFetchingDetails && (
            <p className="text-xs text-gray-500" aria-live="polite">
              {t('Somando os resultados… ({feito} de {total})', { feito: r.progress.done, total: r.progress.total })}
            </p>
          )}

          {minhaLinha && minhaLinha.position > 3 && (
            <p className="rounded-2xl bg-paper px-3 py-2 text-sm text-ink">
              {t('Você está em {posicao}º com {pontos} em {temporada}.', { posicao: minhaLinha.position, pontos: pts(minhaLinha.points), temporada: nomeDaTemporada })}
            </p>
          )}

          {r.rows.length > 0 ? (
            <>
              <Podio rows={r.rows} meuUid={meuUid} />
              {r.rows.length > 3 && (
                <ol className="space-y-1.5" aria-label={t('Classificação')}>
                  {visiveis.slice(3).map((linha) => (
                    <Linha key={linha.user_id} r={linha} eu={linha.user_id === meuUid} />
                  ))}
                </ol>
              )}
              {restante > 0 && (
                <V2Button variant="ghost" size="sm" onClick={() => setTodos(true)}>
                  {t('Ver todos ({n})', { n: r.rows.length })}
                </V2Button>
              )}
            </>
          ) : r.complete ? (
            <V2EmptyState
              icon={Trophy}
              title={season === HOUSE_ALL ? t('Ninguém pontuou ainda') : t('Ninguém pontuou em {ano} ainda', { ano: season })}
              description={audience === 'arena'
                ? t('O ranking nasce do primeiro jogo aberto com placar ou do primeiro torneio da casa que terminar. Não há nada para configurar: ele se monta sozinho.')
                : t('O ranking da casa começa no primeiro jogo aberto com placar. Entre num e comece a somar.')}
              action={audience === 'arena' ? (
                <>
                  <V2Button asChild size="sm">
                    <Link to={`/arenas/${arena.id}/gerir?aba=jogo-aberto`}><Swords className="h-4 w-4" /> {t('Publicar um jogo aberto')}</Link>
                  </V2Button>
                  <V2Button asChild size="sm" variant="secondary">
                    <Link to={`/torneios/criar?arena=${arena.id}`}><Plus className="h-4 w-4" /> {t('Criar torneio aqui')}</Link>
                  </V2Button>
                </>
              ) : (
                <V2Button asChild size="sm">
                  <Link to={`/arenas/${arena.id}#arena-jogos-abertos`}><Swords className="h-4 w-4" /> {t('Ver os jogos abertos')}</Link>
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
