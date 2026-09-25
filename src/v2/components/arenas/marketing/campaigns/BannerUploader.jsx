/**
 * Enviar a PRÓPRIA arte do banner (Onda CC).
 *
 * *"…caso em que deve ter expressas referências para o tamanho do banner e
 * demais detalhes que sejam importantes."* A especificação vem ANTES do
 * botão de enviar, e não num texto miúdo: tamanho, proporção, mínimo,
 * formatos, peso e área segura, com um desenho da área segura. Depois, a
 * imagem é CONFERIDA antes de subir (`checkBannerImage`): pequena demais não
 * sobe; proporção diferente sobe com aviso de onde vai cortar.
 *
 * A pré-visualização mostra o recorte do computador (2:1) e do celular
 * (16:9), com a área segura por cima — é onde a arena vê se o logo vai sumir.
 * A descrição da imagem é obrigatória: é o que o leitor de tela lê.
 */
import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Info, Loader2, Monitor, Smartphone } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { uploadImage } from '@/core/services/storageService';
import {
  BANNER_UPLOAD_SPEC, bannerUploadGuide, checkBannerImage,
} from '@/modules/arenas/domain/bannerArt';
import { BANNER_ALT_MAX } from '@/modules/arenas/domain/campaignBanner';
import { V2Button, V2Field, V2Textarea } from '@/v2/ui/primitives';
import { cn } from '@/core/lib/utils';
import BannerArt from './BannerArt';

/** Largura e altura de uma imagem local, sem subir nada. */
function medir(file) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
      img.onerror = () => { resolve({ width: 0, height: 0 }); URL.revokeObjectURL(url); };
      img.src = url;
    } catch {
      resolve({ width: 0, height: 0 });
    }
  });
}

/** O desenho da área segura, para quem nunca ouviu falar nela. */
function DiagramaAreaSegura() {
  const { safeArea } = BANNER_UPLOAD_SPEC;
  return (
    <div className="relative mx-auto aspect-[2/1] w-full max-w-[260px] rounded-lg border-2 border-ink bg-paper" aria-hidden>
      <div className="absolute inset-y-0 left-[5.5%] right-[5.5%] border-x-2 border-dotted border-gray-400" />
      <div
        className="absolute flex items-center justify-center rounded border-2 border-dashed border-ink/70 bg-acid/30 text-[10px] font-bold text-ink"
        style={{
          left: `${((1 - safeArea.width) / 2) * 100}%`,
          right: `${((1 - safeArea.width) / 2) * 100}%`,
          top: `${((1 - safeArea.height) / 2) * 100}%`,
          bottom: `${((1 - safeArea.height) / 2) * 100}%`,
        }}
      >
        área segura: texto e logo aqui
      </div>
      <span className="absolute -bottom-5 left-0 right-0 text-center text-[10px] text-gray-500">
        pontilhado: o que o celular mostra (16:9)
      </span>
    </div>
  );
}

/**
 * @param {{
 *   value: object, onChange: (patch: object) => void,
 *   spec?: object, guide?: Array<{label: string, value: string}>, folder?: string,
 *   preview?: (value: object) => React.ReactNode, diagram?: boolean, altPlaceholder?: string,
 * }} props
 *   value: { image_url, image_path, width, height, alt }
 *   `spec`/`guide`/`folder`/`preview` servem à arte do CUPOM (Onda CD); sem
 *   eles, é o envio do banner de sempre.
 */
export default function BannerUploader({
  value = {}, onChange, spec = BANNER_UPLOAD_SPEC, guide, folder = 'arena-banners', preview, diagram = true,
  altPlaceholder = 'Terça e quinta com 20% de desconto na reserva, das 7h às 17h.',
}) {
  const { user } = useAuth();
  const inputRef = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [conferencia, setConferencia] = useState(null);

  const escolher = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const { width, height } = await medir(file);
    const r = checkBannerImage({ width, height, bytes: file.size, type: file.type }, spec);
    setConferencia({ ...r, width, height });
    if (!r.ok) return;
    setEnviando(true);
    setProgresso(0);
    try {
      const meta = await uploadImage(file, { uid: user?.uid, folder, onProgress: setProgresso });
      onChange({ image_url: meta.url, image_path: meta.path, width, height });
      toast.success('Imagem enviada. Confira o recorte abaixo.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível enviar a imagem.');
    } finally {
      setEnviando(false);
    }
  };

  const banner = { source: 'upload', image_url: value.image_url, alt: value.alt };

  return (
    <div className="space-y-4">
      <div className={cn('grid gap-4 rounded-2xl border border-gray-100 bg-paper p-4', diagram && 'sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]')}>
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
            <Info className="h-4 w-4 shrink-0" aria-hidden /> Antes de enviar: como a imagem deve ser
          </p>
          <dl className="mt-2 space-y-1.5 text-xs">
            {(guide || bannerUploadGuide(spec)).map((l) => (
              <div key={l.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
                <dt className="font-bold text-ink">{l.label}</dt>
                <dd className="text-gray-600">{l.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        {diagram && (
          <div className="pb-5">
            <DiagramaAreaSegura />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input ref={inputRef} type="file" accept={spec.mimeTypes.join(',')} className="hidden"
          onChange={escolher} aria-label="Escolher a imagem do banner" />
        <V2Button type="button" variant="secondary" disabled={enviando} onClick={() => inputRef.current?.click()}>
          {enviando
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando {progresso}%</>
            : <><ImagePlus className="h-4 w-4" /> {value.image_url ? 'Trocar a imagem' : 'Escolher a imagem'}</>}
        </V2Button>
        {value.width && value.height ? (
          <span className="text-xs text-gray-500">Imagem atual: {value.width} × {value.height} px</span>
        ) : null}
      </div>

      {conferencia && (conferencia.errors.length > 0 || conferencia.warnings.length > 0) && (
        <ul className="space-y-1" aria-live="polite">
          {conferencia.errors.map((m) => (
            <li key={m} className="rounded-xl bg-red-50 px-3 py-1.5 text-xs text-red-700">{m} A imagem não foi enviada.</li>
          ))}
          {conferencia.warnings.map((m) => (
            <li key={m} className="rounded-xl bg-amber-50 px-3 py-1.5 text-xs text-amber-800">{m}</li>
          ))}
        </ul>
      )}

      {value.image_url && preview && preview(value)}
      {value.image_url && !preview && (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div>
            <p className="mb-1 flex items-center gap-1 text-xs font-bold text-gray-500"><Monitor className="h-3.5 w-3.5" /> No computador (2:1)</p>
            <BannerArt banner={banner} ratio="wide" safeArea />
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1 text-xs font-bold text-gray-500"><Smartphone className="h-3.5 w-3.5" /> No celular (16:9)</p>
            <BannerArt banner={banner} ratio="phone" safeArea />
          </div>
        </div>
      )}

      <V2Field label="Descrição da imagem" htmlFor="ban-alt" required
        hint="Escreva o que a imagem diz — é o que o leitor de tela lê, e o que aparece se ela não carregar.">
        <V2Textarea id="ban-alt" rows={2} maxLength={BANNER_ALT_MAX} value={value.alt || ''}
          placeholder={altPlaceholder}
          onChange={(e) => onChange({ alt: e.target.value })} />
      </V2Field>
    </div>
  );
}
