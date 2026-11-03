import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Search, AlertTriangle, ChevronRight } from 'lucide-react';

import {
  V2Surface, V2Badge, V2Button, V2Skeleton, V2ErrorState, V2EmptyState, V2FilterChip, V2SearchInput, V2Select,
} from '@/v2/ui/primitives';
import { useAllGameDaysForAdmin } from '@/modules/games/hooks/useGameDays';
import {
  adminGameDayRows, adminGameDayOrigin, adminGameDayStart, adminGameDayMissingTime,
  ADMIN_GAME_DAY_FILTER, ADMIN_GAME_DAY_ORIGIN,
} from '@/modules/games/domain/adminGameDays';
import { formatDateShortBR, todayISO } from '@/modules/arenas/domain/calendar';
import { t, tk, tn } from '@/core/i18n';

const FILTROS = [
  { id: ADMIN_GAME_DAY_FILTER.UPCOMING, label: tk('Próximos') },
  { id: ADMIN_GAME_DAY_FILTER.ALL, label: tk('Todos') },
  { id: ADMIN_GAME_DAY_FILTER.PAST, label: tk('Passados') },
  { id: ADMIN_GAME_DAY_FILTER.MISSING_TIME, label: tk('Sem data ou horário') },
  { id: ADMIN_GAME_DAY_FILTER.ARCHIVED, label: tk('Arquivados') },
];

const ORIGEM_LABEL = {
  [ADMIN_GAME_DAY_ORIGIN.ATHLETE]: tk('Atleta'),
  [ADMIN_GAME_DAY_ORIGIN.ARENA]: tk('Arena'),
  [ADMIN_GAME_DAY_ORIGIN.CLUB]: tk('Clube'),
};

const POR_VEZ = 50;

/**
 * Torneios → Dias de jogo: o administrador da plataforma acha o dia de jogo de
 * qualquer pessoa e abre para ajustar (ele configura e conduz qualquer dia —
 * `canConfigureGameDay` com `platformAdmin`). Cada mudança fica na auditoria
 * com o nome dele.
 */
export default function AdminGameDaysTab() {
  const { data: dias = [], isLoading, isError, refetch } = useAllGameDaysForAdmin();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState(ADMIN_GAME_DAY_FILTER.UPCOMING);
  const [origem, setOrigem] = useState('');
  const [mostrar, setMostrar] = useState(POR_VEZ);

  const linhas = useMemo(
    () => adminGameDayRows(dias, { busca, filtro, origem: origem || null, hoje: todayISO() }),
    [dias, busca, filtro, origem],
  );

  if (isLoading) return <V2Skeleton lines={6} />;
  if (isError) {
    return (
      <V2Surface>
        <V2ErrorState
          title={t('Não foi possível carregar os dias de jogo')}
          description={t('Eles continuam como estão — só não conseguimos listá-los agora.')}
          onRetry={() => refetch()}
        />
      </V2Surface>
    );
  }

  return (
    <V2Surface className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">{t('Dias de jogo')}</h2>
        <p className="mt-1 text-sm text-gray-500">
          {t('Abra o dia de jogo de qualquer pessoa para ajustar formato, quadras, quem organiza, data, horário e local. Cada mudança fica registrada na auditoria com o seu nome.')}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <V2SearchInput
          icon={Search}
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setMostrar(POR_VEZ); }}
          placeholder={t('Nome, criador, arena, clube, cidade ou código')}
          aria-label={t('Buscar dia de jogo')}
        />
        <V2Select
          aria-label={t('Origem')}
          value={origem}
          onChange={(e) => { setOrigem(e.target.value); setMostrar(POR_VEZ); }}
        >
          <option value="">{t('Todas as origens')}</option>
          {Object.values(ADMIN_GAME_DAY_ORIGIN).map((o) => (
            <option key={o} value={o}>{t(ORIGEM_LABEL[o])}</option>
          ))}
        </V2Select>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <V2FilterChip
            key={f.id}
            active={filtro === f.id}
            onClick={() => { setFiltro(f.id); setMostrar(POR_VEZ); }}
          >
            {t(f.label)}
          </V2FilterChip>
        ))}
      </div>

      {linhas.length === 0 ? (
        <V2EmptyState
          icon={CalendarClock}
          title={t('Nenhum dia de jogo neste recorte')}
          description={t('Troque o filtro ou a busca.')}
        />
      ) : (
        <>
          <p className="text-xs text-gray-500">{tn(linhas.length, '{n} dia de jogo', '{n} dias de jogo')}</p>
          <ul className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
            {linhas.slice(0, mostrar).map((gd) => {
              const inicio = adminGameDayStart(gd);
              const falta = adminGameDayMissingTime(gd);
              const dona = gd.arena_name || gd.club_name || gd.creator_name || t('Atleta');
              return (
                <li key={gd.id}>
                  <Link
                    to={`/dia-de-jogo/${gd.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-paper"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{gd.title || t('Dia de jogo')}</p>
                      <p className="truncate text-xs text-gray-500">
                        {[
                          gd.date ? formatDateShortBR(gd.date) : null,
                          inicio,
                          dona,
                          gd.city,
                        ].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {falta && (
                      <V2Badge tone="amber" className="shrink-0">
                        <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
                        {gd.date ? t('Sem horário') : t('Sem data')}
                      </V2Badge>
                    )}
                    <V2Badge tone="neutral" className="shrink-0">{t(ORIGEM_LABEL[adminGameDayOrigin(gd)])}</V2Badge>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
          {linhas.length > mostrar && (
            <V2Button variant="ghost" onClick={() => setMostrar((n) => n + POR_VEZ)}>
              {t('Mostrar mais')}
            </V2Button>
          )}
        </>
      )}
    </V2Surface>
  );
}
