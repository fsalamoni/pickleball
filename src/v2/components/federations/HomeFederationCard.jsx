/**
 * Card "Federação" do início (flag `federations`, escolhido pela pessoa): as
 * filiações dela — a que pede pagamento ou renovação primeiro — e a última
 * notícia da federação. Sem filiação, a porta para o diretório.
 *
 * Falha ≠ vazio: com as filiações falhando o card não diz "não é filiado".
 */
import React from 'react';
import { IdCard, Landmark, Newspaper } from 'lucide-react';
import { useMyMemberships, useMemberNews, usePublicNews } from '@/modules/federations/hooks/useFederations';
import { homeFederationRows } from '@/modules/federations/domain/membership';
import { MEMBER_STATUS } from '@/modules/federations/domain/constants';
import { visibleNews } from '@/modules/federations/domain/news';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { fmtData, t, tk } from '@/core/i18n';
import { instanteDoDiaEmMs } from '@/core/domain/instant';
import { HomeAction, HomeEmpty, HomeRow, HomeSection } from '@/v2/components/home/personal/HomeSection';

const ACAO = { to: '/federacoes', label: tk('Ver as federações') };

function UltimaNoticia({ fedId, filiado }) {
  const publicas = usePublicNews(fedId);
  const internas = useMemberNews(fedId, { enabled: filiado });
  const lista = visibleNews([...(publicas.data || []), ...(filiado ? internas.data || [] : [])], { memberOf: filiado });
  const n = lista[0];
  if (!n) return null;
  return (
    <HomeRow
      to={`/federacoes/${fedId}?noticia=${n.id}#federacao-noticias`}
      icon={Newspaper}
      title={n.title}
      subtitle={t('Notícia da federação')}
    />
  );
}

export default function HomeFederationCard() {
  const q = useMyMemberships();
  const moldura = (conteudo) => (
    <HomeSection id="federacao" icon={Landmark} title={t('Federação')} action={{ ...ACAO, label: t(ACAO.label) }}>{conteudo}</HomeSection>
  );
  if (q.isLoading) return moldura(<V2Skeleton lines={3} />);
  if (q.isError) return moldura(<V2ErrorState inline title={t('As suas filiações não carregaram')} onRetry={() => q.refetch()} />);
  const rows = homeFederationRows(q.data);
  if (!rows.length) {
    return moldura(
      <HomeEmpty icon={Landmark} actions={<HomeAction to="/federacoes" primary>{t('Encontrar a minha federação')}</HomeAction>}>
        {t('Filiado, você tem carteirinha digital, torneios chancelados e ranking oficial.')}
      </HomeEmpty>,
    );
  }
  const primeira = rows[0].member;
  return moldura(
    <div className="space-y-1">
      {rows.slice(0, 3).map(({ member, estado, acao }) => (
        <HomeRow
          key={member.id}
          to={`/federacoes/${member.federation_id}`}
          icon={IdCard}
          title={[member.federation_acronym || member.federation_name, member.user_id ? null : member.user_name].filter(Boolean).join(' · ')}
          subtitle={estado.validUntil ? t('{estado} · até {data}', { estado: estado.label, data: fmtData(new Date(instanteDoDiaEmMs(estado.validUntil)), { day: '2-digit', month: '2-digit', year: 'numeric' }) }) : estado.label}
          badge={acao === 'pagar' ? t('Pagar') : acao === 'renovar' ? t('Renovar') : undefined}
          badgeTone="amber"
          highlight={Boolean(acao)}
        />
      ))}
      <UltimaNoticia fedId={primeira.federation_id} filiado={homeFederationRows([primeira])[0]?.estado.status === MEMBER_STATUS.ACTIVE} />
    </div>,
  );
}
