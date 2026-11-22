/**
 * ⭐ O ESTÚDIO do avatar: palco com o avatar vivo, em 3D, à esquerda (no
 * celular, em cima) e as escolhas por assunto à direita. O avatar gira com o
 * dedo e anima ao toque. Cada escolha de formato mostra o PRÓPRIO avatar com
 * aquela opção (como o Memoji), não um ícone genérico.
 *
 * Só desenha; quem salva é a página (`V2AvatarStudio`), que recebe `onSave`.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dices, Glasses as GlassesIcon, Image as ImageIcon, Palette, Play, Redo2, Rotate3d, Shirt, Smile, Sparkles, Undo2, User, Zap,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { t, tk } from '@/core/i18n';
import { V2Badge, V2Button, V2Surface, V2Toggle } from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import { Avatar3D } from '@/modules/avatar/components/Avatar3D.jsx';
import { AvatarSnap } from '@/modules/avatar/components/AvatarSnap.jsx';
import {
  BACKGROUNDS, BALL_COLORS, BEARDS, BOTTOMS, BROWS, CHEST_MARKS, EXPRESSIONS, EYE_COLORS, EYE_SHAPES, FACE_SHAPES,
  GEAR_COLORS, GLASSES, HAIR_COLORS, HAIR_STYLES, HEADWEAR, NOSES, PADDLE_ARTS, PADDLE_SHAPES, POSES, SKIN_TONES,
  SOCKS, TOP_PATTERNS, TOPS,
} from '@/modules/avatar/domain/catalog.js';
import { normalizeRecipe, randomRecipe } from '@/modules/avatar/domain/recipe.js';
import { webglAvailable } from '@/modules/avatar/three/support.js';

const TABS = [
  { value: 'rosto', label: tk('Rosto'), icon: User },
  { value: 'cabelo', label: tk('Cabelo'), icon: Sparkles },
  { value: 'expressao', label: tk('Expressão'), icon: Smile },
  { value: 'roupa', label: tk('Roupa'), icon: Shirt },
  { value: 'raquete', label: tk('Raquete'), icon: Zap },
  { value: 'acessorios', label: tk('Acessórios'), icon: GlassesIcon },
  { value: 'pose', label: tk('Pose'), icon: Play },
  { value: 'fundo', label: tk('Fundo'), icon: ImageIcon },
];

function Group({ title, children, hint }) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-bold text-ink">{title}</legend>
      {hint && <p className="-mt-2 text-xs text-gray-500">{hint}</p>}
      {children}
    </fieldset>
  );
}

/** Cores em bolinhas (radio). `options`: [{ id, label, color }] ou ['#hex']. */
function Swatches({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const id = typeof o === 'string' ? o : o.id;
        const color = typeof o === 'string' ? o : o.color;
        const name = typeof o === 'string' ? o : t(o.label);
        const on = value === id;
        return (
          <button type="button"
            key={id}
            role="radio"
            aria-checked={on}
            aria-label={name}
            title={name}
            onClick={() => onChange(id)}
            className={cn(
              'h-11 w-11 rounded-full border-2 transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-acid/40',
              on ? 'scale-105 border-ink shadow-md' : 'border-white shadow-sm hover:scale-105',
            )}
            style={{ background: color, boxShadow: on ? undefined : 'inset 0 0 0 1px rgba(11,15,25,0.12)' }}
          />
        );
      })}
    </div>
  );
}

/** Opções desenhadas com o próprio avatar (uma foto do 3D por opção). */
const Thumb = AvatarSnap;

function Thumbs({ options, field, recipe, onChange, view = 'face', label, brandItems, extra, tall = false }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('grid gap-2', tall ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-4 sm:grid-cols-5')}>
      {options.map((o) => {
        const on = recipe[field] === o.id;
        return (
          <button type="button"
            key={o.id}
            role="radio"
            aria-checked={on}
            onClick={() => onChange({ [field]: o.id, ...(extra?.(o) || {}) })}
            className={cn(
              'group flex flex-col items-center gap-1 rounded-2xl border-2 bg-paper p-1.5 text-center transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-acid/40',
              on ? 'border-ink bg-acid/10' : 'border-transparent hover:border-gray-200',
            )}
          >
            <span className={cn('block w-full overflow-hidden', tall ? 'aspect-[34/52] rounded-xl' : 'aspect-square rounded-full')}>
              <Thumb recipe={{ ...recipe, [field]: o.id, ...(extra?.(o) || {}) }} view={view} brandItems={brandItems} />
            </span>
            <span className="line-clamp-1 text-xs font-semibold text-ink">{t(o.label)}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Escolhas simples por texto (quando a miniatura não acrescenta). */
function Chips({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button type="button"
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-acid/40',
            value === o.id ? 'border-ink bg-ink text-white' : 'border-gray-200 bg-paper-pure text-ink hover:border-ink/40',
          )}
        >
          {t(o.label)}
        </button>
      ))}
    </div>
  );
}

function BrandPaddles({ items, recipe, onChange, loadError }) {
  if (loadError) return <p className="text-xs text-gray-500">{t('As raquetes de marca não carregaram agora. As da PickleRush seguem disponíveis.')}</p>;
  if (!items.length) return null;
  return (
    <Group title={t('Raquetes de marca')} hint={t('Itens patrocinados por marcas parceiras.')}>
      <div role="radiogroup" aria-label={t('Raquetes de marca')} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((b) => {
          const on = recipe.paddleBrand === b.id;
          return (
            <button type="button"
              key={b.id}
              role="radio"
              aria-checked={on}
              onClick={() => onChange({ paddleBrand: on ? null : b.id })}
              className={cn(
                'flex items-center gap-2 rounded-2xl border-2 bg-paper p-2 text-left transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-acid/40',
                on ? 'border-ink bg-acid/10' : 'border-transparent hover:border-gray-200',
              )}
            >
              <span className="block h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                <Thumb recipe={{ ...recipe, paddleBrand: b.id, pose: 'celebrate' }} view="paddle" brandItems={items} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-ink">{b.brand}</span>
                <span className="block truncate text-xs text-gray-500">{b.name}</span>
                <V2Badge tone="amber" className="mt-1 px-2 py-0.5 text-2xs">{t('Patrocinado')}</V2Badge>
              </span>
            </button>
          );
        })}
      </div>
    </Group>
  );
}

/** O que o palco mostra enquanto o 3D baixa, ou onde o aparelho não o desenha. */
function StageFallback({ image }) {
  if (image) return <img src={image} alt="" className="h-full w-full object-cover" />;
  return (
    <span className="max-w-xs rounded-2xl bg-paper-pure/85 px-4 py-3 text-center text-sm font-semibold text-ink">
      {webglAvailable() ? t('Preparando o seu avatar…') : t('Este aparelho não desenha o avatar em 3D. Tente em outro navegador ou aparelho.')}
    </span>
  );
}

const HISTORY_MAX = 60;

/**
 * @param {{ initialRecipe?:object, brandItems?:Array, brandError?:boolean,
 *   onChange?:(r:object)=>void, savedImage?:string|null, footer?:React.ReactNode }} props
 * `savedImage`: a imagem já salva, mostrada onde o aparelho não desenha em 3D.
 */
export default function AvatarStudio({ initialRecipe, brandItems = [], brandError = false, onChange, savedImage = null, footer }) {
  const brandIds = useMemo(() => brandItems.map((b) => b.id), [brandItems]);
  const [history, setHistory] = useState(() => ({ list: [normalizeRecipe(initialRecipe, { brandIds })], at: 0 }));
  const recipe = history.list[history.at];
  const [tab, setTab] = useState('rosto');
  const tabs = TABS.map((x) => ({ ...x, label: t(x.label) }));
  const [view, setView] = useState('full');
  const live = useRef(null);
  const play = () => live.current?.play();
  const rnd = useRef(Math.random);

  useEffect(() => { onChange?.(recipe); }, [recipe, onChange]);

  const set = useCallback((patch) => {
    setHistory((h) => {
      const next = normalizeRecipe({ ...h.list[h.at], ...patch }, { brandIds });
      const list = [...h.list.slice(0, h.at + 1), next].slice(-HISTORY_MAX);
      return { list, at: list.length - 1 };
    });
  }, [brandIds]);
  const undo = () => setHistory((h) => ({ ...h, at: Math.max(0, h.at - 1) }));
  const redo = () => setHistory((h) => ({ ...h, at: Math.min(h.list.length - 1, h.at + 1) }));
  const field = (name) => (value) => set({ [name]: value });

  const surprise = (only) => set(randomRecipe(rnd.current, { base: recipe, only }));

  const bg = BACKGROUNDS.find((b) => b.id === recipe.background) || BACKGROUNDS[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Palco. No celular ele fica preso no alto enquanto as escolhas rolam por baixo (a pessoa
          vê o avatar mudar ao tocar numa opção); o botão de salvar vai para o fim. */}
      <div className="contents lg:sticky lg:top-4 lg:block lg:self-start">
        <V2Surface className="sticky top-0 z-20 order-1 overflow-hidden p-0 shadow-lg sm:p-0 lg:static lg:shadow-none">
          <div className="relative mx-auto h-[40vh] min-h-[260px] w-full lg:aspect-[34/52] lg:h-auto lg:max-h-[70vh]" style={{ background: `linear-gradient(${bg.from}, ${bg.to})` }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <Avatar3D
                ref={live}
                recipe={recipe}
                view={view}
                brandItems={brandItems}
                label={t('Seu avatar')}
                fallback={<StageFallback image={savedImage} />}
                className={cn(
                  'block overflow-hidden focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-acid/50',
                  view === 'full' ? 'h-full w-full' : 'aspect-square w-[86%] rounded-full shadow-xl ring-4 ring-white/70',
                )}
              />
            </div>
            <p className="pointer-events-none absolute right-3 top-3 flex min-h-11 items-center gap-1.5 rounded-full bg-paper-pure/85 px-3 text-xs font-semibold text-ink shadow-sm backdrop-blur" aria-hidden="true">
              <Rotate3d className="h-3.5 w-3.5" />{t('Arraste para girar')}
            </p>
            <div className="absolute left-3 top-3 flex gap-1 rounded-full bg-paper-pure/90 p-1 shadow-sm backdrop-blur" role="radiogroup" aria-label={t('Visualização')}>
              {[['full', t('Corpo')], ['bust', t('Foto')]].map(([v, l]) => (
                <button type="button"
                  key={v}
                  role="radio"
                  aria-checked={view === v}
                  onClick={() => setView(v)}
                  className={cn('min-h-9 rounded-full px-3 text-xs font-bold coarse:min-h-11', view === v ? 'bg-ink text-white' : 'text-ink')}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 p-2 sm:p-3">
            <div className="flex gap-1">
              <V2Button variant="ghost" size="icon" onClick={undo} disabled={history.at === 0} aria-label={t('Desfazer')} title={t('Desfazer')}><Undo2 className="h-4 w-4" /></V2Button>
              <V2Button variant="ghost" size="icon" onClick={redo} disabled={history.at >= history.list.length - 1} aria-label={t('Refazer')} title={t('Refazer')}><Redo2 className="h-4 w-4" /></V2Button>
            </div>
            <div className="flex gap-2">
              <V2Button variant="ghost" size="sm" onClick={play} aria-label={t('Animar')}><Play className="h-4 w-4" /><span className="hidden sm:inline">{t('Animar')}</span></V2Button>
              <V2Button variant="secondary" size="sm" onClick={() => surprise('all')}><Dices className="h-4 w-4" />{t('Surpreenda-me')}</V2Button>
            </div>
          </div>
        </V2Surface>
        <div className="order-3 lg:order-none">{footer}</div>
      </div>

      {/* Escolhas */}
      <div className="order-2 min-w-0 space-y-5 lg:order-none">
        <V2SubTabs tabs={tabs} activeValue={tab} onSelect={(x) => setTab(x.value)} ariaLabel={t('Partes do avatar')} />
        <V2Surface className="space-y-6 p-5 sm:p-6">
          {tab === 'rosto' && (
            <>
              <Group title={t('Tom de pele')}><Swatches options={SKIN_TONES} value={recipe.skin} onChange={field('skin')} label={t('Tom de pele')} /></Group>
              <Group title={t('Formato do rosto')}><Thumbs options={FACE_SHAPES} field="face" recipe={recipe} onChange={set} label={t('Formato do rosto')} brandItems={brandItems} /></Group>
              <Group title={t('Olhos')}><Thumbs options={EYE_SHAPES} field="eyes" recipe={recipe} onChange={set} label={t('Olhos')} brandItems={brandItems} /></Group>
              <Group title={t('Cor dos olhos')}><Swatches options={EYE_COLORS} value={recipe.eyeColor} onChange={field('eyeColor')} label={t('Cor dos olhos')} /></Group>
              <Group title={t('Sobrancelhas')}><Chips options={BROWS} value={recipe.brows} onChange={field('brows')} label={t('Sobrancelhas')} /></Group>
              <Group title={t('Nariz')}><Chips options={NOSES} value={recipe.nose} onChange={field('nose')} label={t('Nariz')} /></Group>
              <div className="space-y-3">
                <V2Toggle id="av-cheeks" checked={recipe.cheeks} onChange={field('cheeks')} label={t('Bochechas rosadas')} />
                <V2Toggle id="av-freckles" checked={recipe.freckles} onChange={field('freckles')} label={t('Sardas')} />
              </div>
            </>
          )}
          {tab === 'cabelo' && (
            <>
              <Group title={t('Corte')}><Thumbs options={HAIR_STYLES} field="hair" recipe={{ ...recipe, headwear: 'none' }} onChange={set} label={t('Corte')} brandItems={brandItems} /></Group>
              <Group title={t('Cor do cabelo')}><Swatches options={HAIR_COLORS} value={recipe.hairColor} onChange={field('hairColor')} label={t('Cor do cabelo')} /></Group>
              <Group title={t('Barba e bigode')}><Thumbs options={BEARDS} field="beard" recipe={{ ...recipe, headwear: 'none' }} onChange={set} label={t('Barba e bigode')} brandItems={brandItems} /></Group>
            </>
          )}
          {tab === 'expressao' && (
            <Group title={t('Expressão')} hint={t('Muda olhos, sobrancelhas e boca juntos.')}>
              <Thumbs options={EXPRESSIONS} field="expression" recipe={recipe} onChange={set} label={t('Expressão')} brandItems={brandItems} />
            </Group>
          )}
          {tab === 'roupa' && (
            <>
              <Group title={t('Parte de cima')}><Chips options={TOPS} value={recipe.top} onChange={field('top')} label={t('Parte de cima')} /></Group>
              <Group title={t('Cor principal')}><Swatches options={GEAR_COLORS} value={recipe.topColor} onChange={field('topColor')} label={t('Cor principal')} /></Group>
              <Group title={t('Cor de destaque')}><Swatches options={GEAR_COLORS} value={recipe.topColor2} onChange={field('topColor2')} label={t('Cor de destaque')} /></Group>
              <Group title={t('Estampa')}><Chips options={TOP_PATTERNS} value={recipe.topPattern} onChange={field('topPattern')} label={t('Estampa')} /></Group>
              <Group title={t('No peito')}>
                <Chips options={CHEST_MARKS} value={recipe.chestMark} onChange={field('chestMark')} label={t('No peito')} />
                {recipe.chestMark === 'number' && (
                  <label className="mt-2 flex items-center gap-3 text-sm font-semibold text-ink">
                    {t('Número')}
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      value={recipe.chestNumber}
                      onChange={(e) => set({ chestNumber: e.target.value })}
                      className="h-11 w-20 rounded-xl border border-gray-200 bg-paper-pure px-3 text-center text-base font-bold focus:border-ink focus:outline-none"
                    />
                  </label>
                )}
              </Group>
              {recipe.top !== 'dress' && (
                <>
                  <Group title={t('Parte de baixo')}><Chips options={BOTTOMS} value={recipe.bottom} onChange={field('bottom')} label={t('Parte de baixo')} /></Group>
                  <Group title={t('Cor da parte de baixo')}><Swatches options={GEAR_COLORS} value={recipe.bottomColor} onChange={field('bottomColor')} label={t('Cor da parte de baixo')} /></Group>
                </>
              )}
              <Group title={t('Meias')}>
                <Chips options={SOCKS} value={recipe.socks} onChange={field('socks')} label={t('Meias')} />
                <Swatches options={GEAR_COLORS} value={recipe.socksColor} onChange={field('socksColor')} label={t('Cor das meias')} />
              </Group>
              <Group title={t('Tênis')}><Swatches options={GEAR_COLORS} value={recipe.shoesColor} onChange={field('shoesColor')} label={t('Cor do tênis')} /></Group>
              <V2Toggle id="av-wrist" checked={recipe.wristband} onChange={field('wristband')} label={t('Munhequeira')} hint={t('Na cor de destaque da roupa.')} />
            </>
          )}
          {tab === 'raquete' && (
            <>
              <BrandPaddles items={brandItems} recipe={recipe} onChange={set} loadError={brandError} />
              {recipe.paddleBrand ? (
                <p className="rounded-2xl bg-paper p-3 text-sm text-gray-500">
                  {t('Você está usando uma raquete de marca. Toque nela de novo para voltar a personalizar a sua.')}
                </p>
              ) : (
                <>
                  <Group title={t('Formato')}><Thumbs options={PADDLE_SHAPES} field="paddleShape" recipe={{ ...recipe, pose: 'celebrate' }} onChange={set} view="paddle" label={t('Formato')} brandItems={brandItems} /></Group>
                  <Group title={t('Arte')}><Thumbs options={PADDLE_ARTS} field="paddleArt" recipe={{ ...recipe, pose: 'celebrate' }} onChange={set} view="paddle" label={t('Arte')} brandItems={brandItems} /></Group>
                  <Group title={t('Cor da face')}><Swatches options={GEAR_COLORS} value={recipe.paddleColor} onChange={field('paddleColor')} label={t('Cor da face')} /></Group>
                  <Group title={t('Segunda cor')}><Swatches options={GEAR_COLORS} value={recipe.paddleColor2} onChange={field('paddleColor2')} label={t('Segunda cor')} /></Group>
                  <Group title={t('Borda')}><Swatches options={GEAR_COLORS} value={recipe.paddleEdge} onChange={field('paddleEdge')} label={t('Borda')} /></Group>
                  <Group title={t('Grip')}><Swatches options={GEAR_COLORS} value={recipe.paddleGrip} onChange={field('paddleGrip')} label={t('Grip')} /></Group>
                </>
              )}
              <Group title={t('Bola')}><Swatches options={BALL_COLORS} value={recipe.ball} onChange={field('ball')} label={t('Bola')} /></Group>
            </>
          )}
          {tab === 'acessorios' && (
            <>
              <Group title={t('Na cabeça')}><Thumbs options={HEADWEAR} field="headwear" recipe={recipe} onChange={set} label={t('Na cabeça')} brandItems={brandItems} /></Group>
              {recipe.headwear !== 'none' && <Group title={t('Cor')}><Swatches options={GEAR_COLORS} value={recipe.headwearColor} onChange={field('headwearColor')} label={t('Cor do acessório da cabeça')} /></Group>}
              <Group title={t('Óculos')}><Thumbs options={GLASSES} field="glasses" recipe={recipe} onChange={set} label={t('Óculos')} brandItems={brandItems} /></Group>
              {recipe.glasses !== 'none' && <Group title={t('Cor da armação')}><Swatches options={GEAR_COLORS} value={recipe.glassesColor} onChange={field('glassesColor')} label={t('Cor da armação')} /></Group>}
            </>
          )}
          {tab === 'pose' && (
            <Group title={t('Pose')} hint={t('Toque no avatar para ver o movimento de cada pose.')}>
              <Thumbs options={POSES} field="pose" recipe={recipe} onChange={set} view="full" tall label={t('Pose')} brandItems={brandItems} />
            </Group>
          )}
          {tab === 'fundo' && (
            <Group title={t('Fundo')}>
              <Swatches
                options={BACKGROUNDS.map((b) => ({ ...b, color: `linear-gradient(${b.from}, ${b.to})` }))}
                value={recipe.background}
                onChange={field('background')}
                label={t('Fundo')}
              />
            </Group>
          )}
          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            <V2Button variant="subtle" size="sm" onClick={() => surprise('look')}><Palette className="h-4 w-4" />{t('Sortear só o visual')}</V2Button>
          </div>
        </V2Surface>
      </div>

    </div>
  );
}
