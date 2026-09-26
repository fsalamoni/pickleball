/**
 * Criar (ou editar) uma CAMPANHA da plataforma ou do professor (Onda CG).
 *
 * A mesma ordem da campanha da arena — a da decisão de quem faz marketing:
 *  1. o que é (nome);
 *  2. para onde leva;
 *  3. o banner — criado a partir dos cinco modelos (ou dos seus), ou enviado;
 *  4. onde aparece, até quando e até onde (região);
 *  5. o aviso no aplicativo, para quem e com que texto.
 *
 * O público do aviso é o de cada emissor: a plataforma fala com todo mundo, um
 * interesse, um estado, uma cidade ou os professores; o professor, com os
 * alunos. Cada opção mostra QUANTAS pessoas recebem antes de enviar, e
 * público vazio não envia. O botão não fica mudo: a lista "Falta" diz o quê.
 *
 * Em edição (campanha publicada) mexe-se só no banner: o aviso já foi.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Ban, Bell, ImagePlus, Paintbrush, Send, X } from 'lucide-react';
import { PLATFORM_INTEREST_META } from '@/modules/athletes/domain/profileMeta';
import { useAllPlatformUsers } from '@/modules/admin/hooks/usePlatformUsers';
import { useCoachStudents } from '@/modules/coaches/hooks/useStudents';
import { designFromTemplate, platformTemplate } from '@/modules/arenas/domain/bannerArt';
import { BANNER_SOURCE, normalizeCampaignBanner } from '@/modules/arenas/domain/campaignBanner';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { todayISO } from '@/modules/arenas/domain/subscription';
import {
  BR_UFS, PROMO_AUDIENCE, PROMO_AUDIENCES_BY_ISSUER, PROMO_AUDIENCE_META, PROMO_DESTINATION,
  PROMO_DESTINATION_META, PROMO_ISSUER, PROMO_REACH, PROMO_VISIBILITY, coachRecipients, defaultPromoUntil,
  normalizePromoDestination, normalizePromoPlacement, normalizeReach, platformRecipients, promoDestinationCta,
  reachLabel,
} from '@/modules/promo/domain/promo';
import { usePromoTemplatesSource, usePublishPromoCampaign, useUpdatePromoCampaign } from '@/modules/promo/hooks/usePromo';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Textarea,
} from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import BannerDesigner from '@/v2/components/arenas/marketing/campaigns/BannerDesigner';
import BannerUploader from '@/v2/components/arenas/marketing/campaigns/BannerUploader';
import PromoDestinationPicker from './PromoDestinationPicker';
import PromoReachPicker from './PromoReachPicker';
import { issuerBrand, pessoas, uploadFolderFor } from './promoUi';

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

function estadoInicial(campaign, today, issuerType) {
  const b = campaign?.banner || null;
  const base = platformTemplate('destaque');
  return {
    name: campaign?.name || '',
    message: campaign?.message || '',
    audience: PROMO_AUDIENCES_BY_ISSUER[issuerType][0],
    detail: { interest: '', state: '', city: '' },
    notify: !campaign,
    destination: campaign?.destination || { type: PROMO_DESTINATION.DETAILS, target_id: '', target_label: '' },
    source: !b ? (campaign ? SEM_BANNER : BANNER_SOURCE.DESIGN) : b.source,
    templateId: b?.template_id || (b ? null : base.id),
    design: b?.design || designFromTemplate(base),
    upload: b?.source === BANNER_SOURCE.UPLOAD
      ? { image_url: b.image_url, image_path: b.image_path, width: b.width, height: b.height, alt: b.alt }
      : { image_url: '', image_path: '', width: null, height: null, alt: '' },
    show_on_page: campaign ? campaign.show_on_page !== false : true,
    show_home: campaign ? campaign.show_home === true : false,
    banner_until: campaign?.banner_until || defaultPromoUntil(today),
    reach: campaign?.reach || { mode: PROMO_REACH.BRASIL, state: '', city: '' },
    visibility: campaign?.visibility === PROMO_VISIBILITY.STUDENTS ? PROMO_VISIBILITY.STUDENTS : PROMO_VISIBILITY.ALL,
  };
}

function bannerDoForm(f) {
  if (f.source === SEM_BANNER) return null;
  if (f.source === BANNER_SOURCE.UPLOAD) return { source: BANNER_SOURCE.UPLOAD, ...f.upload };
  return { source: BANNER_SOURCE.DESIGN, template_id: f.templateId, design: f.design };
}

/** O detalhe do público (interesse, estado, cidade) — só o que a opção pede. */
function DetalheDoPublico({ audience, detail, onChange }) {
  const precisa = PROMO_AUDIENCE_META[audience]?.needs;
  if (!precisa) return null;
  const set = (patch) => onChange({ ...detail, ...patch });
  if (precisa === 'interest') {
    return (
      <V2Field label="Interesse" htmlFor="pcamp-interesse" hint="O que a pessoa marcou no perfil.">
        <V2Select id="pcamp-interesse" value={detail.interest} onChange={(e) => set({ interest: e.target.value })}>
          <option value="">Escolha…</option>
          {PLATFORM_INTEREST_META.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </V2Select>
      </V2Field>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
      <V2Field label="Estado" htmlFor="pcamp-uf">
        <V2Select id="pcamp-uf" value={detail.state} onChange={(e) => set({ state: e.target.value })}>
          <option value="">UF…</option>
          {BR_UFS.map((u) => <option key={u} value={u}>{u}</option>)}
        </V2Select>
      </V2Field>
      {precisa === 'city' && (
        <V2Field label="Cidade" htmlFor="pcamp-cidade">
          <V2Input id="pcamp-cidade" maxLength={80} placeholder="Porto Alegre" value={detail.city}
            onChange={(e) => set({ city: e.target.value })} />
        </V2Field>
      )}
    </div>
  );
}

/**
 * @param {{ issuer: { type: string, id: string, name: string }, campaign?: object|null, onClose: Function }} props
 */
export default function PromoCampaignForm({ issuer, campaign = null, onClose }) {
  const ehProfessor = issuer.type === PROMO_ISSUER.COACH;
  const editando = Boolean(campaign);
  const today = todayISO();
  const [f, setF] = useState(() => estadoInicial(campaign, today, issuer.type));
  const set = (patch) => setF((atual) => ({ ...atual, ...patch }));
  const [confirmar, setConfirmar] = useState(false);

  const publicar = usePublishPromoCampaign();
  const editar = useUpdatePromoCampaign();
  const modelos = usePromoTemplatesSource(issuer, 'banner');
  const salvando = publicar.isPending || editar.isPending;

  // O público só é lido se a campanha vai avisar alguém.
  const lerPublico = !editando && f.notify;
  const usuariosQ = useAllPlatformUsers({ enabled: lerPublico && !ehProfessor });
  const alunosQ = useCoachStudents(lerPublico && ehProfessor ? issuer.id : null);
  const publicoQ = ehProfessor ? alunosQ : usuariosQ;
  const publicoFalhou = lerPublico && publicoQ.isError;
  const publicoCarregando = lerPublico && publicoQ.isLoading;
  const destinatariosDe = useCallback((audience, detail) => (ehProfessor
    ? coachRecipients(audience, { students: alunosQ.data || [] })
    : platformRecipients(audience, { users: usuariosQ.data || [], ...detail })),
  [ehProfessor, alunosQ.data, usuariosQ.data]);
  const destinatarios = useMemo(() => destinatariosDe(f.audience, f.detail), [destinatariosDe, f.audience, f.detail]);

  const banner = bannerDoForm(f);
  const vBanner = normalizeCampaignBanner(banner);
  const vDestino = normalizePromoDestination(f.destination, issuer.type);
  const vLugar = banner ? normalizePromoPlacement(f, { today }) : { valid: true, errors: {} };
  const vAlcance = banner && f.show_home ? normalizeReach(f.reach) : { valid: true, errors: {} };
  const cta = promoDestinationCta(f.destination, f.design);
  const pagina = ehProfessor ? 'no seu perfil' : 'na vitrine de promoções';

  const falta = [
    ...(!editando && !f.name.trim() ? ['o nome da campanha'] : []),
    ...Object.values(vDestino.errors),
    ...Object.values(vBanner.errors),
    ...Object.values(vLugar.errors),
    ...Object.values(vAlcance.errors),
    ...(!editando && f.notify && !f.message.trim() ? ['a mensagem do aviso'] : []),
    ...(!editando && f.notify && publicoCarregando ? ['carregar o público do aviso'] : []),
    ...(!editando && f.notify && publicoFalhou ? ['carregar o público do aviso'] : []),
    ...(!editando && f.notify && !publicoFalhou && !publicoCarregando && destinatarios.length === 0 ? ['alguém no público do aviso'] : []),
    ...(!editando && !f.notify && !banner ? ['um banner ou um aviso — a campanha precisa aparecer em algum lugar'] : []),
    ...(editando && !banner ? ['o banner'] : []),
  ];

  const resumo = [
    banner
      ? `Banner ${[f.show_on_page ? pagina : null, f.show_home ? `na tela inicial (${reachLabel(f.reach)})` : null].filter(Boolean).join(' e ')} até ${formatDateShortBR(f.banner_until)}.`
      : null,
    `Leva a: ${PROMO_DESTINATION_META[vDestino.value.type].label}${vDestino.value.target_label ? ` (${vDestino.value.target_label})` : ''}.`,
    ehProfessor && banner && f.visibility === PROMO_VISIBILITY.STUDENTS ? 'O banner aparece só para os seus alunos.' : null,
    !editando && f.notify ? `Aviso no aplicativo para ${pessoas(destinatarios.length)} — não dá para cancelar depois.` : null,
  ].filter(Boolean);

  const enviar = async () => {
    const lugar = {
      show_on_page: f.show_on_page, show_home: f.show_home, banner_until: f.banner_until,
      reach: f.reach, visibility: f.visibility,
    };
    try {
      if (editando) {
        await editar.mutateAsync({ campaignId: campaign.id, patch: { banner, destination: f.destination, ...lugar } });
        toast.success('Banner atualizado.');
      } else {
        const { sent } = await publicar.mutateAsync({
          issuer,
          input: {
            name: f.name, message: f.message, audience: f.audience, audience_detail: f.detail,
            notify: f.notify, banner, destination: f.destination, ...lugar,
          },
          recipients: f.notify ? destinatarios : [],
        });
        toast.success(f.notify ? `Campanha publicada. Aviso enviado para ${pessoas(sent)}.` : 'Campanha publicada.');
      }
      setConfirmar(false);
      onClose?.();
    } catch (err) {
      toast.error(err?.message || 'Não foi possível publicar.');
      setConfirmar(false);
    }
  };

  const FONTES = [
    [BANNER_SOURCE.DESIGN, Paintbrush, 'Criar na plataforma'],
    [BANNER_SOURCE.UPLOAD, ImagePlus, 'Enviar a minha imagem'],
    [SEM_BANNER, Ban, 'Sem banner'],
  ];

  return (
    <div className="rounded-3xl border border-gray-100 bg-paper-pure p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="font-display text-lg font-bold text-ink">{editando ? `Banner de “${campaign.name}”` : 'Nova campanha'}</h3>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-5">
        {!editando && (
          <Secao n={1} titulo="O que é" descricao="O nome aparece para você na lista e é o título do aviso.">
            <V2Field label="Nome da campanha" htmlFor="pcamp-nome" required>
              <V2Input id="pcamp-nome" maxLength={80}
                placeholder={ehProfessor ? 'Turma nova de iniciantes' : 'Inscrições abertas para o Open'}
                value={f.name} onChange={(e) => set({ name: e.target.value })} />
            </V2Field>
          </Secao>
        )}

        <Secao n={editando ? 1 : 2} titulo="Para onde leva" descricao="O que a pessoa vai fazer ao tocar no banner (ou no aviso).">
          <PromoDestinationPicker issuerType={issuer.type} value={f.destination} onChange={(destination) => set({ destination })} />
        </Secao>

        <Secao n={editando ? 2 : 3} titulo="Banner">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="De onde vem o banner">
            {FONTES.filter(([k]) => !(editando && k === SEM_BANNER)).map(([k, Icone, rotulo]) => (
              <button key={k} type="button" role="radio" aria-checked={f.source === k} onClick={() => set({ source: k })}
                className={cn('inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold transition',
                  f.source === k ? 'border-ink bg-ink text-white' : 'border-gray-200 bg-paper-pure text-gray-600 hover:border-ink')}>
                <Icone className="h-4 w-4" aria-hidden /> {rotulo}
              </button>
            ))}
          </div>
          {f.source === BANNER_SOURCE.DESIGN && (
            <BannerDesigner templateId={f.templateId} design={f.design} cta={cta}
              templates={modelos} brand={issuerBrand(issuer)} uploadFolder={uploadFolderFor(issuer, 'banner')}
              onChange={({ template_id, design }) => set({ templateId: template_id, design })} />
          )}
          {f.source === BANNER_SOURCE.UPLOAD && (
            <BannerUploader value={f.upload} folder={uploadFolderFor(issuer, 'banner')}
              onChange={(patch) => set({ upload: { ...f.upload, ...patch } })} />
          )}
          {f.source === SEM_BANNER && (
            <p className="rounded-2xl bg-paper px-3 py-2 text-sm text-gray-600">A campanha vai só como aviso no aplicativo.</p>
          )}
        </Secao>

        {banner && (
          <Secao n={editando ? 3 : 4} titulo="Onde aparece e até quando">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex cursor-pointer items-start gap-2 rounded-2xl border border-gray-200 p-3">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-ink" checked={f.show_on_page}
                  onChange={(e) => set({ show_on_page: e.target.checked })} />
                <span>
                  <span className="block text-sm font-bold text-ink">{ehProfessor ? 'No seu perfil' : 'Na vitrine de promoções'}</span>
                  <span className="block text-xs text-gray-500">
                    {ehProfessor ? 'No topo do seu perfil de professor — e na vitrine de promoções.' : 'A página de promoções da plataforma.'}
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 rounded-2xl border border-gray-200 p-3">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-ink" checked={f.show_home}
                  onChange={(e) => set({ show_home: e.target.checked })} />
                <span>
                  <span className="block text-sm font-bold text-ink">Também na tela inicial</span>
                  <span className="block text-xs text-gray-500">No carrossel de destaques, na região que você escolher.</span>
                </span>
              </label>
            </div>
            {f.show_home && (
              <PromoReachPicker idPrefix="pcamp-alcance" value={f.reach} onChange={(reach) => set({ reach })} />
            )}
            {ehProfessor && (
              <label className="flex items-start gap-2 text-sm text-gray-600">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-ink" checked={f.visibility === PROMO_VISIBILITY.STUDENTS}
                  onChange={(e) => set({ visibility: e.target.checked ? PROMO_VISIBILITY.STUDENTS : PROMO_VISIBILITY.ALL })} />
                <span>
                  Mostrar o banner só para os meus alunos
                  <span className="block text-xs text-gray-500">Útil para avisos da turma. Desmarcado, é para atrair gente nova.</span>
                </span>
              </label>
            )}
            <V2Field label="No ar até" htmlFor="pcamp-ate" error={vLugar.errors.banner_until} hint="Depois dessa data o banner sai sozinho.">
              <V2Input id="pcamp-ate" type="date" min={today} value={f.banner_until}
                onChange={(e) => set({ banner_until: e.target.value })} className="max-w-[12rem]" />
            </V2Field>
          </Secao>
        )}

        {!editando && (
          <Secao n={banner ? 5 : 4} titulo="Aviso no aplicativo" descricao="Chega na hora para o público escolhido, e leva ao mesmo destino do banner.">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-ink" checked={f.notify} onChange={(e) => set({ notify: e.target.checked })} />
              <span className="inline-flex items-center gap-1 text-sm font-bold text-ink"><Bell className="h-4 w-4" aria-hidden /> Avisar pelo aplicativo</span>
            </label>
            {f.notify && (
              <>
                {publicoFalhou ? (
                  <V2ErrorState inline title="Não foi possível carregar o público"
                    description="Sem ele não dá para saber quem recebe o aviso." onRetry={() => publicoQ.refetch()} />
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {PROMO_AUDIENCES_BY_ISSUER[issuer.type].map((a) => {
                      const meta = PROMO_AUDIENCE_META[a];
                      const precisa = Boolean(meta.needs);
                      const quantos = publicoCarregando ? null : destinatariosDe(a, a === f.audience ? f.detail : {}).length;
                      const marcado = f.audience === a;
                      return (
                        <button key={a} type="button" onClick={() => set({ audience: a })} aria-pressed={marcado}
                          className={cn('rounded-2xl border p-3 text-left transition',
                            marcado ? 'border-ink bg-ink/5' : 'border-gray-200 bg-paper-pure hover:border-gray-300')}>
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-bold text-ink">{meta.label}</span>
                            {quantos == null ? <V2Badge tone="neutral">…</V2Badge>
                              : (precisa && !marcado) ? <V2Badge tone="neutral">escolher</V2Badge>
                                : <V2Badge tone={quantos > 0 ? 'green' : 'neutral'}>{pessoas(quantos)}</V2Badge>}
                          </span>
                          <span className="mt-1 block text-xs text-gray-500">{meta.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                <DetalheDoPublico audience={f.audience} detail={f.detail} onChange={(detail) => set({ detail })} />
                <V2Field label="Mensagem" htmlFor="pcamp-msg" required>
                  <V2Textarea id="pcamp-msg" rows={3} maxLength={1000}
                    placeholder="Diga o que é, quando vale e o que a pessoa precisa fazer."
                    value={f.message} onChange={(e) => set({ message: e.target.value })} />
                </V2Field>
              </>
            )}
          </Secao>
        )}

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-gray-100 pt-4">
          <div className="min-w-0 text-xs text-gray-600">
            {falta.length > 0 ? (
              <p><strong className="text-amber-700">Falta:</strong> {[...new Set(falta)].join('; ')}.</p>
            ) : (
              <ul className="space-y-0.5">{resumo.map((l) => <li key={l}>{l}</li>)}</ul>
            )}
          </div>
          <div className="flex gap-2">
            <V2Button variant="ghost" onClick={onClose}>Cancelar</V2Button>
            <V2Button disabled={falta.length > 0 || salvando} onClick={() => setConfirmar(true)}>
              <Send className="mr-1.5 h-4 w-4" aria-hidden /> {editando ? 'Salvar o banner' : 'Publicar campanha'}
            </V2Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmar}
        onOpenChange={setConfirmar}
        title={editando ? 'Salvar o banner?' : 'Publicar esta campanha?'}
        description={resumo.join(' ')}
        confirmLabel={editando ? 'Salvar' : 'Publicar agora'}
        loading={salvando}
        destructive={false}
        onConfirm={enviar}
      />
    </div>
  );
}
