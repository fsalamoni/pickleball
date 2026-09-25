/**
 * As CAMPANHAS da arena, na Central → Marketing → Campanhas (Onda CC).
 *
 * Cada campanha pode ter um BANNER (criado na plataforma ou enviado) que leva
 * a um destino da plataforma, aparece na página da arena e/ou na tela inicial
 * até uma data — e/ou um AVISO no aplicativo para um público.
 *
 * Na lista, a arena vê de relance o que está no ar, o que pausou e o que
 * terminou, e para onde cada banner leva; pausa, retoma e edita o banner sem
 * reenviar aviso (aviso enviado não se desenvia).
 *
 * 🐞 A lista antiga dizia "Nenhuma campanha enviada" também quando a leitura
 * FALHAVA — e a arena criava de novo a campanha que já tinha mandado. Agora
 * falha é falha.
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ExternalLink, Megaphone, Pause, Pencil, Play, Plus, Users } from 'lucide-react';
import { useArenaCampaigns } from '@/modules/arenas/hooks/useArenaV3';
import { useUpdateCampaignBanner } from '@/modules/arenas/hooks/useCampaignBanners';
import { CAMPAIGN_AUDIENCE_META } from '@/modules/arenas/domain/marketing';
import {
  BANNER_STATE, campaignBannerState, campaignPlacementText, destinationCta, destinationLink,
} from '@/modules/arenas/domain/campaignBanner';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { todayISO } from '@/modules/arenas/domain/subscription';
import { instanteEmMs } from '@/core/domain/instant';
import {
  V2Badge, V2Button, V2EmptyState, V2ErrorState, V2Skeleton, V2Surface,
} from '@/v2/ui/primitives';
import BannerArt from './BannerArt';
import BannerThumb from './BannerThumb';
import CampaignForm from './CampaignForm';

const ESTADO = {
  [BANNER_STATE.LIVE]: { tone: 'green', rotulo: (c) => `Banner no ar até ${formatDateShortBR(c.banner_until)}` },
  [BANNER_STATE.PAUSED]: { tone: 'amber', rotulo: () => 'Banner pausado' },
  [BANNER_STATE.ENDED]: { tone: 'neutral', rotulo: () => 'Banner encerrado' },
  [BANNER_STATE.NONE]: { tone: 'neutral', rotulo: () => 'Só aviso' },
};

function dataISO(v) {
  const ms = instanteEmMs(v);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function LinhaDaCampanha({ campaign, arenaId, today, onEditar }) {
  const atualizar = useUpdateCampaignBanner();
  const estado = campaignBannerState(campaign, { today });
  const meta = ESTADO[estado];
  const enviadaEm = dataISO(campaign.sent_at || campaign.created_at);
  const alternar = async () => {
    try {
      await atualizar.mutateAsync({
        arenaId, campaignId: campaign.id, patch: { banner_active: estado !== BANNER_STATE.LIVE },
      });
      toast.success(estado === BANNER_STATE.LIVE ? 'Banner pausado.' : 'Banner de volta ao ar.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível mudar o banner.');
    }
  };
  const link = destinationLink(campaign.destination, { arenaId, campaignId: campaign.id });

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-paper p-3 sm:flex-row">
      {campaign.banner && (
        <>
          {/* No celular, o banner como o atleta vê; do tablet para cima, a
              miniatura (o mesmo banner, reduzido) ao lado do texto. */}
          <div className="w-full sm:hidden">
            <BannerArt banner={campaign.banner} ratio="phone" className="rounded-xl"
              cta={campaign.banner.source === 'upload' ? '' : destinationCta(campaign.destination, campaign.banner.design)} />
          </div>
          <BannerThumb className="hidden shrink-0 sm:block" banner={campaign.banner} width={176}
            cta={campaign.banner.source === 'upload' ? '' : destinationCta(campaign.destination, campaign.banner.design)} />
        </>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="font-bold text-ink">{campaign.name}</p>
          <V2Badge tone={meta.tone}>{meta.rotulo(campaign)}</V2Badge>
        </div>
        {campaign.message && <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{campaign.message}</p>}
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
          {Number(campaign.sent_count) > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Aviso para {campaign.sent_count} {campaign.sent_count === 1 ? 'pessoa' : 'pessoas'}
              {CAMPAIGN_AUDIENCE_META[campaign.target_audience] ? ` (${CAMPAIGN_AUDIENCE_META[campaign.target_audience].label})` : ''}
            </span>
          )}
          {enviadaEm && <span>{formatDateShortBR(enviadaEm)}</span>}
        </p>
        {campaign.banner && <p className="mt-0.5 text-xs text-gray-500">{campaignPlacementText(campaign)}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          <V2Button asChild size="sm" variant="ghost">
            <Link to={link}><ExternalLink className="h-3.5 w-3.5" /> Ver como o atleta vê</Link>
          </V2Button>
          <V2Button size="sm" variant="ghost" onClick={() => onEditar(campaign)}>
            <Pencil className="h-3.5 w-3.5" /> {campaign.banner ? 'Editar o banner' : 'Pôr um banner'}
          </V2Button>
          {campaign.banner && estado !== BANNER_STATE.ENDED && (
            <V2Button size="sm" variant="ghost" disabled={atualizar.isPending} onClick={alternar}>
              {estado === BANNER_STATE.LIVE
                ? <><Pause className="h-3.5 w-3.5" /> Pausar</>
                : <><Play className="h-3.5 w-3.5" /> Voltar ao ar</>}
            </V2Button>
          )}
        </div>
      </div>
    </li>
  );
}

export default function CampaignsPanel({ arena }) {
  const arenaId = arena.id;
  const q = useArenaCampaigns(arenaId);
  const today = todayISO();
  const [form, setForm] = useState(null); // null | { campaign: object|null }

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
            <Megaphone className="h-5 w-5 text-ink" />
            <h2 className="font-display text-lg font-bold text-ink">Campanhas</h2>
            {noAr > 0 && <V2Badge tone="green">{noAr} no ar</V2Badge>}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            Banner na página da arena e na tela inicial, levando a reservas, jogos, torneios, produtos ou planos — e aviso no aplicativo.
          </p>
        </div>
        {!form && !q.isError && (
          <V2Button size="sm" onClick={() => setForm({ campaign: null })}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova campanha
          </V2Button>
        )}
      </div>

      {form && (
        <div className="mb-4">
          <CampaignForm key={form.campaign?.id || 'nova'} arena={arena} campaign={form.campaign} onClose={() => setForm(null)} />
        </div>
      )}

      {q.isLoading ? (
        <V2Skeleton lines={3} />
      ) : q.isError ? (
        <V2ErrorState
          title="Não foi possível carregar as campanhas"
          description="A conexão falhou. As campanhas continuam lá — tente de novo antes de criar outra."
          onRetry={() => q.refetch()}
        />
      ) : campanhas.length === 0 ? (
        !form && (
          <V2EmptyState
            icon={Megaphone}
            title="Nenhuma campanha ainda"
            description="Uma campanha põe um banner na página da arena (e, se quiser, na tela inicial) e avisa a sua comunidade. Comece por um dos cinco modelos."
          />
        )
      ) : (
        <ul className="space-y-2">
          {campanhas.map((c) => (
            <LinhaDaCampanha key={c.id} campaign={c} arenaId={arenaId} today={today}
              onEditar={(campaign) => setForm({ campaign })} />
          ))}
        </ul>
      )}
    </V2Surface>
  );
}
