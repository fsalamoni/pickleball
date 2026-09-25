/**
 * Criar o banner NA PLATAFORMA (Onda CC): escolher um modelo, trocar os
 * textos e as cores, ver como fica — e, se quiser, guardar como modelo da
 * arena.
 *
 * - Os cinco modelos da plataforma nunca mudam: editar e salvar cria um
 *   modelo DA ARENA. "Meus modelos" ficam ao lado, com atualizar e apagar.
 * - Trocar de modelo muda o visual e MANTÉM os textos que a pessoa escreveu
 *   (`switchTemplate`) — senão experimentar modelos apagaria o trabalho.
 * - A pré-visualização mostra o banner no computador (2:1) e no celular
 *   (16:9), porque é assim que ele vai aparecer.
 * - Pouco contraste é AVISO, com a razão escrita; a arena decide.
 */
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Monitor, Palette, Save, Smartphone, Trash2 } from 'lucide-react';
import { ImageUpload } from '@/components/ui/image-upload';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  ART_LAYOUT, BANNER_TEMPLATES, BANNER_TEXT_LIMITS, isArenaTemplateId, normalizeBannerDesign,
  platformTemplate, removeArenaTemplate, saveArenaTemplate, switchTemplate, withArenaColors,
} from '@/modules/arenas/domain/bannerArt';
import { useArenaBannerTemplates, useSaveArenaBannerTemplates } from '@/modules/arenas/hooks/useCampaignBanners';
import { V2Badge, V2Button, V2ErrorState, V2Field, V2Input } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import BannerArt from './BannerArt';
import BannerThumb from './BannerThumb';

const ROTULO_DESTAQUE = {
  [ART_LAYOUT.OFERTA]: { label: 'Número em destaque', placeholder: '20% OFF' },
  [ART_LAYOUT.EVENTO]: { label: 'Data em destaque', placeholder: '18 OUT' },
};

function Contador({ valor, max }) {
  const n = String(valor || '').length;
  return <span className={cn('text-[11px]', n >= max ? 'text-amber-700' : 'text-gray-400')}>{n}/{max}</span>;
}

function CampoTexto({ id, label, campo, design, onCampo, placeholder, hint, required }) {
  const max = BANNER_TEXT_LIMITS[campo];
  return (
    <V2Field
      label={(
        <span className="flex w-full items-center justify-between gap-2">
          <span>{label}{required && <span className="text-acid-dark"> *</span>}</span>
          <Contador valor={design[campo]} max={max} />
        </span>
      )}
      htmlFor={id} hint={hint}>
      <V2Input id={id} maxLength={max} value={design[campo] || ''} placeholder={placeholder}
        onChange={(e) => onCampo(campo, e.target.value)} />
    </V2Field>
  );
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

/** Uma miniatura de modelo, para escolher. */
function Miniatura({ id, nome, design, ativo, seu, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      aria-label={`Modelo ${nome}`}
      className={cn(
        'shrink-0 snap-start rounded-2xl border-2 p-1 text-left transition',
        ativo ? 'border-ink' : 'border-transparent hover:border-gray-300',
      )}
      data-template={id}
    >
      <BannerThumb banner={{ source: 'design', design }} cta={design.cta} width={176} />
      <span className="mt-1 flex w-[176px] items-center gap-1 px-1 text-xs font-bold text-ink">
        <span className="truncate">{nome}</span>
        {seu && <V2Badge tone="acid" className="px-1.5 py-0 text-[10px]">seu</V2Badge>}
      </span>
    </button>
  );
}

/**
 * @param {{
 *   arenaId: string, arena?: object,
 *   templateId: string|null, design: object,
 *   onChange: (next: { template_id: string|null, design: object }) => void,
 *   cta: string,
 * }} props
 */
export default function BannerDesigner({ arenaId, arena, templateId, design, onChange, cta }) {
  const modelosQ = useArenaBannerTemplates(arenaId);
  const salvarModelos = useSaveArenaBannerTemplates();
  const meus = useMemo(() => modelosQ.data || [], [modelosQ.data]);
  const [nomeNovo, setNomeNovo] = useState('');
  const [salvandoComo, setSalvandoComo] = useState(false);
  const [previa, setPrevia] = useState('wide');
  const [confirmarApagar, setConfirmarApagar] = useState(false);

  const verif = normalizeBannerDesign(design);
  const corDaMarca = arena?.branding?.primary_color || '';
  const modeloAtual = isArenaTemplateId(templateId)
    ? meus.find((t) => t.id === templateId)?.design || null
    : platformTemplate(templateId)?.design || null;

  const escolher = (id, desenhoDoModelo) => {
    onChange({ template_id: id, design: switchTemplate(design, modeloAtual, desenhoDoModelo) });
  };
  const muda = (campo, valor) => onChange({ template_id: templateId, design: { ...design, [campo]: valor } });

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
    const r = saveArenaTemplate(meus, { name: nomeNovo, design: verif.value });
    if (r.error) { toast.error(r.error); return; }
    if (await gravar(r.list, `Modelo "${r.saved.name}" salvo. Os modelos da plataforma continuam lá.`)) {
      onChange({ template_id: r.saved.id, design: r.saved.design });
      setNomeNovo('');
      setSalvandoComo(false);
    }
  };
  const atualizar = async () => {
    const atual = meus.find((t) => t.id === templateId);
    if (!atual) return;
    const r = saveArenaTemplate(meus, { id: atual.id, name: atual.name, design: verif.value });
    if (r.error) { toast.error(r.error); return; }
    await gravar(r.list, `Modelo "${atual.name}" atualizado.`);
  };
  const apagar = async () => {
    const atual = meus.find((t) => t.id === templateId);
    if (!atual) return;
    if (await gravar(removeArenaTemplate(meus, atual.id), `Modelo "${atual.name}" apagado.`)) {
      onChange({ template_id: null, design: verif.value });
    }
  };

  const destaque = ROTULO_DESTAQUE[design.layout];

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-gray-400">Modelos da plataforma</p>
        <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
          {BANNER_TEMPLATES.map((t) => (
            <Miniatura key={t.id} id={t.id} nome={t.name} design={t.design} ativo={templateId === t.id}
              onClick={() => escolher(t.id, t.design)} />
          ))}
        </div>
        {modelosQ.isError ? (
          <V2ErrorState inline className="mt-2" title="Não foi possível carregar os seus modelos"
            description="Os da plataforma continuam aqui." onRetry={() => modelosQ.refetch()} />
        ) : meus.length > 0 && (
          <>
            <p className="mb-2 mt-3 text-xs font-bold uppercase tracking-widest text-gray-400">Meus modelos</p>
            <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
              {meus.map((t) => (
                <Miniatura key={t.id} id={t.id} nome={t.name} design={t.design} seu ativo={templateId === t.id}
                  onClick={() => escolher(t.id, t.design)} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-3">
          <CampoTexto id="ban-chamada" label="Chamada" campo="kicker" design={design} onCampo={muda}
            placeholder="Nesta semana" hint="Uma linha curta em cima do título." />
          <CampoTexto id="ban-titulo" label="Título" campo="title" design={design} onCampo={muda} required
            placeholder="Quadra livre à noite" />
          <CampoTexto id="ban-texto" label="Texto" campo="subtitle" design={design} onCampo={muda}
            placeholder="O que é, quando vale e o que fazer." />
          {destaque && (
            <CampoTexto id="ban-destaque" label={destaque.label} campo="highlight" design={design} onCampo={muda}
              placeholder={destaque.placeholder} />
          )}
          <CampoTexto id="ban-botao" label="Texto do botão" campo="cta" design={design} onCampo={muda}
            placeholder={cta} hint="Em branco, usa o do destino escolhido." />

          <div>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-ink">Cores</span>
              {corDaMarca && (
                <button type="button" onClick={() => onChange({ template_id: templateId, design: withArenaColors(design, corDaMarca) })}
                  className="inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline">
                  <Palette className="h-3.5 w-3.5" /> Usar a cor da arena
                </button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <CampoCor id="ban-fundo" label="Fundo" valor={verif.value.bg} onChange={(v) => muda('bg', v)} />
              <CampoCor id="ban-letra" label="Texto" valor={verif.value.fg} onChange={(v) => muda('fg', v)} />
              <CampoCor id="ban-acento" label="Destaque e botão" valor={verif.value.accent} onChange={(v) => muda('accent', v)} />
            </div>
          </div>

          {design.layout === ART_LAYOUT.VITRINE && (
            <div>
              <span className="text-sm font-semibold text-ink">Foto</span>
              <p className="mb-2 text-xs text-gray-500">Aparece à direita. Uma foto quadrada ou em pé funciona melhor.</p>
              <ImageUpload
                value={design.image_url || ''}
                folder="arena-banners"
                label="Enviar foto"
                onChange={(url, meta) => onChange({
                  template_id: templateId,
                  design: { ...design, image_url: url || '', image_path: meta?.path || '' },
                })}
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-ink">Como fica</span>
            <div className="inline-flex rounded-full border border-gray-200 bg-paper-pure p-0.5" role="group" aria-label="Pré-visualização">
              {[['wide', Monitor, 'Computador'], ['phone', Smartphone, 'Celular']].map(([k, Icone, rotulo]) => (
                <button key={k} type="button" aria-pressed={previa === k} onClick={() => setPrevia(k)}
                  className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold',
                    previa === k ? 'bg-ink text-white' : 'text-gray-500')}>
                  <Icone className="h-3.5 w-3.5" aria-hidden /> {rotulo}
                </button>
              ))}
            </div>
          </div>
          <div className={cn('mx-auto', previa === 'phone' ? 'max-w-[340px]' : 'w-full')}>
            <BannerArt banner={{ source: 'design', design: verif.value }} ratio={previa} cta={design.cta || cta}
              arenaName={arena?.name || ''} />
          </div>
          {verif.warnings.length > 0 && (
            <ul className="space-y-1">
              {verif.warnings.map((w) => (
                <li key={w} className="rounded-xl bg-amber-50 px-3 py-1.5 text-xs text-amber-800">{w}</li>
              ))}
            </ul>
          )}

          <div className="rounded-2xl border border-dashed border-gray-200 p-3">
            {isArenaTemplateId(templateId) && meus.some((t) => t.id === templateId) ? (
              <div className="flex flex-wrap items-center gap-2">
                <V2Button size="sm" variant="secondary" disabled={salvarModelos.isPending || !verif.valid} onClick={atualizar}>
                  <Save className="h-4 w-4" /> Atualizar o modelo
                </V2Button>
                <V2Button size="sm" variant="ghost" disabled={salvarModelos.isPending} onClick={() => setConfirmarApagar(true)}>
                  <Trash2 className="h-4 w-4" /> Apagar o modelo
                </V2Button>
              </div>
            ) : null}
            {salvandoComo ? (
              <div className="mt-2 flex flex-wrap items-end gap-2 first:mt-0">
                <V2Field label="Nome do modelo" htmlFor="ban-modelo-nome" className="min-w-[12rem] flex-1">
                  <V2Input id="ban-modelo-nome" maxLength={40} value={nomeNovo} autoFocus
                    placeholder="Terças de promoção" onChange={(e) => setNomeNovo(e.target.value)} />
                </V2Field>
                <V2Button size="sm" disabled={!nomeNovo.trim() || salvarModelos.isPending || !verif.valid} onClick={salvarComoNovo}>
                  Salvar
                </V2Button>
                <V2Button size="sm" variant="ghost" onClick={() => setSalvandoComo(false)}>Cancelar</V2Button>
              </div>
            ) : (
              <button type="button" onClick={() => setSalvandoComo(true)} disabled={!verif.valid}
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-ink hover:underline disabled:opacity-50 first:mt-0">
                <Save className="h-3.5 w-3.5" /> Salvar como meu modelo
              </button>
            )}
            <p className="mt-1 text-[11px] text-gray-500">Os modelos da plataforma nunca mudam — salvar cria um modelo seu.</p>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmarApagar}
        onOpenChange={setConfirmarApagar}
        title="Apagar este modelo?"
        description="Some da lista “Meus modelos”. Os banners já publicados com ele continuam no ar, e o desenho aberto aqui não se perde."
        confirmLabel="Apagar o modelo"
        destructive
        onConfirm={async () => { await apagar(); setConfirmarApagar(false); }}
      />
    </div>
  );
}
