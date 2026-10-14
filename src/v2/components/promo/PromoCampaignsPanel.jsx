/**
 * As CAMPANHAS da plataforma ou do professor (Onda CG) — a mesma lista da
 * Central da arena: o que está no ar, o que pausou, o que terminou, para onde
 * cada banner leva; pausar, retomar e editar o banner sem reenviar o aviso
 * (aviso enviado não se desenvia).
 *
 * Falha é falha: "Nenhuma campanha" só com a lista em mãos — senão o emissor
 * cria de novo a campanha que já mandou.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ExternalLink, GraduationCap, Megaphone, Pause, Pencil, Play, Plus, Trash2, Users } from 'lucide-react';
import { BANNER_STATE, campaignBannerState } from '@/modules/arenas/domain/campaignBanner';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { todayISO } from '@/modules/arenas/domain/subscription';
import {
  PROMO_AUDIENCE_META, PROMO_ISSUER, PROMO_VISIBILITY, promoDestinationCta, promoDestinationLink,
  promoPlacementText, reachLabel,
} from '@/modules/promo/domain/promo';
import { useDeletePromoCampaign, useIssuerCampaigns, useUpdatePromoCampaign } from '@/modules/promo/hooks/usePromo';
import { instanteEmMs } from '@/core/domain/instant';
import ConfirmDialog from '@/components/ConfirmDialog';
import {
  V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import BannerArt from '@/v2/components/arenas/marketing/campaigns/BannerArt';
import BannerThumb from '@/v2/components/arenas/marketing/campaigns/BannerThumb';
import PromoCampaignForm from './PromoCampaignForm';
import { avisoEnviado } from './promoUi';
import { t } from '@/core/i18n';

const ESTADO = {
  [BANNER_STATE.LIVE]: { tone: 'green', rotulo: (c) => t('Banner no ar até {data}', { data: formatDateShortBR(c.banner_until) }) },
  [BANNER_STATE.PAUSED]: { tone: 'amber', rotulo: () => t('Banner pausado') },
  [BANNER_STATE.ENDED]: { tone: 'neutral', rotulo: () => t('Banner encerrado') },
  [BANNER_STATE.NONE]: { tone: 'neutral', rotulo: () => t('Só aviso') },
};

function dataISO(v) {
  const ms = instanteEmMs(v);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function LinhaDaCampanha({ campaign, today, onEditar }) {
  const atualizar = useUpdatePromoCampaign();
  const apagar = useDeletePromoCampaign();
  const estado = campaignBannerState(campaign, { today });
  const meta = ESTADO[estado];
  const enviadaEm = dataISO(campaign.sent_at || campaign.created_at);
  const ctx = { issuerType: campaign.issuer_type, issuerId: campaign.issuer_id, campaignId: campaign.id };
  const link = promoDestinationLink({ type: 'details' }, ctx);
  const cta = campaign.banner?.source === 'upload' ? '' : promoDestinationCta(campaign.destination, campaign.banner?.design);
  const publicoRotulo = PROMO_AUDIENCE_META[campaign.target_audience]?.label;
  const publico = publicoRotulo ? t(publicoRotulo) : '';

  const alternar = async () => {
    try {
      await atualizar.mutateAsync({ campaignId: campaign.id, patch: { banner_active: estado !== BANNER_STATE.LIVE } });
      toast.success(estado === BANNER_STATE.LIVE ? t('Banner pausado.') : t('Banner de volta ao ar.'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível mudar o banner.'));
    }
  };
  const remover = async () => {
    try {
      await apagar.mutateAsync({ campaignId: campaign.id });
      toast.success(t('Campanha apagada.'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível apagar.'));
    }
  };

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-paper p-3 sm:flex-row">
      {campaign.banner && (
        <>
          <div className="w-full sm:hidden">
            <BannerArt banner={campaign.banner} ratio="phone" className="rounded-xl" cta={cta} />
          </div>
          <BannerThumb className="hidden shrink-0 sm:block" banner={campaign.banner} width={176} cta={cta} />
        </>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-bold text-ink">{campaign.name}</p>
          <V2Badge tone={meta.tone}>{meta.rotulo(campaign)}</V2Badge>
        </div>
        {campaign.message && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{campaign.message}</p>}
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
          {(Number(campaign.sent_count) > 0 || Number(campaign.recipients_count) > 0) && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" aria-hidden /> {avisoEnviado(campaign)}{publico ? ` (${publico})` : ''}
            </span>
          )}
          {enviadaEm && <span>{formatDateShortBR(enviadaEm)}</span>}
          {campaign.banner && campaign.show_home && <span>{t('Tela inicial: {regiao}', { regiao: reachLabel(campaign.reach) })}</span>}
          {campaign.issuer_type === PROMO_ISSUER.COACH && campaign.visibility === PROMO_VISIBILITY.STUDENTS && (
            <span className="inline-flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" aria-hidden /> {t('Só alunos')}</span>
          )}
        </p>
        {campaign.banner && <p className="mt-0.5 text-xs text-gray-500">{promoPlacementText(campaign)}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <V2Button asChild size="sm" variant="ghost">
            <Link to={link}><ExternalLink className="h-3.5 w-3.5" aria-hidden /> {t('Ver como é vista')}</Link>
          </V2Button>
          <V2Button size="sm" variant="ghost" onClick={() => onEditar(campaign)}>
            <Pencil className="h-3.5 w-3.5" aria-hidden /> {campaign.banner ? t('Editar o banner') : t('Pôr um banner')}
          </V2Button>
          {campaign.banner && estado !== BANNER_STATE.ENDED && (
            <V2Button size="sm" variant="ghost" disabled={atualizar.isPending} onClick={alternar}>
              {estado === BANNER_STATE.LIVE
                ? <><Pause className="h-3.5 w-3.5" aria-hidden /> {t('Pausar')}</>
                : <><Play className="h-3.5 w-3.5" aria-hidden /> {t('Voltar ao ar')}</>}
            </V2Button>
          )}
          <ConfirmDialog
            title={t('Apagar a campanha “{nome}”?', { nome: campaign.name })}
            description={t('O banner sai do ar e a campanha some da lista. O aviso já enviado continua no sino de quem recebeu. Se a ideia é só tirar o banner do ar, use “Pausar”.')}
            confirmLabel={t('Apagar')}
            destructive
            onConfirm={remover}
            trigger={(
              <V2Button size="sm" variant="ghost" className="text-red-600">
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> {t('Apagar')}
              </V2Button>
            )}
          />
        </div>
      </div>
    </li>
  );
}

/** @param {{ issuer: { type: string, id: string, name: string } }} props */
export default function PromoCampaignsPanel({ issuer }) {
  const q = useIssuerCampaigns(issuer);
  const today = todayISO();
  const [form, setForm] = useState(null); // null | { campaign: object|null }
  const ehProfessor = issuer.type === PROMO_ISSUER.COACH;

  const campanhas = useMemo(() => [...(q.data || [])].sort((a, b) => (
    (instanteEmMs(b.sent_at) || instanteEmMs(b.created_at) || 0)
    - (instanteEmMs(a.sent_at) || instanteEmMs(a.created_at) || 0)
  )), [q.data]);
  const noAr = campanhas.filter((c) => campaignBannerState(c, { today }) === BANNER_STATE.LIVE).length;

  return (
    <V2Surface>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-ink" aria-hidden />
            <h2 className="font-display text-lg font-bold text-ink">{t('Campanhas')}</h2>
            {noAr > 0 && <V2Badge tone="green">{t('{n} no ar', { n: noAr })}</V2Badge>}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {ehProfessor
              ? t('Banner no seu perfil e na tela inicial, levando a marcar aula, clínicas, loja ou conteúdo — e aviso para os seus alunos.')
              : t('Banner na vitrine de promoções e na tela inicial, levando a torneios, jogos, arenas, professores e ranking — e aviso para a comunidade.')}
          </p>
        </div>
        {!form && !q.isError && !q.isLoading && (
          <V2Button size="sm" onClick={() => setForm({ campaign: null })}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden /> {t('Nova campanha')}
          </V2Button>
        )}
      </div>

      {form && (
        <div className="mb-4">
          <PromoCampaignForm key={form.campaign?.id || 'nova'} issuer={issuer} campaign={form.campaign} onClose={() => setForm(null)} />
        </div>
      )}

      {q.isLoading ? (
        <V2Skeleton lines={3} />
      ) : q.isError ? (
        <V2ErrorState
          title={t('Não foi possível carregar as campanhas')}
          description={t('A conexão falhou. As campanhas continuam lá — tente de novo antes de criar outra.')}
          onRetry={() => q.refetch()}
        />
      ) : campanhas.length === 0 ? (
        !form && (
          <V2EmptyState
            icon={Megaphone}
            title={t('Nenhuma campanha ainda')}
            description={ehProfessor
              ? t('Uma campanha põe um banner no seu perfil (e, se quiser, na tela inicial) e avisa os seus alunos. Comece por um dos cinco modelos.')
              : t('Uma campanha põe um banner na vitrine e na tela inicial e avisa a comunidade — toda ou só uma região. Comece por um dos cinco modelos.')}
          />
        )
      ) : (
        <ul className="space-y-2">
          {campanhas.map((c) => (
            <LinhaDaCampanha key={c.id} campaign={c} today={today} onEditar={(campaign) => setForm({ campaign })} />
          ))}
        </ul>
      )}
    </V2Surface>
  );
}
