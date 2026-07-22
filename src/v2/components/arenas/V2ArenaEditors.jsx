import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { WEEKDAY_SHORT } from '@/modules/arenas/domain/constants';
import { useSaveArenaPricing } from '@/modules/arenas/hooks/useArenas';
import { V2Button } from '@/v2/ui/primitives';
import { useArenaCourts } from '@/modules/arenas/hooks/useArenas';

/**
 * Componente nativo V2 de edição dos dados descritivos e de contato da Arena.
 */
export function V2ProfileFields({ form, setField, errors = {} }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="arena-name" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Nome da arena *</label>
        <input
          id="arena-name" value={form.name} onChange={setField('name')} maxLength={120}
          className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
        />
        {errors.name && <p className="mt-1 text-xs font-bold text-red-500">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor="arena-desc" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Descrição</label>
        <textarea
          id="arena-desc" value={form.description} onChange={setField('description')} rows={3} maxLength={2000} placeholder="Estrutura, quadras, iluminação, estacionamento, etc."
          className="w-full resize-y rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="arena-address" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Endereço</label>
          <input id="arena-address" value={form.address} onChange={setField('address')} maxLength={240} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
        </div>
        <div className="space-y-2">
          <label htmlFor="arena-neighborhood" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Bairro</label>
          <input id="arena-neighborhood" value={form.neighborhood} onChange={setField('neighborhood')} maxLength={120} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
        </div>
        <div className="space-y-2">
          <label htmlFor="arena-city" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Cidade</label>
          <input id="arena-city" value={form.city} onChange={setField('city')} maxLength={80} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
        </div>
        <div className="space-y-2">
          <label htmlFor="arena-state" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Estado (UF)</label>
          <input id="arena-state" value={form.state} onChange={setField('state')} maxLength={2} placeholder="SP" className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="arena-phone" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Telefone</label>
          <input id="arena-phone" value={form.contact_phone} onChange={setField('contact_phone')} maxLength={40} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
        </div>
        <div className="space-y-2">
          <label htmlFor="arena-whatsapp" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">WhatsApp</label>
          <input id="arena-whatsapp" value={form.contact_whatsapp} onChange={setField('contact_whatsapp')} maxLength={40} placeholder="(11) 90000-0000" className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
        </div>
        <div className="space-y-2">
          <label htmlFor="arena-email" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">E-mail</label>
          <input id="arena-email" type="email" value={form.contact_email} onChange={setField('contact_email')} maxLength={160} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
          {errors.contact_email && <p className="mt-1 text-xs font-bold text-red-500">{errors.contact_email}</p>}
        </div>
        <div className="space-y-2">
          <label htmlFor="arena-instagram" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Instagram</label>
          <input id="arena-instagram" value={form.instagram} onChange={setField('instagram')} placeholder="@suaarena" className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
        </div>
        <div className="space-y-2">
          <label htmlFor="arena-website" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Site</label>
          <input id="arena-website" value={form.website} onChange={setField('website')} placeholder="https://..." className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
        </div>
        <div className="space-y-2">
          <label htmlFor="arena-courts" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Nº de quadras</label>
          <input id="arena-courts" type="number" min="0" value={form.court_count} onChange={setField('court_count')} className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="arena-hours" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Horário de funcionamento</label>
        <input id="arena-hours" value={form.hours} onChange={setField('hours')} maxLength={400} placeholder="Seg–Sex 6h–23h · Sáb–Dom 7h–20h" className="w-full rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30" />
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
      toast.success('Preços atualizados.');
    } catch (err) {
      toast.error(err?.message || 'Não foi possível salvar os preços.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="base-price" className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Preço base (fallback)</label>
        <input
          id="base-price" type="number" min="0" step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="Ex.: 80"
          className="w-40 rounded-2xl border border-gray-200 bg-paper px-4 py-3 text-sm text-ink outline-none focus-visible:ring-4 focus-visible:ring-acid/30"
        />
        <p className="mt-1 text-xs text-gray-500">Usado quando nenhuma regra por dia/horário se aplica.</p>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="font-display text-base font-bold text-ink">Preços padrão (por dia e horário)</h4>
          <V2Button size="sm" variant="ghost" onClick={addRule}><Plus className="h-4 w-4" /> Regra</V2Button>
        </div>
        <div className="space-y-3">
          {rules.length === 0 && <p className="text-xs text-gray-500">Nenhuma regra. Ex.: seg–sex 18h–22h = R$150.</p>}
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
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Início</label>
                  <input type="time" value={r.start} onChange={(e) => updateRule(r.id, { start: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus-visible:border-ink" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Fim</label>
                  <input type="time" value={r.end} onChange={(e) => updateRule(r.id, { end: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus-visible:border-ink" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Preço (R$)</label>
                  <input type="number" min="0" step="0.01" value={r.price} onChange={(e) => updateRule(r.id, { price: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus-visible:border-ink" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Rótulo</label>
                  <input value={r.label} onChange={(e) => updateRule(r.id, { label: e.target.value })} placeholder="Nobre" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus-visible:border-ink" />
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={() => removeRule(r.id)} className="flex items-center gap-1 text-xs font-bold text-gray-400 transition-colors hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" /> Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-paper-pure p-5 shadow-organic-sm">
        <div className="mb-4 flex items-center justify-between">
          <h4 className="font-display text-base font-bold text-ink">Exceções (ocasião ou cliente)</h4>
          <V2Button size="sm" variant="ghost" onClick={addOverride}><Plus className="h-4 w-4" /> Exceção</V2Button>
        </div>
        <div className="space-y-3">
          {overrides.length === 0 && <p className="text-xs text-gray-500">Ex.: feriado, promoção, ou preço fixo para um cliente.</p>}
          {overrides.map((o) => (
            <div key={o.id} className="rounded-2xl border border-gray-100 bg-paper p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Data (opcional)</label>
                  <input type="date" value={o.date} onChange={(e) => updateOverride(o.id, { date: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus-visible:border-ink" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">ID do cliente</label>
                  <input value={o.client_id} onChange={(e) => updateOverride(o.id, { client_id: e.target.value })} placeholder="uid do atleta" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus-visible:border-ink" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Preço (R$)</label>
                  <input type="number" min="0" step="0.01" value={o.price} onChange={(e) => updateOverride(o.id, { price: e.target.value })} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus-visible:border-ink" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Rótulo</label>
                  <input value={o.label} onChange={(e) => updateOverride(o.id, { label: e.target.value })} placeholder="Feriado" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus-visible:border-ink" />
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <input value={o.note} onChange={(e) => updateOverride(o.id, { note: e.target.value })} placeholder="Observação (opcional)" className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus-visible:border-ink" />
              </div>
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={() => removeOverride(o.id)} className="flex items-center gap-1 text-xs font-bold text-gray-400 transition-colors hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" /> Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <V2Button onClick={handleSave} disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar preços'}</V2Button>
      </div>
    </div>
  );
}
