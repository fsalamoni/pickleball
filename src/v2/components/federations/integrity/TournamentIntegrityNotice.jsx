/**
 * JOGO LIMPO no torneio chancelado (página do torneio e `/p/:id`): as
 * cláusulas-padrão de antidopagem com os links oficiais e o link para a lista
 * de equipamentos homologados da federação — só com o módulo ligado lá.
 * Federação que não carregou não mostra nada: o aviso é complemento, e o
 * selo de chancela continua no cabeçalho.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useFederation, useFederationsEnabled } from '@/modules/federations/hooks/useFederations';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { sanctionState } from '@/modules/federations/domain/sanction';
import { antidopingView } from '@/modules/federations/domain/integrity';
import { V2Surface } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import { AntidopingClauses, AntidopingLinks } from './IntegrityPublic';

export default function TournamentIntegrityNotice({ tournament, className = '' }) {
  const ligado = useFederationsEnabled();
  const st = sanctionState(tournament);
  const fq = useFederation(st.federationId, { enabled: ligado && st.approved });
  const f = fq.data;
  const equip = fedModuleOn(f, 'equipment');
  const doping = fedModuleOn(f, 'antidoping');
  const v = doping ? antidopingView(f) : null;
  if (!ligado || !st.approved || (!equip && !v?.clauses.length)) return null;
  const sigla = f.acronym || f.name;
  return (
    <V2Surface variant="compacto" className={`space-y-2 p-4 ${className}`} data-dica="torneio-jogo-limpo">
      <p className="flex items-center gap-2 font-semibold text-ink"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{t('Jogo limpo neste torneio')}</p>
      {equip && (
        <p className="text-sm text-gray-700">
          {t('Vale a lista de equipamentos homologados da {sigla}.', { sigla })}{' '}
          <Link to={`/federacoes/${f.id}?aba=jogo-limpo#fed-equipamentos`} className="font-semibold text-ink underline underline-offset-2">{t('Ver a lista')}</Link>
        </p>
      )}
      {v && v.clauses.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-ink">{t('Regras de antidopagem do regulamento')}</summary>
          <div className="mt-2 space-y-2">
            <AntidopingClauses view={v} />
            <AntidopingLinks view={v} />
          </div>
        </details>
      )}
    </V2Surface>
  );
}
