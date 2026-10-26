/**
 * LinkedGameDaysSection — os dias de jogo do ATLETA vinculados a este clube ou
 * arena (`domain/gameDayLink.js`). As estatísticas deles são daqui.
 *
 * Um componente só para a página do clube e a da arena. Sem nenhum dia, a seção
 * não existe (uma seção vazia só sugere que falta algo); consulta que FALHOU
 * não é "nenhum dia": a seção diz que não carregou e oferece tentar de novo.
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Link2 } from 'lucide-react';
import { V2ErrorState, V2Surface } from '@/v2/ui/primitives';
import { useArenaLinkedGameDays, useClubLinkedGameDays } from '@/modules/games/hooks/useGameDayLink';
import { gameDayEndsAt } from '@/modules/games/domain/playDiscovery';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { t } from '@/core/i18n';

const PROXIMOS = 6;
const RECENTES = 4;

/** @param {{ clubId?: string|null, arenaId?: string|null, className?: string }} props */
export default function LinkedGameDaysSection({ clubId = null, arenaId = null, className = 'mt-6' }) {
  const doClube = useClubLinkedGameDays(clubId);
  const daArena = useArenaLinkedGameDays(arenaId);
  const q = clubId ? doClube : daArena;
  const agora = Date.now();

  const { proximos, recentes } = useMemo(() => {
    const dias = q.data || [];
    const ativos = dias.filter((g) => g.date && gameDayEndsAt(g) > agora);
    const passados = dias.filter((g) => g.date && !(gameDayEndsAt(g) > agora));
    return {
      proximos: ativos.sort((a, b) => String(a.date).localeCompare(String(b.date))).slice(0, PROXIMOS),
      recentes: passados.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, RECENTES),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `agora` muda a cada render; os dados é que contam
  }, [q.data]);

  if (q.isError) {
    return (
      <V2Surface className={className}>
        <V2ErrorState inline title={t('Não deu para carregar os dias de jogo vinculados.')} onRetry={() => q.refetch()} />
      </V2Surface>
    );
  }
  if (!q.isSuccess || (proximos.length === 0 && recentes.length === 0)) return null;

  const linha = (g) => (
    <li key={g.id}>
      <Link
        to={`/dia-de-jogo/${g.id}`}
        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 hover:bg-paper"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">{g.title || t('Dia de jogo')}</span>
          <span className="block text-xs text-gray-500">
            {[formatDateShortBR(g.date), g.time, g.creator_name && t('organizado por {nome}', { nome: g.creator_name })]
              .filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className="text-xs font-semibold text-gray-500">{t('Abrir')}</span>
      </Link>
    </li>
  );

  return (
    <V2Surface className={className}>
      <div className="mb-3 flex items-start gap-3">
        <Link2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-acid-dark" />
        <div>
          <h2 className="font-display text-xl font-bold text-ink">{t('Dias de jogo vinculados')}</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {t('Dias organizados por atletas cujas estatísticas contam aqui. Quem é de fora joga como convidado.')}
          </p>
        </div>
      </div>
      {proximos.length > 0 && <ul className="space-y-2">{proximos.map(linha)}</ul>}
      {recentes.length > 0 && (
        <>
          <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Recentes')}</h3>
          <ul className="space-y-2">{recentes.map(linha)}</ul>
        </>
      )}
    </V2Surface>
  );
}
