/**
 * A ARTE do cupom, no formulário do cupom (Onda CD).
 *
 * Duas origens, como no banner:
 *  - **Modelo** — os cinco da plataforma e os da arena, em miniatura; um
 *    toque escolhe. "Personalizar" abre textos e cores. Título e texto em
 *    branco usam o benefício e a descrição do próprio cupom (a arte nunca
 *    desmente o cupom — nem quando o desconto muda depois);
 *  - **Imagem** — a especificação antes do botão, a imagem conferida antes de
 *    subir, e a prévia no tíquete. O código NÃO vai na imagem: ele fica no
 *    canhoto, copiável, e nunca fica desatualizado.
 *
 * "Salvar como meu modelo" guarda o desenho em `arena_settings.coupon_templates`;
 * os cinco da plataforma nunca mudam.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Paintbrush, Palette, Save, SlidersHorizontal, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  COUPON_ART_SOURCE, COUPON_ART_TEMPLATES, COUPON_TEXT_LIMITS, COUPON_UPLOAD_SPEC, DEFAULT_COUPON_TEMPLATE_ID,
  couponDesignFromTemplate, couponTemplate, couponUploadGuide, normalizeCouponArtDesign,
  removeArenaCouponTemplate, saveArenaCouponTemplate, switchCouponTemplate, withArenaCouponColors,
} from '@/modules/arenas/domain/couponArt';
import { isArenaTemplateId } from '@/modules/arenas/domain/bannerArt';
import { useArenaCouponTemplates, useSaveArenaCouponTemplates } from '@/modules/arenas/hooks/useCouponArt';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Input } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import BannerUploader from '../campaigns/BannerUploader';
import CouponArt from './CouponArt';

/** A largura em que a miniatura é desenhada antes de reduzir (ver `Miniatura`). */
const BASE = 460;

/**
 * Uma miniatura de modelo: o tíquete de verdade, desenhado largo e reduzido
 * (`zoom`) — desenhado direto em 180 px, ele viraria o tíquete estreito e não
 * pareceria o que vai ao ar.
 */
function Miniatura({ nome, design, ativo, seu, onClick, amostra }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      aria-label={`Modelo ${nome}`}
      className={cn(
        'w-[188px] shrink-0 snap-start rounded-2xl border-2 p-1 text-left transition',
        ativo ? 'border-ink' : 'border-transparent hover:border-gray-300',
      )}
    >
      <span aria-hidden className="block overflow-hidden rounded-xl" style={{ width: 176 }}>
        <span className="block" style={{ width: BASE, zoom: 176 / BASE }}>
          <CouponArt art={{ source: 'design', design }} code={amostra.code} benefit={amostra.benefit} notch="bg-paper-pure" />
        </span>
      </span>
      <span className="mt-1 flex items-center gap-1 px-1 text-xs font-bold text-ink">
        <span className="truncate">{nome}</span>
        {seu && <V2Badge tone="acid" className="px-1.5 py-0 text-[10px]">seu</V2Badge>}
      </span>
    </button>
  );
}

function Contador({ valor, max }) {
  const n = String(valor || '').length;
  return <span className={cn('text-[11px]', n >= max ? 'text-amber-700' : 'text-gray-400')}>{n}/{max}</span>;
}

function CampoCor({ id, label, valor, onChange }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-paper-pure px-3 py-2">
      <input id={id} type="color" value={valor} onChange={(e) => onChange(e.target.value)}
        className="h-7 w-9 cursor-pointer rounded border-0 bg-transparent p-0" />
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-ink">{label}</span>
        <span className="block font-mono text-[11px] uppercase text-gray-500">{valor}</span>
      </span>
    </label>
  );
}

/**
 * @param {{
 *   arenaId: string, arena?: object,
 *   value: object|null,             // a arte (null = Clássico, o padrão)
 *   onChange: (art: object) => void,
 *   amostra: { code: string, benefit: string, description: string },
 * }} props
 */
export default function CouponArtEditor({ arenaId, arena, value, onChange, amostra }) {
  const modelosQ = useArenaCouponTemplates(arenaId);
  const salvarModelos = useSaveArenaCouponTemplates();
  const meus = useMemo(() => modelosQ.data || [], [modelosQ.data]);
  const [personalizar, setPersonalizar] = useState(false);
  const [nomeNovo, setNomeNovo] = useState('');
  const [salvandoComo, setSalvandoComo] = useState(false);
  const [confirmarApagar, setConfirmarApagar] = useState(false);

  const origem = value?.source === COUPON_ART_SOURCE.UPLOAD ? COUPON_ART_SOURCE.UPLOAD : COUPON_ART_SOURCE.DESIGN;
  const templateId = value?.source === COUPON_ART_SOURCE.DESIGN ? (value.template_id || null) : (value ? null : DEFAULT_COUPON_TEMPLATE_ID);
  const design = value?.source === COUPON_ART_SOURCE.DESIGN
    ? value.design
    : couponDesignFromTemplate(couponTemplate(DEFAULT_COUPON_TEMPLATE_ID));
  const verif = normalizeCouponArtDesign(design);
  const corDaMarca = arena?.branding?.primary_color || '';
  const modeloAtual = isArenaTemplateId(templateId)
    ? meus.find((t) => t.id === templateId)?.design || null
    : couponTemplate(templateId)?.design || null;

  const porDesenho = (template_id, d) => onChange({ source: COUPON_ART_SOURCE.DESIGN, template_id, design: d });
  const escolher = (id, desenhoDoModelo) => porDesenho(id, switchCouponTemplate(design, modeloAtual, desenhoDoModelo));
  const muda = (campo, v) => porDesenho(templateId, { ...design, [campo]: v });

  const gravar = async (lista, msg) => {
    try {
      await salvarModelos.mutateAsync({ arenaId, list: lista });
      toast.success(msg);
      return true;
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar o modelo.');
      return false;
    }
  };
  const salvarComoNovo = async () => {
    const r = saveArenaCouponTemplate(meus, { name: nomeNovo, design: verif.value });
    if (r.error) { toast.error(r.error); return; }
    if (await gravar(r.list, `Modelo "${r.saved.name}" salvo. Os da plataforma continuam lá.`)) {
      porDesenho(r.saved.id, r.saved.design);
      setNomeNovo('');
      setSalvandoComo(false);
    }
  };
  const atualizar = async () => {
    const atual = meus.find((t) => t.id === templateId);
    if (!atual) return;
    const r = saveArenaCouponTemplate(meus, { id: atual.id, name: atual.name, design: verif.value });
    if (r.error) { toast.error(r.error); return; }
    await gravar(r.list, `Modelo "${atual.name}" atualizado.`);
  };
  const apagar = async () => {
    const atual = meus.find((t) => t.id === templateId);
    if (!atual) return;
    if (await gravar(removeArenaCouponTemplate(meus, atual.id), `Modelo "${atual.name}" apagado.`)) {
      porDesenho(null, verif.value);
    }
  };

  const upload = value?.source === COUPON_ART_SOURCE.UPLOAD ? value : {};
  const ehMeu = isArenaTemplateId(templateId) && meus.some((t) => t.id === templateId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="De onde vem a arte do cupom">
        {[[COUPON_ART_SOURCE.DESIGN, Paintbrush, 'Usar um modelo'], [COUPON_ART_SOURCE.UPLOAD, ImagePlus, 'Enviar a minha imagem']].map(([k, Icone, rotulo]) => (
          <button key={k} type="button" role="radio" aria-checked={origem === k}
            onClick={() => (k === origem ? null : k === COUPON_ART_SOURCE.UPLOAD
              ? onChange({ source: COUPON_ART_SOURCE.UPLOAD, image_url: '', alt: '' })
              : porDesenho(DEFAULT_COUPON_TEMPLATE_ID, couponDesignFromTemplate(couponTemplate(DEFAULT_COUPON_TEMPLATE_ID))))}
            className={cn('inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition sm:text-sm',
              origem === k ? 'border-ink bg-ink text-white' : 'border-gray-200 bg-paper-pure text-gray-600 hover:border-ink')}>
            <Icone className="h-4 w-4" aria-hidden /> {rotulo}
          </button>
        ))}
      </div>

      {origem === COUPON_ART_SOURCE.DESIGN ? (
        <>
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-400">Modelos da plataforma</p>
            <div className="-mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1">
              {COUPON_ART_TEMPLATES.map((t) => (
                <Miniatura key={t.id} nome={t.name} design={t.design} amostra={amostra} ativo={templateId === t.id}
                  onClick={() => escolher(t.id, t.design)} />
              ))}
            </div>
            {modelosQ.isError ? (
              <V2ErrorState inline className="mt-2" title="Não foi possível carregar os seus modelos"
                description="Os da plataforma continuam aqui." onRetry={() => modelosQ.refetch()} />
            ) : meus.length > 0 && (
              <>
                <p className="mb-1.5 mt-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">Meus modelos</p>
                <div className="-mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1">
                  {meus.map((t) => (
                    <Miniatura key={t.id} nome={t.name} design={t.design} amostra={amostra} seu ativo={templateId === t.id}
                      onClick={() => escolher(t.id, t.design)} />
                  ))}
                </div>
              </>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-sm font-semibold text-ink">Como fica</p>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <CouponArt art={{ source: 'design', design: verif.value }} code={amostra.code || 'CODIGO'}
                benefit={amostra.benefit} description={amostra.description} arenaName={arena?.name || ''} notch="bg-paper" />
              <div className="mx-auto w-full max-w-[330px]">
                <CouponArt art={{ source: 'design', design: verif.value }} code={amostra.code || 'CODIGO'}
                  benefit={amostra.benefit} description={amostra.description} arenaName={arena?.name || ''} notch="bg-paper" />
              </div>
            </div>
            {verif.warnings.map((w) => (
              <p key={w} className="mt-1.5 rounded-xl bg-amber-50 px-3 py-1.5 text-xs text-amber-800">{w}</p>
            ))}
          </div>

          <button type="button" onClick={() => setPersonalizar((v) => !v)} aria-expanded={personalizar}
            className="inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline">
            <SlidersHorizontal className="h-3.5 w-3.5" /> {personalizar ? 'Fechar a personalização' : 'Personalizar textos e cores'}
          </button>

          {personalizar && (
            <div className="space-y-3 rounded-2xl border border-gray-100 bg-paper-pure p-3">
              {[
                ['cup-art-chamada', 'Chamada', 'kicker', 'Cupom'],
                ['cup-art-titulo', 'Título', 'title', `Em branco: ${amostra.benefit || 'o benefício do cupom'}`],
                ['cup-art-texto', 'Texto', 'subtitle', `Em branco: ${amostra.description || 'a descrição do cupom'}`],
              ].map(([id, label, campo, ph]) => (
                <V2Field key={id} htmlFor={id}
                  label={<span className="flex w-full items-center justify-between gap-2"><span>{label}</span><Contador valor={design[campo]} max={COUPON_TEXT_LIMITS[campo]} /></span>}>
                  <V2Input id={id} maxLength={COUPON_TEXT_LIMITS[campo]} value={design[campo] || ''} placeholder={ph}
                    onChange={(e) => muda(campo, e.target.value)} />
                </V2Field>
              ))}
              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">Cores</span>
                  {corDaMarca && (
                    <button type="button" onClick={() => porDesenho(templateId, withArenaCouponColors(design, corDaMarca))}
                      className="inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline">
                      <Palette className="h-3.5 w-3.5" /> Usar a cor da arena
                    </button>
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <CampoCor id="cup-art-fundo" label="Fundo" valor={verif.value.bg} onChange={(v) => muda('bg', v)} />
                  <CampoCor id="cup-art-letra" label="Texto" valor={verif.value.fg} onChange={(v) => muda('fg', v)} />
                  <CampoCor id="cup-art-canhoto" label="Canhoto do código" valor={verif.value.accent} onChange={(v) => muda('accent', v)} />
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-gray-200 p-3">
                {ehMeu && (
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <V2Button type="button" size="sm" variant="secondary" disabled={salvarModelos.isPending} onClick={atualizar}>
                      <Save className="h-4 w-4" /> Atualizar o modelo
                    </V2Button>
                    <V2Button type="button" size="sm" variant="ghost" disabled={salvarModelos.isPending} onClick={() => setConfirmarApagar(true)}>
                      <Trash2 className="h-4 w-4" /> Apagar o modelo
                    </V2Button>
                  </div>
                )}
                {salvandoComo ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <V2Field label="Nome do modelo" htmlFor="cup-art-modelo" className="min-w-[12rem] flex-1">
                      <V2Input id="cup-art-modelo" maxLength={40} value={nomeNovo} autoFocus placeholder="Vale da recepção"
                        onChange={(e) => setNomeNovo(e.target.value)} />
                    </V2Field>
                    <V2Button type="button" size="sm" disabled={!nomeNovo.trim() || salvarModelos.isPending} onClick={salvarComoNovo}>
                      Salvar
                    </V2Button>
                    <V2Button type="button" size="sm" variant="ghost" onClick={() => setSalvandoComo(false)}>Cancelar</V2Button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setSalvandoComo(true)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline">
                    <Save className="h-3.5 w-3.5" /> Salvar como meu modelo
                  </button>
                )}
                <p className="mt-1 text-[11px] text-gray-500">Os modelos da plataforma nunca mudam — salvar cria um modelo seu.</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <BannerUploader
          value={upload}
          onChange={(patch) => onChange({ ...upload, ...patch, source: COUPON_ART_SOURCE.UPLOAD })}
          spec={COUPON_UPLOAD_SPEC}
          guide={couponUploadGuide()}
          folder="arena-coupons"
          diagram={false}
          altPlaceholder="1 água de coco grátis a partir do quinto jogo."
          preview={(v) => (
            <div>
              <p className="mb-1 text-xs font-bold text-gray-500">Como fica (o código entra no canhoto, copiável)</p>
              <CouponArt art={{ source: COUPON_ART_SOURCE.UPLOAD, image_url: v.image_url, alt: v.alt }}
                code={amostra.code || 'CODIGO'} notch="bg-paper" />
            </div>
          )}
        />
      )}

      <ConfirmDialog
        open={confirmarApagar}
        onOpenChange={setConfirmarApagar}
        title="Apagar este modelo?"
        description="Some da lista “Meus modelos”. Os cupons que já usam este desenho continuam como estão."
        confirmLabel="Apagar o modelo"
        destructive
        onConfirm={async () => { await apagar(); setConfirmarApagar(false); }}
      />
    </div>
  );
}
