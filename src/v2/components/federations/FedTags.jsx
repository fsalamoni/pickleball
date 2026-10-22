/**
 * Os SELOS da federação fora da federação: "Filiado · SIGLA" no clube e na
 * arena (`OrgAffiliationBadges`) e "Chancelado · SIGLA" no torneio
 * (`TournamentSanctionBadge`). Leem o que a regra deixa público: filiação
 * aprovada e o campo `federation_sanction` do torneio. Flag desligada ⇒ nada.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Landmark } from 'lucide-react';
import { useFederationsEnabled, useOrgAffiliations } from '@/modules/federations/hooks/useFederations';
import { sanctionState } from '@/modules/federations/domain/sanction';
import { V2Badge } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';

/** Selo(s) de filiado de um clube (`kind="club"`) ou arena (`kind="arena"`). Só os aprovados. */
export function OrgAffiliationBadges({ kind, orgId, className }) {
  const q = useOrgAffiliations(kind, orgId, { approvedOnly: true });
  if (!q.isSuccess || !q.data?.length) return null;
  return (
    <>
      {q.data.map((a) => (
        <Link key={a.id} to={`/federacoes/${a.federation_id}`} className={className} title={t('Filiado à {nome}', { nome: a.federation_name || a.federation_acronym })}>
          <V2Badge tone="purple"><Landmark className="h-3 w-3" aria-hidden="true" /> {t('Filiado · {sigla}', { sigla: a.federation_acronym || a.federation_name })}</V2Badge>
        </Link>
      ))}
    </>
  );
}

/** O selo de torneio chancelado (só com a chancela APROVADA). */
export function TournamentSanctionBadge({ tournament, link = true }) {
  const ligado = useFederationsEnabled();
  const st = sanctionState(tournament);
  if (!ligado || !st.approved) return null;
  const sigla = st.acronym || st.name;
  // "Realizado pela FGP" (torneio da própria federação) × "Chancelado · FGP" (de um organizador, autorizado); a categoria vem junto.
  const texto = st.byFederation ? t('Realizado pela {sigla}', { sigla }) : t('Chancelado · {sigla}', { sigla });
  const selo = <V2Badge tone="purple"><Landmark className="h-3 w-3" aria-hidden="true" /> {texto}{st.tierShort ? ` · ${st.tierShort}` : ''}{st.requiresMembership ? ` · ${t('só filiados')}` : ''}</V2Badge>;
  if (!link) return selo;
  const titulo = st.byFederation ? t('Realizado pela {nome}', { nome: st.name || st.acronym }) : t('Chancelado pela {nome}', { nome: st.name || st.acronym });
  return <Link to={`/federacoes/${st.federationId}`} title={titulo}>{selo}</Link>;
}
