import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { WEEKDAY_SHORT } from '@/modules/arenas/domain/constants';
import { useSaveArenaPricing } from '@/modules/arenas/hooks/useArenas';
import { V2Button, V2Surface, V2Input, V2Textarea } from '@/v2/ui/primitives';
import { useArenaCourts } from '@/modules/arenas/hooks/useArenas';
import { t } from '@/core/i18n';
import { NumberInput } from '@/components/ui/input';

/**
 * Componente nativo V2 de edição dos dados descritivos e de contato da Arena.
 */
export function V2ProfileFields({ form, setField, errors = {} }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="arena-name" className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Nome da arena *')}</label>
        <V2Input
          id="arena-name" value={form.name} onChange={setField('name')} maxLength={120}
          className="bg-paper px-4 py-3"
        />
        {errors.name && <p className="mt-1 text-xs font-bold text-red-500">{t(errors.name)}</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor="arena-desc" className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Descrição')}</label>
        <V2Textarea
          id="arena-desc" value={form.description} onChange={setField('description')} rows={3} maxLength={2000} placeholder={t('Estrutura, quadras, iluminação, estacionamento, etc.')}
          className="bg-paper px-4 py-3"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="arena-address" className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Endereço')}</label>
          <V2Input id="arena-address" value={form.address} onChange={setField('address')} maxLength={240} className="bg-paper px-4 py-3" />
        </div>
        <div className="space-y-2">
          <label htmlFor="arena-neighborhood" className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Bairro')}</label>
          <V2Input id="arena-neighborhood" value={form.neighborhood} onChange={setField('neighborhood')} maxLength={120} className="bg-paper px-4 py-3" />
        </div>
        <div className="space-y-2">
          <label htmlFor="arena-city" className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Cidade')}</label>
          <V2Input id="arena-city" value={form.city} onChange={setField('city')} maxLength={80} className="bg-paper px-4 py-3" />
        </div>
        <div className="space-y-2">
          <label htmlFor="arena-state" className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Estado (UF)')}</label>
          <V2Input id="arena-state" value={form.state} onChange={setField('state')} maxLength={2} placeholder="SP" className="bg-paper px-4 py-3" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="arena-phone" className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Telefone')}</label>
          <V2Input id="arena-phone" value={form.contact_phone} onChange={setField('contact_phone')} maxLength={40} className="bg-paper px-4 py-3" />
        </div>
        <div className="space-y-2">
          <label htmlFor="arena-whatsapp" className="text-2xs font-bold uppercase tracking-widest text-gray-500">WhatsApp</label>
          <V2Input id="arena-whatsapp" value={form.contact_whatsapp} onChange={setField('contact_whatsapp')} maxLength={40} placeholder="(11) 90000-0000" className="bg-paper px-4 py-3" />
        </div>
        <div className="space-y-2">
          <label htmlFor="arena-email" className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('E-mail')}</label>
          <V2Input id="arena-email" type="email" value={form.contact_email} onChange={setField('contact_email')} maxLength={160} className="bg-paper px-4 py-3" />
          {errors.contact_email && <p className="mt-1 text-xs font-bold text-red-500">{t(errors.contact_email)}</p>}
        </div>
        <div className="space-y-2">
          <label htmlFor="arena-instagram" className="text-2xs font-bold uppercase tracking-widest text-gray-500">Instagram</label>
          <V2Input id="arena-instagram" value={form.instagram} onChange={setField('instagram')} placeholder={t('@suaarena')} className="bg-paper px-4 py-3" />
        </div>
        <div className="space-y-2">
          <label htmlFor="arena-website" className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Site')}</label>
          <V2Input id="arena-website" value={form.website} onChange={setField('website')} placeholder="https://..." className="bg-paper px-4 py-3" />
        </div>
        <div className="space-y-2">
          <label htmlFor="arena-courts" className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Nº de quadras')}</label>
          <V2Input id="arena-courts" type="number" min="0" value={form.court_count} onChange={setField('court_count')} className="bg-paper px-4 py-3" />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="arena-hours" className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Horário de funcionamento')}</label>
        <V2Input id="arena-hours" value={form.hours} onChange={setField('hours')} maxLength={400} placeholder={t('Seg–Sex 6h–23h · Sáb–Dom 7h–20h')} className="bg-paper px-4 py-3" />
      </div>

      {/* Sprint 3 ARE-18: Termos de uso / regras da casa */}
      <div className="space-y-2">
        <label htmlFor="arena-house-rules" className="text-2xs font-bold uppercase tracking-widest text-gray-500">
          {t('Regras da casa (público)')}
        </label>
        <V2Textarea
          id="arena-house-rules"
          value={form.house_rules_md || ''}
          onChange={setField('house_rules_md')}
          rows={4}
          maxLength={2000}
          placeholder={t('Regras, política de cancelamento, exigência de uso de equipamento, código de conduta, etc. Aparece na página pública da arena.')}
          className="bg-paper px-4 py-3"
        />
        <p className="text-2xs text-gray-500">
          {(form.house_rules_md || '').length}/2000. {t('Exibido em /arenas/:id → seção "Regras".')}
        </p>
      </div>
    </div>
  );
}

let seq = 0;
const uid = (p) => `${p}_${Date.now()}_${(seq += 1)}`;

/**
 * Componente nativo V2 de edição dos Preços e Exceções da Arena.
 */
export function V2PricingEditor({ arena }) {
  const save = useSaveArenaPricing();
  const [basePrice, setBasePrice] = useState(arena.base_price ?? '');
  const [rules, setRules] = useState((arena.price_rules || []).map((r) => ({ ...r, id: r.id || uid('r') })));
  const [overrides, setOverrides] = useState((arena.price_overrides || []).map((o) => ({ ...o, id: o.id || uid('o') })));

  function addRule() {
    setRules((prev) => [...prev, { id: uid('r'), label: '', weekdays: [], start: '18:00', end: '22:00', price: '' }]);
  }
  function updateRule(id, patch) {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function toggleWeekday(id, day) {
    setRules((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const set = new Set(r.weekdays || []);
      if (set.has(day)) set.delete(day); else set.add(day);
      return { ...r, weekdays: Array.from(set).sort((a, b) => a - b) };
    }));
  }
  function removeRule(id) {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }

  function addOverride() {
    setOverrides((prev) => [...prev, { id: uid('o'), label: '', date: '', client_id: '', price: '', note: '' }]);
  }
  function updateOverride(id, patch) {
    setOverrides((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }
  function removeOverride(id) {
    setOverrides((prev) => prev.filter((o) => o.id !== id));
  }

  async function handleSave() {
    try {
      await save.mutateAsync({
        id: arena.id,
        pricing: { base_price: basePrice, price_rules: rules, price_overrides: overrides },
      });
      toast.success(t('Preços atualizados.'));
    } catch (err) {
      toast.error(err?.message || t('Não foi possível salvar os preços.'));
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="base-price" className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Preço base (fallback)')}</label>
        <NumberInput
          id="base-price" type="number" min="0" step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder={t('Ex.: 80')}
          className="w-40 rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
        />
        <p className="mt-1 text-xs text-gray-500">{t('Usado quando nenhuma regra por dia/horário se aplica.')}</p>
      </div>

      <V2Surface variant="compacto" className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="font-display text-base font-bold text-ink">{t('Preços padrão (por dia e horário)')}</h4>
          <V2Button size="sm" variant="ghost" onClick={addRule}><Plus className="h-4 w-4" /> {t('Regra')}</V2Button>
        </div>
        <div className="space-y-3">
          {rules.length === 0 && <p className="text-xs text-gray-500">{t('Nenhuma regra. Ex.: seg–sex 18h–22h = R$150.')}</p>}
          {rules.map((r) => (
            <div key={r.id} className="rounded-2xl border border-gray-100 bg-paper p-4">
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_SHORT.map((label, day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWeekday(r.id, day)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-xs font-bold transition-colors',
                      (r.weekdays || []).includes(day) ? 'border-ink bg-ink text-white' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
                    )}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Início')}</label>
                  <input type="time" value={r.start} onChange={(e) => updateRule(r.id, { start: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus-visible:border-ink" />
                </div>
                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Fim')}</label>
                  <input type="time" value={r.end} onChange={(e) => updateRule(r.id, { end: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus-visible:border-ink" />
                </div>
                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Preço (R$)')}</label>
                  <NumberInput type="number" min="0" step="0.01" value={r.price} onChange={(e) => updateRule(r.id, { price: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus-visible:border-ink" />
                </div>
                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Rótulo')}</label>
                  <input value={r.label} onChange={(e) => updateRule(r.id, { label: e.target.value })} placeholder={t('Nobre')} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus-visible:border-ink" />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={() => removeRule(r.id)} className="flex items-center gap-1 text-xs font-bold text-gray-500 transition-colors hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" /> {t('Remover')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </V2Surface>

      <V2Surface variant="compacto" className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="font-display text-base font-bold text-ink">{t('Exceções (ocasião ou cliente)')}</h4>
          <V2Button size="sm" variant="ghost" onClick={addOverride}><Plus className="h-4 w-4" /> {t('Exceção')}</V2Button>
        </div>
        <div className="space-y-3">
          {overrides.length === 0 && <p className="text-xs text-gray-500">{t('Ex.: feriado, promoção, ou preço fixo para um cliente.')}</p>}
          {overrides.map((o) => (
            <div key={o.id} className="rounded-2xl border border-gray-100 bg-paper p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Data (opcional)')}</label>
                  <input type="date" value={o.date} onChange={(e) => updateOverride(o.id, { date: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus-visible:border-ink" />
                </div>
                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('ID do cliente')}</label>
                  <input value={o.client_id} onChange={(e) => updateOverride(o.id, { client_id: e.target.value })} placeholder={t('uid do atleta')} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus-visible:border-ink" />
                </div>
                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Preço (R$)')}</label>
                  <NumberInput type="number" min="0" step="0.01" value={o.price} onChange={(e) => updateOverride(o.id, { price: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus-visible:border-ink" />
                </div>
                <div className="space-y-1">
                  <label className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Rótulo')}</label>
                  <input value={o.label} onChange={(e) => updateOverride(o.id, { label: e.target.value })} placeholder={t('Feriado')} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus-visible:border-ink" />
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <input value={o.note} onChange={(e) => updateOverride(o.id, { note: e.target.value })} placeholder={t('Observação (opcional)')} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus-visible:border-ink" />
              </div>
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={() => removeOverride(o.id)} className="flex items-center gap-1 text-xs font-bold text-gray-500 transition-colors hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" /> {t('Remover')}
                </button>
              </div>
            </div>
          ))}
        </div>
      </V2Surface>

      <div className="flex justify-end pt-2">
        <V2Button onClick={handleSave} disabled={save.isPending}>{save.isPending ? t('Salvando…') : t('Salvar preços')}</V2Button>
      </div>
    </div>
  );
}
