/**
 * "Torneio da federação" na criação do torneio (`/torneios/criar?federacao=`).
 * Quem é de competições (ou admin) da federação escolhe a categoria e se só
 * filiados se inscrevem; ao criar, o torneio sai já como "Realizado pela
 * {sigla}" (`startFederationTournament`). Sem permissão, federação oculta ou
 * módulo de torneios desligado, a tela DIZ por quê e o torneio é criado como
 * um torneio comum (`ready: false`).
 */
import React, { useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import { useFederation, useFederationsEnabled, useMyFederationRole } from '@/modules/federations/hooks/useFederations';
import { fedModuleOn, isFederationPublic } from '@/modules/federations/domain/federation';
import { tierLabel, tierOptions } from '@/modules/federations/domain/officialRanking';
import { FED_PERMISSION } from '@/modules/federations/domain/constants';
import { V2ErrorState, V2Field, V2Select, V2Skeleton, V2Toggle } from '@/v2/ui/primitives';
import { t } from '@/core/i18n';
import FedTierRequirements from './FedTierRequirements';

/** Por que esta federação não pode realizar o torneio agora (ou `''`). */
function bloqueio(federation, papel) {
  const sigla = federation.acronym || federation.name;
  if (!papel.has(FED_PERMISSION.COMPETITIONS)) return t('Só quem cuida de competições na {sigla} cria torneios em nome dela. O torneio será criado como um torneio comum; a chancela pode ser pedida depois, na página dele.', { sigla });
  if (!isFederationPublic(federation)) return t('A {sigla} ainda não está pública. Torne-a pública em Central → Página pública → Publicação; até lá o torneio será criado como um torneio comum.', { sigla });
  if (!fedModuleOn(federation, 'tournaments')) return t('O módulo de torneios da {sigla} está desligado. Ligue-o em Central → Configurações → Módulos; até lá o torneio será criado como um torneio comum.', { sigla });
  return '';
}

export default function FedTournamentOrigin({ federationId, onChange }) {
  const ligado = useFederationsEnabled();
  const q = useFederation(federationId, { enabled: ligado });
  const papel = useMyFederationRole(ligado ? federationId : null);
  const federation = q.data || null;
  const opcoes = federation ? tierOptions(federation.ranking_config) : [];
  const [tier, setTier] = useState('');
  const [soFiliados, setSoFiliados] = useState(false);
  const escolhida = opcoes.find((o) => o.id === tier) || opcoes[0] || null;
  const motivo = federation && !papel.isLoading ? bloqueio(federation, papel) : '';
  const ready = Boolean(federation && !papel.isLoading && !motivo && escolhida);

  useEffect(() => {
    onChange(ready ? { federation, tier: escolhida.id, requiresMembership: soFiliados } : null);
  }, [ready, federation, escolhida?.id, soFiliados]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ligado) return null;
  if (q.isLoading || papel.isLoading) return <V2Skeleton className="h-24" />;
  if (q.isError || papel.isError) return <V2ErrorState inline title={t('Não deu para carregar a federação')} onRetry={() => { q.refetch(); papel.refetch(); }} />;
  if (!federation) return <p className="rounded-2xl bg-paper p-3 text-sm text-gray-600">{t('Federação não encontrada. O torneio será criado como um torneio comum.')}</p>;

  const sigla = federation.acronym || federation.name;
  return (
    <section className="space-y-3 rounded-2xl border border-purple-100 bg-purple-50 p-4" data-dica="federacao-torneio-origem" aria-label={t('Torneio da federação')}>
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <Landmark className="h-4 w-4" aria-hidden="true" /> {t('Torneio realizado pela {sigla}', { sigla })}
      </p>
      {motivo ? (
        <p className="text-sm text-gray-600" role="status">{motivo}</p>
      ) : (
        <>
          <p className="text-xs text-gray-600">{t('Ao criar, o torneio já sai com o selo "Realizado pela {sigla}" e passa a enviar resultados ao ranking oficial.', { sigla })}</p>
          <V2Field label={t('Categoria do torneio')} htmlFor="fed-tier" hint={t('Os pontos do ranking saem da tabela desta categoria.')}>
            <V2Select id="fed-tier" value={escolhida?.id || ''} onChange={(e) => setTier(e.target.value)} options={opcoes.map((o) => ({ value: o.id, label: tierLabel(o) }))} />
          </V2Field>
          <FedTierRequirements tier={escolhida} />
          <V2Toggle id="fed-filiados" checked={soFiliados} onChange={setSoFiliados} label={t('Só filiados em dia se inscrevem')} hint={t('A inscrição de quem não está em dia nesta federação é recusada.')} />
        </>
      )}
    </section>
  );
}
