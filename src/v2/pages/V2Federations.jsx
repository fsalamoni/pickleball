/**
 * V2Federations — o diretório de federações (`/federacoes`, flag `federations`).
 *
 * As federações APROVADAS, na região da pessoa (a mesma régua de Arenas:
 * `useRegionalList`), com busca pelo nome ou sigla (que ignora a região).
 * Acima da lista, as da pessoa: onde é filiada e onde faz parte da equipe.
 * "Abrir uma federação" leva ao pedido, que o admin da plataforma analisa.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Landmark, Plus, Search, ShieldCheck, Users } from 'lucide-react';
import { useMyFederationRoles, useMyMemberships, usePublicFederations } from '@/modules/federations/hooks/useFederations';
import { membershipState } from '@/modules/federations/domain/membership';
import { staffRoleName } from '@/modules/federations/domain/staff';
import { useRegionalList } from '@/core/lib/useMyRegion';
import RegionBar, { RegionEmptyHint } from '@/v2/components/region/RegionBar';
import { V2Button, V2EmptyState, V2ErrorState, V2Page, V2PageIntro, V2SearchInput, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { FedBadges, FedLogo, FederationGate, MemberStatusBadge, fedManagePath, fedPath, quando } from '@/v2/components/federations/federationUi';
import { t, tn } from '@/core/i18n';

const normaliza = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function FederationRow({ federation: f, extra }) {
  return (
    <li>
      <V2Surface as={Link} to={fedPath(f)} variant="compacto" className="flex items-start gap-4 p-4 transition-colors hover:border-gray-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30">
        <FedLogo federation={f} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg font-bold text-ink">{f.name}</p>
          <p className="text-sm text-gray-500">{[f.acronym, f.city, f.state].filter(Boolean).join(' · ')}</p>
          <FedBadges federation={f} className="mt-2" />
          {f.about && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{f.about}</p>}
          {extra}
        </div>
        <span className="hidden shrink-0 items-center gap-1 text-sm text-gray-500 sm:flex"><Users className="h-4 w-4" aria-hidden="true" />{tn(f.member_count || 0, '{n} filiado', '{n} filiados')}</span>
      </V2Surface>
    </li>
  );
}

/** As federações da pessoa: filiações (com o estado) e as da equipe. */
function MinhasFederacoes({ federacoes }) {
  const membros = useMyMemberships();
  const papeis = useMyFederationRoles();
  const porId = useMemo(() => new Map((federacoes || []).map((f) => [f.id, f])), [federacoes]);
  if (membros.isError || papeis.isError) {
    return <V2ErrorState inline title={t('Não carregaram as suas federações')} onRetry={() => { if (membros.isError) membros.refetch(); if (papeis.isError) papeis.refetch(); }} />;
  }
  if (!membros.isSuccess || !papeis.isSuccess) return <V2Skeleton lines={2} />;
  const itens = [];
  (papeis.data || []).forEach((s) => itens.push({ id: `equipe:${s.federation_id}`, fedId: s.federation_id, equipe: s }));
  (membros.data || []).forEach((m) => {
    const st = membershipState(m);
    if (!st.status || ['cancelled', 'rejected'].includes(st.status)) return;
    itens.push({ id: `filiacao:${m.federation_id}`, fedId: m.federation_id, filiacao: m, estado: st });
  });
  if (!itens.length) return null;
  return (
    <section aria-labelledby="minhas-federacoes" className="space-y-3" data-dica="federacoes-minhas">
      <h2 id="minhas-federacoes" className="font-display text-xl font-bold text-ink">{t('Suas federações')}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {itens.map((i) => {
          const f = porId.get(i.fedId) || { id: i.fedId, name: i.filiacao?.federation_name || i.equipe?.federation_name || t('Federação'), acronym: '' };
          return (
            <li key={i.id}>
              <V2Surface variant="compacto" className="flex items-center gap-3 p-4">
                <FedLogo federation={f} />
                <div className="min-w-0 flex-1">
                  <Link to={fedPath(f)} className="truncate font-bold text-ink hover:underline">{f.name}</Link>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {i.equipe && <span className="inline-flex items-center gap-1 font-semibold text-ink"><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />{staffRoleName(i.equipe)}</span>}
                    {i.estado && <MemberStatusBadge status={i.estado.status} label={i.estado.label} />}
                    {i.estado?.validUntil && <span>{t('até {data}', { data: quando(i.estado.validUntil) })}</span>}
                  </div>
                </div>
                {i.equipe ? (
                  <V2Button asChild size="sm" variant="secondary"><Link to={fedManagePath(f)}>{t('Gerir')}</Link></V2Button>
                ) : (
                  <V2Button asChild size="sm" variant="ghost"><Link to="/perfil?secao=federacoes">{t('Carteirinha')}</Link></V2Button>
                )}
              </V2Surface>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Diretorio() {
  const q = usePublicFederations();
  const [busca, setBusca] = useState('');
  const termo = normaliza(busca.trim());
  const filtradas = useMemo(() => (q.data || []).filter((f) => !termo || normaliza(`${f.name} ${f.acronym} ${f.city} ${f.state}`).includes(termo)), [q.data, termo]);
  const regional = useRegionalList(filtradas, (f) => ({ city: f.city, state: f.state }), { ignorar: Boolean(termo) });

  return (
    <V2Page className="space-y-8">
      <V2PageIntro
        title={t('Federações')}
        subtitle={t('Filie-se à federação da sua região: carteirinha digital, torneios chancelados e ranking oficial.')}
        action={<V2Button asChild variant="secondary" data-dica="federacoes-abrir"><Link to="/federacoes/abrir"><Plus className="h-4 w-4" />{t('Abrir uma federação')}</Link></V2Button>}
      />

      <MinhasFederacoes federacoes={q.data} />

      <section aria-labelledby="diretorio-federacoes" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="diretorio-federacoes" className="font-display text-xl font-bold text-ink">{t('Todas as federações')}</h2>
          <V2SearchInput value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={t('Nome, sigla ou cidade')} aria-label={t('Buscar federação')} className="sm:w-80" data-dica="federacoes-busca" />
        </div>
        <RegionBar regional={regional} nomeItens={['federação', 'federações']} />
        {q.isError ? (
          <V2ErrorState title={t('Não carregaram as federações')} description={t('As federações continuam lá. Confira a conexão e tente de novo.')} onRetry={() => q.refetch()} />
        ) : q.isLoading ? (
          <V2Skeleton lines={6} />
        ) : regional.itens.length === 0 ? (
          <V2EmptyState
            icon={termo ? Search : Landmark}
            title={termo ? t('Nenhuma federação com "{termo}"', { termo: busca.trim() }) : t('Nenhuma federação por aqui ainda')}
            description={termo ? t('Tente pela sigla ou pela cidade.') : t('Quem organiza o pickleball na sua região pode abrir a federação aqui: a equipe do PickleRush analisa e aprova.')}
            action={!termo && <V2Button asChild><Link to="/federacoes/abrir"><Plus className="h-4 w-4" />{t('Abrir uma federação')}</Link></V2Button>}
          />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {regional.itens.map((f) => <FederationRow key={f.id} federation={f} />)}
          </ul>
        )}
        {!q.isError && !q.isLoading && regional.itens.length === 0 && !termo && <RegionEmptyHint regional={regional} oque={t('Nenhuma federação')} />}
      </section>
    </V2Page>
  );
}

export default function V2Federations() {
  return <FederationGate><Diretorio /></FederationGate>;
}
