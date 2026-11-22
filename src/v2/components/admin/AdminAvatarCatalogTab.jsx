/**
 * Painel admin → Avatares → Raquetes de marca (flag `avatar_creator`).
 *
 * A raquete de marca é DESENHO (formato, cores e o nome escrito na face),
 * não imagem enviada: assim o avatar continua exportável e leve. Cada item
 * aparece no estúdio com o selo "Patrocinado", só enquanto estiver ligado e
 * dentro das datas. O id nasce de marca + nome e fica gravado na receita de
 * quem escolheu: renomear depois NÃO troca o id (o item segue o mesmo).
 *
 * Grava `platform_settings/avatar_catalog` (regra de sempre: só o admin
 * escreve; todos leem) e registra na auditoria.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Save, Trash2 } from 'lucide-react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { t, tk } from '@/core/i18n';
import {
  V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Toggle,
} from '@/v2/ui/primitives';
import { useAvatarCatalog, useSaveAvatarCatalog } from '@/modules/avatar/hooks/useAvatarCatalog';
import {
  BRAND_ART_IDS, MAX_BRAND_PADDLES, brandItemId, isBrandItemLive, normalizeBrandCatalog,
} from '@/modules/avatar/domain/brandItems.js';
import { PADDLE_SHAPES } from '@/modules/avatar/domain/catalog.js';
import { DEFAULT_RECIPE } from '@/modules/avatar/domain/recipe.js';
import { AvatarSnap } from '@/modules/avatar/components/AvatarSnap.jsx';

const ART_LABEL = { wordmark: tk('Nome da marca'), stripe: tk('Faixa'), split: tk('Duas cores') };
const COLOR_FIELDS = [
  ['color', tk('Face')], ['color2', tk('Segunda cor')], ['edge', tk('Borda')], ['grip', tk('Grip')], ['ink', tk('Letra')],
];

const dayToMs = (d, end) => (d ? new Date(`${d}T${end ? '23:59:59' : '00:00:00'}`).getTime() : null);
const msToDay = (ms) => {
  if (!ms) return '';
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

function Preview({ item }) {
  const recipe = useMemo(() => ({ ...DEFAULT_RECIPE, pose: 'celebrate', paddleBrand: item.id || 'brand_preview' }), [item.id]);
  const items = useMemo(() => [{ ...item, id: item.id || 'brand_preview' }], [item]);
  return (
    <span className="block h-32 w-32 shrink-0 overflow-hidden rounded-2xl bg-paper">
      <AvatarSnap recipe={recipe} view="paddle" brandItems={items} />
    </span>
  );
}

function ItemEditor({ item, onChange, onRemove }) {
  const set = (patch) => onChange({ ...item, ...patch });
  const live = isBrandItemLive(item);
  const fid = (k) => `av-brand-${item.key}-${k}`;
  return (
    <V2Surface variant="compacto" className="flex flex-col gap-4 sm:flex-row">
      <Preview item={item} />
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <V2Badge tone={live ? 'green' : 'neutral'}>{live ? t('No ar') : item.active ? t('Fora das datas') : t('Desligada')}</V2Badge>
          <V2Button variant="ghost" size="sm" onClick={onRemove}><Trash2 className="h-4 w-4" />{t('Tirar da lista')}</V2Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <V2Field label={t('Marca')} htmlFor={fid('brand')} required>
            <V2Input id={fid('brand')} value={item.brand} maxLength={30} onChange={(e) => set({ brand: e.target.value })} />
          </V2Field>
          <V2Field label={t('Modelo')} htmlFor={fid('name')} required>
            <V2Input id={fid('name')} value={item.name} maxLength={40} onChange={(e) => set({ name: e.target.value })} />
          </V2Field>
          <V2Field label={t('Escrito na face')} htmlFor={fid('wordmark')} hint={t('Até 14 letras.')}>
            <V2Input id={fid('wordmark')} value={item.wordmark} maxLength={14} onChange={(e) => set({ wordmark: e.target.value })} />
          </V2Field>
          <V2Field label={t('Formato')} htmlFor={fid('shape')}>
            <V2Select id={fid('shape')} value={item.shape} onChange={(e) => set({ shape: e.target.value })}>
              {PADDLE_SHAPES.map((s) => <option key={s.id} value={s.id}>{t(s.label)}</option>)}
            </V2Select>
          </V2Field>
          <V2Field label={t('Arte')} htmlFor={fid('art')}>
            <V2Select id={fid('art')} value={item.art} onChange={(e) => set({ art: e.target.value })}>
              {BRAND_ART_IDS.map((a) => <option key={a} value={a}>{t(ART_LABEL[a])}</option>)}
            </V2Select>
          </V2Field>
          <V2Field label={t('Site da marca')} htmlFor={fid('link')} hint={t('Opcional. Só endereço https.')}>
            <V2Input id={fid('link')} type="url" value={item.link_url} onChange={(e) => set({ link_url: e.target.value })} />
          </V2Field>
        </div>
        <div className="flex flex-wrap gap-4">
          {COLOR_FIELDS.map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm font-semibold text-ink">
              <input type="color" value={item[k]} onChange={(e) => set({ [k]: e.target.value })} className="h-11 w-11 cursor-pointer rounded-xl border border-gray-200 bg-paper-pure p-1" />
              {t(label)}
            </label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <V2Field label={t('Começa em')} htmlFor={fid('start')}>
            <V2Input id={fid('start')} type="date" value={msToDay(item.starts_ms)} onChange={(e) => set({ starts_ms: dayToMs(e.target.value, false) })} />
          </V2Field>
          <V2Field label={t('Termina em')} htmlFor={fid('end')}>
            <V2Input id={fid('end')} type="date" value={msToDay(item.ends_ms)} onChange={(e) => set({ ends_ms: dayToMs(e.target.value, true) })} />
          </V2Field>
          <V2Toggle id={fid('active')} checked={item.active} onChange={(v) => set({ active: v })} label={t('Ligada')} />
        </div>
      </div>
    </V2Surface>
  );
}

let seq = 0;
const withKey = (item) => ({ ...item, key: `k${seq += 1}` });

export default function AdminAvatarCatalogTab() {
  const { user } = useAuth();
  const catalog = useAvatarCatalog();
  const save = useSaveAvatarCatalog();
  const [list, setList] = useState(null);

  useEffect(() => {
    if (catalog.isSuccess && list === null) setList(catalog.data.brand_paddles.map(withKey));
  }, [catalog.isSuccess, catalog.data, list]);

  if (catalog.isError) return <V2ErrorState onRetry={catalog.refetch} />;
  if (!list) return <V2Skeleton className="h-64 rounded-3xl" />;

  const update = (key, next) => setList((l) => l.map((x) => (x.key === key ? next : x)));
  const add = () => setList((l) => [...l, withKey({
    id: '', brand: '', name: '', wordmark: '', shape: 'standard', art: 'wordmark',
    color: '#0b0f19', color2: '#d4f82e', edge: '#0b0f19', grip: '#1f2937', ink: '#ffffff',
    link_url: '', active: true, starts_ms: null, ends_ms: null,
  })]);
  const incomplete = list.some((x) => !x.brand.trim() || !x.name.trim());

  const onSave = async () => {
    // O id nasce no primeiro salvamento e não muda mais (está nas receitas de quem escolheu).
    const out = normalizeBrandCatalog(list.map(({ key: _key, ...x }) => ({ ...x, id: x.id || brandItemId(x.brand, x.name) })));
    try {
      const saved = await save.mutateAsync({ list: out, actor: user });
      setList(saved.map(withKey));
      toast.success(t('Raquetes de marca salvas.'));
    } catch (err) {
      toast.error(err?.message || t('Não deu para salvar agora. Tente de novo.'));
    }
  };

  return (
    <div className="space-y-5">
      <V2Surface variant="compacto" className="space-y-2">
        <h2 className="font-display text-lg font-bold text-ink">{t('Raquetes de marca')}</h2>
        <p className="text-sm text-gray-500">
          {t('Raquetes patrocinadas que as pessoas podem escolher no avatar. Aparecem com o selo "Patrocinado", só ligadas e dentro das datas. Quem já escolheu uma raquete que saiu do ar volta para a própria raquete.')}
        </p>
      </V2Surface>
      {list.length === 0 && <p className="text-sm text-gray-500">{t('Nenhuma raquete de marca cadastrada.')}</p>}
      {list.map((item) => (
        <ItemEditor key={item.key} item={item} onChange={(next) => update(item.key, next)} onRemove={() => setList((l) => l.filter((x) => x.key !== item.key))} />
      ))}
      <div className="flex flex-wrap gap-2">
        <V2Button variant="secondary" onClick={add} disabled={list.length >= MAX_BRAND_PADDLES}><Plus className="h-4 w-4" />{t('Nova raquete de marca')}</V2Button>
        <V2Button onClick={onSave} disabled={save.isPending || incomplete}><Save className="h-4 w-4" />{t('Salvar')}</V2Button>
      </div>
      {incomplete && <p className="text-xs text-gray-500">{t('Preencha marca e modelo de todas para salvar.')}</p>}
    </div>
  );
}
