/**
 * Os TORNEIOS DO CLUBE na página pública (Bloco E3b): os públicos que estão rolando ou por vir
 * (o que já passou fica atrás de um botão). Sem nenhum torneio a seção não existe; falha de
 * consulta diz que não carregou, nunca "sem torneios".
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Trophy } from 'lucide-react';
import { useClubTournaments } from '@/modules/clubs/hooks/useClubTournaments';
import { groupClubTournaments } from '@/modules/clubs/domain/clubTournaments';
import { TOURNAMENT_STATUS_LABELS } from '@/modules/tournament/domain/constants';
import { hojeLocal } from '@/modules/home/domain/freshness';
import { dataCurta } from '@/v2/components/federations/referees/refUi';
import { V2Badge, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

const periodo = (x) => (x.ends_at && x.ends_at !== x.starts_at ? `${dataCurta(x.starts_at)} – ${dataCurta(x.ends_at)}` : dataCurta(x.starts_at));

function Cartao({ tt }) {
  return (
    <li>
      <Link to={`/torneios/${tt.id}`} className="block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
        <V2Surface variant="compacto" className="space-y-1 p-4 transition-shadow hover:shadow-md">
          <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{tt.name}<V2Badge tone="green">{t(TOURNAMENT_STATUS_LABELS[tt.status] || tt.status || '')}</V2Badge></p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
            {tt.starts_at && <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" aria-hidden="true" />{periodo(tt)}</span>}
            {(tt.venue || tt.city) && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden="true" />{[tt.venue, tt.city].filter(Boolean).join(' · ')}</span>}
          </p>
        </V2Surface>
      </Link>
    </li>
  );
}

export default function ClubTournamentsPublic({ clubId }) {
  const q = useClubTournaments(clubId);
  const [verEncerrados, setVerEncerrados] = useState(false);
  if (q.isLoading) return <V2Skeleton lines={2} />;
  if (q.isError) return <section id="clube-torneios" className="scroll-mt-4"><V2ErrorState inline title={t('Os torneios do clube não carregaram')} onRetry={() => q.refetch()} /></section>;
  const { atuais, encerrados } = groupClubTournaments(q.data, hojeLocal(), { somentePublicos: true });
  if (!atuais.length && !encerrados.length) return null;
  return (
    <section id="clube-torneios" aria-labelledby="clube-torneios-titulo" className="scroll-mt-4 space-y-3" data-dica="clube-torneios-publicos">
      <h2 id="clube-torneios-titulo" className="flex items-center gap-2 font-display text-xl font-bold text-ink"><Trophy className="h-5 w-5" aria-hidden="true" />{t('Torneios do clube')}</h2>
      {atuais.length > 0 && <ul className="space-y-3">{atuais.slice(0, 6).map((tt) => <Cartao key={tt.id} tt={tt} />)}</ul>}
      {encerrados.length > 0 && (
        verEncerrados
          ? <ul className="space-y-3">{encerrados.slice(0, 12).map((tt) => <Cartao key={tt.id} tt={tt} />)}</ul>
          : <button type="button" className="text-sm font-semibold text-ink underline underline-offset-4" onClick={() => setVerEncerrados(true)}>{t('Ver os torneios encerrados ({n})', { n: encerrados.length })}</button>
      )}
    </section>
  );
}
