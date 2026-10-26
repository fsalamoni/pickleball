/**
 * Card "Associação do clube" do início (flag `club_association`, escolhido pela pessoa): as
 * filiações dela nos clubes — a que pede resposta, pagamento ou renovação primeiro. Sem clube,
 * a porta para a lista de clubes.
 *
 * Falha ≠ vazio: com as associações falhando o card não diz "você não é associado".
 */
import React from 'react';
import { IdCard, Users } from 'lucide-react';
import { useMyClubs } from '@/modules/clubs/hooks/useClubs';
import { useMyClubAssociations } from '@/modules/clubs/hooks/useClubAssociation';
import { clubSummary } from '@/modules/clubs/domain/memberPending';
import { dataCurta } from '@/modules/clubs/domain/association';
import { V2ErrorState, V2Skeleton } from '@/v2/ui/primitives';
import { t, tk } from '@/core/i18n';
import { HomeAction, HomeEmpty, HomeRow, HomeSection } from '@/v2/components/home/personal/HomeSection';

const ACAO = { to: '/clubes', label: tk('Ver os clubes') };

/** O que mais pede a pessoa, na ordem do que tem prazo: votar, responder, pagar, renovar. */
function avisoDe(r) {
  if (r.eleicoes) return { badge: t('Votar'), tone: 'acid', urgente: true };
  if (r.convocacoes) return { badge: t('Responder'), tone: 'acid', urgente: true };
  if (r.pagar) return { badge: t('Pagar'), tone: 'amber', urgente: true };
  if (r.vencida) return { badge: t('Renovar'), tone: 'amber', urgente: true };
  if (r.vencendo) return { badge: t('Vence em breve'), tone: 'amber', urgente: true };
  if (r.sancoes) return { badge: t('Sanção'), tone: 'amber', urgente: true };
  return { badge: r.label, tone: r.state === 'active' ? 'green' : 'neutral', urgente: false };
}

export default function HomeClubAssociationCard() {
  const clubsQ = useMyClubs();
  const temClubes = (clubsQ.data || []).length > 0;
  const q = useMyClubAssociations({ enabled: clubsQ.isSuccess && temClubes });
  const moldura = (conteudo) => (
    <HomeSection id="associacao-clube" icon={IdCard} title={t('Associação do clube')} action={{ ...ACAO, label: t(ACAO.label) }}>{conteudo}</HomeSection>
  );
  const vazio = (texto) => moldura(
    <HomeEmpty icon={Users} actions={<HomeAction to="/clubes" primary>{t('Encontrar um clube')}</HomeAction>}>{texto}</HomeEmpty>,
  );

  if (clubsQ.isLoading || (temClubes && q.isLoading)) return moldura(<V2Skeleton lines={3} />);
  if (clubsQ.isError) return moldura(<V2ErrorState inline title={t('Os seus clubes não carregaram')} onRetry={() => clubsQ.refetch()} />);
  if (!temClubes) return vazio(t('Associado a um clube, você tem carteirinha digital, vantagens exclusivas e comunicados da diretoria.'));
  if (q.isError) return moldura(<V2ErrorState inline title={t('As suas associações não carregaram')} onRetry={() => q.refetch()} />);

  const resumos = (q.data?.clubs || [])
    .map((c) => clubSummary(c))
    .filter((r) => r.state || r.pagar)
    .map((r) => ({ r, ...avisoDe(r) }))
    .sort((a, b) => Number(b.urgente) - Number(a.urgente));
  if (!resumos.length) {
    return q.data?.incomplete
      ? moldura(<p className="text-sm text-gray-500">{t('Algum clube não pôde ser conferido agora — a lista pode estar incompleta.')}</p>)
      : vazio(t('Nenhum dos seus clubes tem associação aberta para você ainda. Veja os planos na página do clube.'));
  }
  return moldura(
    <div className="space-y-1">
      {resumos.slice(0, 3).map(({ r, badge, tone, urgente }) => (
        <HomeRow
          key={r.club_id}
          to={`/clubes/${r.club_id}`}
          icon={IdCard}
          title={r.club_name || t('Clube')}
          subtitle={r.validUntil ? t('{estado} · até {data}', { estado: r.label, data: dataCurta(r.validUntil) }) : r.label}
          badge={badge}
          badgeTone={tone}
          highlight={urgente}
        />
      ))}
      {q.data?.incomplete && <p className="pt-1 text-sm text-gray-500">{t('Algum clube não pôde ser conferido agora — a lista pode estar incompleta.')}</p>}
    </div>,
  );
}
