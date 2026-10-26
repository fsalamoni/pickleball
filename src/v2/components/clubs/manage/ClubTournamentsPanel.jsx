/**
 * TORNEIOS DO CLUBE (Central → Torneios; permissão `sports` ou `admin`): os torneios feitos em
 * nome do clube e o caminho para criar mais um. O torneio é o da plataforma — mesmas modalidades,
 * sorteio, inscrições e resultados —, só marcado com `club_id`; a diretoria esportiva o gere pela
 * página dele. Não há chancela nem ranking oficial aqui (isso é da federação). Falha de consulta
 * diz que não carregou — nunca "nenhum torneio".
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Plus, Trophy } from 'lucide-react';
import { useClubTournaments } from '@/modules/clubs/hooks/useClubTournaments';
import { groupClubTournaments } from '@/modules/clubs/domain/clubTournaments';
import { TOURNAMENT_STATUS_LABELS } from '@/modules/tournament/domain/constants';
import { hojeLocal } from '@/modules/home/domain/freshness';
import { dataCurta } from '../../federations/referees/refUi';
import { V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

const TOM = { draft: 'neutral', registrations_open: 'green', registrations_closed: 'amber', in_progress: 'blue', finished: 'neutral', cancelled: 'red' };

const periodo = (x) => (x.ends_at && x.ends_at !== x.starts_at ? `${dataCurta(x.starts_at)} – ${dataCurta(x.ends_at)}` : dataCurta(x.starts_at));

export function TorneioLinha({ tt }) {
  return (
    <li>
      <V2Surface variant="compacto" className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-bold text-ink">
            <Link to={`/torneios/${tt.id}`} className="hover:underline">{tt.name}</Link>
            <V2Badge tone={TOM[tt.status] || 'neutral'}>{t(TOURNAMENT_STATUS_LABELS[tt.status] || tt.status || '')}</V2Badge>
            {tt.visibility && tt.visibility !== 'public' && <V2Badge tone="neutral">{t('Não público')}</V2Badge>}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
            {tt.starts_at && <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" aria-hidden="true" />{periodo(tt)}</span>}
            {(tt.venue || tt.city) && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden="true" />{[tt.venue, tt.city].filter(Boolean).join(' · ')}</span>}
          </p>
        </div>
        <V2Button asChild size="sm" variant="secondary"><Link to={`/torneios/${tt.id}`}>{t('Abrir')}</Link></V2Button>
      </V2Surface>
    </li>
  );
}

export default function ClubTournamentsPanel({ club }) {
  const q = useClubTournaments(club.id);
  const [verEncerrados, setVerEncerrados] = useState(false);
  const criar = (
    <V2Button asChild data-dica="clube-torneio-criar"><Link to={`/torneios/criar?clube=${club.id}`}><Plus className="h-4 w-4" />{t('Criar torneio do clube')}</Link></V2Button>
  );

  if (q.isLoading) return <V2Skeleton lines={3} />;
  // Sem a lista na mão, não se oferece "criar": a pessoa poderia duplicar o que já existe.
  if (q.isError) return <V2ErrorState title={t('Não carregaram os torneios do clube')} onRetry={() => q.refetch()} />;

  const { atuais, encerrados, rascunhos } = groupClubTournaments(q.data, hojeLocal());
  const total = atuais.length + encerrados.length + rascunhos.length;

  return (
    <div className="space-y-5" data-dica="clube-torneios-painel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-gray-600">{t('Os torneios do clube são torneios da plataforma — modalidades, sorteio, inscrições e resultados — que saem com o nome do clube na página e na lista. Quem organiza gere tudo pela página do torneio.')}</p>
        {total > 0 && criar}
      </div>

      {total === 0 ? (
        <V2EmptyState icon={Trophy} title={t('Nenhum torneio do clube ainda')} description={t('Crie o primeiro: ele já sai com o selo "Realizado pelo clube" e entra na página pública.')} action={criar} />
      ) : (
        <>
          {atuais.length > 0 && (
            <section aria-labelledby="clube-torneios-atuais" className="space-y-2">
              <h3 id="clube-torneios-atuais" className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('Em andamento e por vir')} ({atuais.length})</h3>
              <ul className="space-y-2">{atuais.map((tt) => <TorneioLinha key={tt.id} tt={tt} />)}</ul>
            </section>
          )}
          {rascunhos.length > 0 && (
            <section aria-labelledby="clube-torneios-rascunhos" className="space-y-2">
              <h3 id="clube-torneios-rascunhos" className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('Rascunhos')} ({rascunhos.length})</h3>
              <ul className="space-y-2">{rascunhos.map((tt) => <TorneioLinha key={tt.id} tt={tt} />)}</ul>
            </section>
          )}
          {encerrados.length > 0 && (
            <section aria-labelledby="clube-torneios-encerrados" className="space-y-2">
              <h3 id="clube-torneios-encerrados" className="text-xs font-bold uppercase tracking-wider text-gray-500">{t('Encerrados')} ({encerrados.length})</h3>
              {verEncerrados
                ? <ul className="space-y-2">{encerrados.map((tt) => <TorneioLinha key={tt.id} tt={tt} />)}</ul>
                : <V2Button type="button" size="sm" variant="secondary" onClick={() => setVerEncerrados(true)}>{t('Mostrar os encerrados')}</V2Button>}
            </section>
          )}
        </>
      )}
    </div>
  );
}
