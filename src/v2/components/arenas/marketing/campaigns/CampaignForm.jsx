/**
 * Criar (ou editar) uma CAMPANHA com banner (Onda CC).
 *
 * A ordem é a da decisão de quem faz marketing:
 *  1. o que é (nome);
 *  2. para onde leva — o que a pessoa vai FAZER ao tocar;
 *  3. o banner — criado na plataforma a partir de um modelo, ou enviado;
 *  4. onde aparece e até quando;
 *  5. o aviso no aplicativo, para quem e com que texto.
 *
 * O botão de publicar não fica mudo quando falta algo: a lista "Falta" diz o
 * quê. E a confirmação resume tudo antes — onde o banner aparece, até quando,
 * para onde leva, e para quantas pessoas vai o aviso (que não dá para
 * desfazer).
 *
 * Em modo edição (campanha já publicada) mexe-se só no banner: o aviso já foi.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Ban, Bell, ImagePlus, Paintbrush, Send, X } from 'lucide-react';
import { useArenaBookings } from '@/modules/arenas/hooks/useBookings';
import { useArenaMembers } from '@/modules/arenas/hooks/useArenaV3';
import { usePublishCampaign, useUpdateCampaignBanner } from '@/modules/arenas/hooks/useCampaignBanners';
import {
  CAMPAIGN_AUDIENCE, CAMPAIGN_AUDIENCE_META, campaignRecipients,
} from '@/modules/arenas/domain/marketing';
import { designFromTemplate, platformTemplate } from '@/modules/arenas/domain/bannerArt';
import {
  BANNER_SOURCE, CAMPAIGN_DESTINATION, CAMPAIGN_DESTINATION_META, defaultBannerUntil, destinationCta,
  normalizeBannerPlacement, normalizeCampaignBanner, normalizeDestination,
} from '@/modules/arenas/domain/campaignBanner';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { todayISO } from '@/modules/arenas/domain/subscription';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Textarea,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import BannerDesigner from './BannerDesigner';
import BannerUploader from './BannerUploader';
import DestinationPicker from './DestinationPicker';
import { t, tn } from '@/core/i18n';

const SEM_BANNER = 'none';

function Secao({ n, titulo, descricao, children }) {
  return (
    <section className="space-y-3 border-t border-gray-100 pt-4 first:border-0 first:pt-0">
      <div>
        <p className="font-display text-base font-bold text-ink">
          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs text-acid">{n}</span>
          {titulo}
        </p>
        {descricao && <p className="mt-0.5 text-xs text-gray-500">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

function estadoInicial(campaign, today) {
  const b = campaign?.banner || null;
  const base = platformTemplate('destaque');
  return {
    name: campaign?.name || '',
    message: campaign?.message || '',
    audience: CAMPAIGN_AUDIENCE.ALL,
    notify: !campaign,
    destination: campaign?.destination || { type: CAMPAIGN_DESTINATION.DETAILS, target_id: '', target_label: '' },
    source: !b ? (campaign ? SEM_BANNER : BANNER_SOURCE.DESIGN) : b.source,
    templateId: b?.template_id || (b ? null : base.id),
    design: b?.design || designFromTemplate(base),
    upload: b?.source === BANNER_SOURCE.UPLOAD
      ? { image_url: b.image_url, image_path: b.image_path, width: b.width, height: b.height, alt: b.alt }
      : { image_url: '', image_path: '', width: null, height: null, alt: '' },
    show_on_arena: campaign ? campaign.show_on_arena !== false : true,
    show_home: campaign ? campaign.show_home === true : false,
    banner_until: campaign?.banner_until || defaultBannerUntil(today),
  };
}

/** O banner a gravar, a partir do estado do formulário (`null` = sem banner). */
function bannerDoForm(f) {
  if (f.source === SEM_BANNER) return null;
  if (f.source === BANNER_SOURCE.UPLOAD) return { source: BANNER_SOURCE.UPLOAD, ...f.upload };
  return { source: BANNER_SOURCE.DESIGN, template_id: f.templateId, design: f.design };
}

/**
 * @param {{ arena: object, campaign?: object|null, onClose: Function }} props
 */
export default function CampaignForm({ arena, campaign = null, onClose }) {
  const arenaId = arena.id;
  const editando = Boolean(campaign);
  const today = todayISO();
  const [f, setF] = useState(() => estadoInicial(campaign, today));
  const set = (patch) => setF((atual) => ({ ...atual, ...patch }));
  const [confirmar, setConfirmar] = useState(false);

  const publicar = usePublishCampaign();
  const editar = useUpdateCampaignBanner();
  const salvando = publicar.isPending || editar.isPending;

  // O público só é lido se a campanha vai avisar alguém.
  const membrosQ = useArenaMembers(!editando && f.notify ? arenaId : null);
  const reservasQ = useArenaBookings(!editando && f.notify ? arenaId : null);
  const publicoFalhou = membrosQ.isError || reservasQ.isError;
  // Só reserva CONCLUÍDA conta como "já jogou aqui".
  const concluidas = useMemo(
    () => (reservasQ.data || []).filter((b) => ['completed', 'confirmed'].includes(b.status)),
    [reservasQ.data],
  );
  const membros = useMemo(() => membrosQ.data || [], [membrosQ.data]);
  const destinatarios = useMemo(
    () => campaignRecipients(f.audience, { members: membros, bookings: concluidas }),
    [f.audience, membros, concluidas],
  );

  const banner = bannerDoForm(f);
  const vBanner = normalizeCampaignBanner(banner);
  const vDestino = normalizeDestination(f.destination);
  const vLugar = banner ? normalizeBannerPlacement(f, { today }) : { valid: true, errors: {} };
  const cta = destinationCta(f.destination, f.design);

  const falta = [
    ...(!editando && !f.name.trim() ? [t('o nome da campanha')] : []),
    ...Object.values(vDestino.errors),
    ...Object.values(vBanner.errors),
    ...Object.values(vLugar.errors),
    ...(!editando && f.notify && !f.message.trim() ? [t('a mensagem do aviso')] : []),
    ...(!editando && f.notify && !publicoFalhou && destinatarios.length === 0 ? [t('alguém no público do aviso')] : []),
    ...(!editando && f.notify && publicoFalhou ? [t('carregar o público do aviso')] : []),
    ...(!editando && !f.notify && !banner ? [t('um banner ou um aviso — a campanha precisa aparecer em algum lugar')] : []),
    ...(editando && !banner ? [t('o banner')] : []),
  ];

  const resumo = [
    banner
      ? t('Banner {lugares} até {data}.', {
        lugares: [f.show_on_arena ? t('na página da arena') : null, f.show_home ? t('na tela inicial') : null].filter(Boolean).join(t(' e ')),
        data: formatDateShortBR(f.banner_until),
      })
      : null,
    `${t('Leva a: {destino}', { destino: t(CAMPAIGN_DESTINATION_META[vDestino.value.type].label) })}${vDestino.value.target_label ? ` (${vDestino.value.target_label})` : ''}.`,
    !editando && f.notify ? tn(destinatarios.length, 'Aviso no aplicativo para {n} pessoa — não dá para cancelar depois.', 'Aviso no aplicativo para {n} pessoas — não dá para cancelar depois.') : null,
  ].filter(Boolean);

  const enviar = async () => {
    try {
      if (editando) {
        await editar.mutateAsync({
          arenaId,
          campaignId: campaign.id,
          patch: {
            banner,
            destination: f.destination,
            show_on_arena: f.show_on_arena,
            show_home: f.show_home,
            banner_until: f.banner_until,
          },
        });
        toast.success(t('Banner atualizado.'));
      } else {
        const { sent } = await publicar.mutateAsync({
          arenaId,
          input: {
            name: f.name,
            message: f.message,
            audience: f.audience,
            notify: f.notify,
            banner,
            destination: f.destination,
            show_on_arena: f.show_on_arena,
            show_home: f.show_home,
            banner_until: f.banner_until,
          },
          recipients: f.notify ? destinatarios : [],
        });
        toast.success(f.notify ? t('Campanha publicada. Aviso enviado para {n} pessoa(s).', { n: sent }) : t('Campanha publicada.'));
      }
      setConfirmar(false);
      onClose?.();
    } catch (err) {
      toast.error(err?.message || t('Não foi possível publicar.'));
      setConfirmar(false);
    }
  };

  const FONTES = [
    [BANNER_SOURCE.DESIGN, Paintbrush, t('Criar na plataforma')],
    [BANNER_SOURCE.UPLOAD, ImagePlus, t('Enviar a minha imagem')],
    [SEM_BANNER, Ban, t('Sem banner')],
  ];

  return (
    <div className="rounded-3xl border border-gray-100 bg-paper-pure p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-display text-lg font-bold text-ink">{editando ? t('Banner de “{nome}”', { nome: campaign.name }) : t('Nova campanha')}</h3>
        <button type="button" onClick={onClose} aria-label={t('Fechar')} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5">
        {!editando && (
          <Secao n={1} titulo={t('O que é')} descricao={t('O nome aparece para você na lista e é o título do aviso.')}>
            <V2Field label={t('Nome da campanha')} htmlFor="camp-nome" required>
              <V2Input id="camp-nome" maxLength={80} placeholder={t('Terça com 20% de desconto')}
                value={f.name} onChange={(e) => set({ name: e.target.value })} />
            </V2Field>
          </Secao>
        )}

        <Secao n={editando ? 1 : 2} titulo={t('Para onde leva')} descricao={t('O que a pessoa vai fazer ao tocar no banner (ou no aviso).')}>
          <DestinationPicker arenaId={arenaId} value={f.destination} onChange={(destination) => set({ destination })} />
        </Secao>

        <Secao n={editando ? 2 : 3} titulo={t('Banner')}>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('De onde vem o banner')}>
            {FONTES.filter(([k]) => !(editando && k === SEM_BANNER)).map(([k, Icone, rotulo]) => (
              <button key={k} type="button" role="radio" aria-checked={f.source === k} onClick={() => set({ source: k })}
                className={cn('inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold transition',
                  f.source === k ? 'border-ink bg-ink text-white' : 'border-gray-200 bg-paper-pure text-gray-600 hover:border-ink')}>
                <Icone className="h-4 w-4" aria-hidden /> {rotulo}
              </button>
            ))}
          </div>
          {f.source === BANNER_SOURCE.DESIGN && (
            <BannerDesigner arenaId={arenaId} arena={arena} templateId={f.templateId} design={f.design} cta={cta}
              onChange={({ template_id, design }) => set({ templateId: template_id, design })} />
          )}
          {f.source === BANNER_SOURCE.UPLOAD && (
            <BannerUploader value={f.upload} onChange={(patch) => set({ upload: { ...f.upload, ...patch } })} />
          )}
          {f.source === SEM_BANNER && (
            <p className="rounded-2xl bg-paper px-3 py-2 text-sm text-gray-600">{t('A campanha vai só como aviso no aplicativo.')}</p>
          )}
        </Secao>

        {banner && (
          <Secao n={editando ? 3 : 4} titulo={t('Onde aparece e até quando')}>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-2xl border border-gray-200 p-3">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-ink" checked={f.show_on_arena}
                  onChange={(e) => set({ show_on_arena: e.target.checked })} />
                <span>
                  <span className="block text-sm font-bold text-ink">{t('Na página da arena')}</span>
                  <span className="block text-xs text-gray-500">{t('No topo, em “Em destaque” — quem já te procura.')}</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-2xl border border-gray-200 p-3">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-ink" checked={f.show_home}
                  onChange={(e) => set({ show_home: e.target.checked })} />
                <span>
                  <span className="block text-sm font-bold text-ink">{t('Também na tela inicial')}</span>
                  <span className="block text-xs text-gray-500">{t('No carrossel de quem está na cidade ou no estado da arena.')}</span>
                </span>
              </label>
            </div>
            <V2Field label={t('No ar até')} htmlFor="camp-ate" error={vLugar.errors.banner_until}
              hint={t('Depois dessa data o banner sai sozinho.')}>
              <V2Input id="camp-ate" type="date" min={today} value={f.banner_until}
                onChange={(e) => set({ banner_until: e.target.value })} className="max-w-[12rem]" />
            </V2Field>
          </Secao>
        )}

        {!editando && (
          <Secao n={banner ? 5 : 4} titulo={t('Aviso no aplicativo')} descricao={t('Chega na hora para o público escolhido, e leva ao mesmo destino do banner.')}>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-ink" checked={f.notify}
                onChange={(e) => set({ notify: e.target.checked })} />
              <span className="inline-flex items-center gap-1 text-sm font-bold text-ink"><Bell className="h-4 w-4" aria-hidden /> {t('Avisar pelo aplicativo')}</span>
            </label>
            {f.notify && (
              <>
                {publicoFalhou ? (
                  <V2ErrorState inline title={t('Não foi possível carregar o público')}
                    description={t('Sem ele não dá para saber quem recebe o aviso.')}
                    onRetry={() => { membrosQ.refetch(); reservasQ.refetch(); }} />
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.values(CAMPAIGN_AUDIENCE).map((a) => {
                      const meta = CAMPAIGN_AUDIENCE_META[a];
                      const quantos = campaignRecipients(a, { members: membros, bookings: concluidas }).length;
                      const marcado = f.audience === a;
                      return (
                        <button key={a} type="button" onClick={() => set({ audience: a })} aria-pressed={marcado}
                          className={cn('rounded-2xl border p-3 text-left transition',
                            marcado ? 'border-ink bg-ink/5' : 'border-gray-200 bg-paper-pure hover:border-gray-300')}>
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-bold text-ink">{t(meta.label)}</span>
                            <V2Badge tone={quantos > 0 ? 'green' : 'neutral'}>{tn(quantos, '{n} pessoa', '{n} pessoas')}</V2Badge>
                          </span>
                          <span className="mt-1 block text-xs text-gray-500">{t(meta.hint)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <V2Field label={t('Mensagem')} htmlFor="camp-msg" required>
                  <V2Textarea id="camp-msg" rows={3} maxLength={1000}
                    placeholder={t('Escreva como falaria no balcão. Diga o que é, quando vale e o que a pessoa precisa fazer.')}
                    value={f.message} onChange={(e) => set({ message: e.target.value })} />
                </V2Field>
              </>
            )}
          </Secao>
        )}

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-gray-100 pt-4">
          <div className="min-w-0 text-xs text-gray-600">
            {falta.length > 0 ? (
              <p><strong className="text-amber-700">{t('Falta:')}</strong> {falta.join('; ')}.</p>
            ) : (
              <ul className="space-y-0.5">{resumo.map((l) => <li key={l}>{l}</li>)}</ul>
            )}
          </div>
          <div className="flex gap-2">
            <V2Button variant="ghost" onClick={onClose}>{t('Cancelar')}</V2Button>
            <V2Button disabled={falta.length > 0 || salvando} onClick={() => setConfirmar(true)}>
              <Send className="mr-1.5 h-4 w-4" /> {editando ? t('Salvar o banner') : t('Publicar campanha')}
            </V2Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        title={editando ? t('Salvar o banner?') : t('Publicar esta campanha?')}
        description={resumo.join(' ')}
        confirmLabel={editando ? t('Salvar') : t('Publicar agora')}
        loading={salvando}
        destructive={false}
        onConfirm={enviar}
      />
    </div>
  );
}
