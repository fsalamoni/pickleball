/**
 * ⭐ AS ESCOLHAS do avatar: a pessoa, o cabelo, a roupa, os acessórios, a
 * raquete, a pose e o fundo, em abas. Tudo é toque em opção do catálogo —
 * nenhum campo de texto: é dessas escolhas (ids) que o servidor escreve o
 * pedido da imagem.
 *
 * Só as escolhas; quem cria e salva é a página (`V2AvatarStudio`).
 */
import React, { useState } from 'react';
import { Glasses as GlassesIcon, Image as ImageIcon, Play, Shirt, Sparkles, User, Zap } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { t, tk } from '@/core/i18n';
import { V2Badge, V2Surface, V2Toggle } from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import {
  AGES, BACKGROUNDS, BEARDS, BODIES, BOTTOMS, BUILDS, EXPRESSIONS, EYE_COLORS, FACE_SHAPES, FRAMES, GEAR_COLORS,
  GLASSES, HAIR_COLORS, HAIR_STYLES, HEADWEAR, POSES, SKIN_TONES, TOPS,
} from '@/modules/avatar/domain/catalog.js';

const TABS = [
  { value: 'pessoa', label: tk('Pessoa'), icon: User },
  { value: 'cabelo', label: tk('Cabelo'), icon: Sparkles },
  { value: 'roupa', label: tk('Roupa'), icon: Shirt },
  { value: 'acessorios', label: tk('Acessórios'), icon: GlassesIcon },
  { value: 'raquete', label: tk('Raquete'), icon: Zap },
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

/** Cores em bolinhas (radio). `options`: [{ id, label, color }]. */
function Swatches({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            type="button"
            key={o.id}
            role="radio"
            aria-checked={on}
            aria-label={t(o.label)}
            title={t(o.label)}
            onClick={() => onChange(o.id)}
            className={cn(
              'h-11 w-11 rounded-full border-2 transition-transform focus:outline-none focus-visible:ring-4 focus-visible:ring-acid/40',
              on ? 'scale-105 border-ink shadow-md' : 'border-white shadow-sm hover:scale-105',
            )}
            style={{ background: o.color, boxShadow: on ? undefined : 'inset 0 0 0 1px rgba(11,15,25,0.12)' }}
          />
        );
      })}
    </div>
  );
}

function Chips({ options, value, onChange, label }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          type="button"
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

function BrandPaddles({ items, value, onChange, loadError }) {
  if (loadError) return <p className="text-xs text-gray-500">{t('As raquetes de marca não carregaram agora. A raquete de cor segue disponível.')}</p>;
  if (!items.length) return null;
  return (
    <Group title={t('Raquetes de marca')} hint={t('Itens patrocinados por marcas parceiras.')}>
      <div role="radiogroup" aria-label={t('Raquetes de marca')} className="grid gap-2 sm:grid-cols-2">
        {items.map((b) => {
          const on = value === b.id;
          return (
            <button
              type="button"
              key={b.id}
              role="radio"
              aria-checked={on}
              onClick={() => onChange(on ? null : b.id)}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-2xl border-2 bg-paper p-2 text-left transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-acid/40',
                on ? 'border-ink bg-acid/10' : 'border-transparent hover:border-gray-200',
              )}
            >
              <span aria-hidden="true" className="h-12 w-9 shrink-0 rounded-xl border-4" style={{ background: b.color, borderColor: b.color2 }} />
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

/**
 * @param {{ recipe: object, onChange: (patch: object) => void, brandItems?: Array, brandError?: boolean }} props
 */
export default function AvatarStudio({ recipe, onChange, brandItems = [], brandError = false }) {
  const [tab, setTab] = useState('pessoa');
  const tabs = TABS.map((x) => ({ ...x, label: t(x.label) }));
  const field = (name) => (value) => onChange({ [name]: value });
  const chips = (title, options, name, hint) => (
    <Group title={title} hint={hint}><Chips options={options} value={recipe[name]} onChange={field(name)} label={title} /></Group>
  );
  const colors = (title, options, name) => (
    <Group title={title}><Swatches options={options} value={recipe[name]} onChange={field(name)} label={title} /></Group>
  );

  return (
    <div className="min-w-0 space-y-5">
      <V2SubTabs tabs={tabs} activeValue={tab} onSelect={(x) => setTab(x.value)} ariaLabel={t('Partes do avatar')} />
      <V2Surface className="space-y-6 p-5 sm:p-6">
        {tab === 'pessoa' && (
          <>
            {chips(t('Corpo'), BODIES, 'body')}
            {chips(t('Idade'), AGES, 'age')}
            {chips(t('Porte'), BUILDS, 'build')}
            {colors(t('Tom de pele'), SKIN_TONES, 'skin')}
            {chips(t('Formato do rosto'), FACE_SHAPES, 'face')}
            {colors(t('Cor dos olhos'), EYE_COLORS, 'eyeColor')}
            <V2Toggle id="av-freckles" checked={recipe.freckles} onChange={field('freckles')} label={t('Sardas')} />
          </>
        )}
        {tab === 'cabelo' && (
          <>
            {chips(t('Corte'), HAIR_STYLES, 'hair')}
            {recipe.hair !== 'bald' && colors(t('Cor do cabelo'), HAIR_COLORS, 'hairColor')}
            {chips(t('Barba e bigode'), BEARDS, 'beard')}
          </>
        )}
        {tab === 'roupa' && (
          <>
            {chips(t('Parte de cima'), TOPS, 'top')}
            {colors(t('Cor da parte de cima'), GEAR_COLORS, 'topColor')}
            {recipe.top !== 'dress' && (
              <>
                {chips(t('Parte de baixo'), BOTTOMS, 'bottom')}
                {colors(t('Cor da parte de baixo'), GEAR_COLORS, 'bottomColor')}
              </>
            )}
          </>
        )}
        {tab === 'acessorios' && (
          <>
            {chips(t('Na cabeça'), HEADWEAR, 'headwear')}
            {recipe.headwear !== 'none' && colors(t('Cor do acessório da cabeça'), GEAR_COLORS, 'headwearColor')}
            {chips(t('Óculos'), GLASSES, 'glasses')}
          </>
        )}
        {tab === 'raquete' && (
          <>
            <BrandPaddles items={brandItems} value={recipe.paddleBrand} onChange={field('paddleBrand')} loadError={brandError} />
            {recipe.paddleBrand
              ? <p className="rounded-2xl bg-paper p-3 text-sm text-gray-500">{t('Você escolheu uma raquete de marca. Toque nela de novo para voltar à raquete de cor.')}</p>
              : colors(t('Cor da raquete'), GEAR_COLORS, 'paddleColor')}
          </>
        )}
        {tab === 'pose' && (
          <>
            {chips(t('Pose'), POSES, 'pose')}
            {chips(t('Expressão'), EXPRESSIONS, 'expression')}
            {chips(t('Enquadramento'), FRAMES, 'frame', t('No corpo inteiro, a foto do perfil mostra só o rosto.'))}
          </>
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
      </V2Surface>
    </div>
  );
}
