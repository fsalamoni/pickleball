import React, { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/core/lib/utils';
import { WEEKDAY_SHORT } from '../domain/constants.js';
import { useSaveArenaPricing } from '../hooks/useArenas.js';

let seq = 0;
const uid = (p) => `${p}_${Date.now()}_${(seq += 1)}`;

export default function PricingEditor({ arena }) {
  const save = useSaveArenaPricing();
  const [basePrice, setBasePrice] = useState(arena.base_price ?? '');
  const [rules, setRules] = useState(
    (arena.price_rules || []).map((r) => ({ ...r, id: r.id || uid('r') })),
  );
  const [overrides, setOverrides] = useState(
    (arena.price_overrides || []).map((o) => ({ ...o, id: o.id || uid('o') })),
  );

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
    <div className="space-y-5">
      <div>
        <Label htmlFor="base-price">Preço base (fallback)</Label>
        <Input
          id="base-price"
          type="number"
          min="0"
          step="0.01"
          value={basePrice}
          onChange={(e) => setBasePrice(e.target.value)}
          className="w-40"
          placeholder="Ex.: 80"
        />
        <p className="mt-1 text-xs text-slate-500">Usado quando nenhuma regra por dia/horário se aplica.</p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-800">Preços padrão (por dia e horário)</h4>
          <Button size="sm" variant="outline" onClick={addRule}><Plus className="h-4 w-4" /> <span className="ml-1">Regra</span></Button>
        </div>
        <div className="space-y-3">
          {rules.length === 0 && <p className="text-xs text-slate-500">Nenhuma regra. Ex.: seg–sex 18h–22h = R$150.</p>}
          {rules.map((r) => (
            <div key={r.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_SHORT.map((label, day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleWeekday(r.id, day)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs font-medium',
                      (r.weekdays || []).includes(day) ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 text-slate-600',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <Label className="text-xs">Início</Label>
                  <Input type="time" value={r.start} onChange={(e) => updateRule(r.id, { start: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Fim</Label>
                  <Input type="time" value={r.end} onChange={(e) => updateRule(r.id, { end: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Preço (R$)</Label>
                  <Input type="number" min="0" step="0.01" value={r.price} onChange={(e) => updateRule(r.id, { price: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Rótulo</Label>
                  <Input value={r.label} onChange={(e) => updateRule(r.id, { label: e.target.value })} placeholder="Nobre" />
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => removeRule(r.id)} className="text-red-600">
                  <Trash2 className="h-4 w-4" /> <span className="ml-1">Remover</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-800">Exceções (ocasião ou cliente)</h4>
          <Button size="sm" variant="outline" onClick={addOverride}><Plus className="h-4 w-4" /> <span className="ml-1">Exceção</span></Button>
        </div>
        <div className="space-y-3">
          {overrides.length === 0 && <p className="text-xs text-slate-500">Ex.: feriado, promoção, ou preço fixo para um cliente.</p>}
          {overrides.map((o) => (
            <div key={o.id} className="rounded-lg border border-slate-200 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div>
                  <Label className="text-xs">Data (opcional)</Label>
                  <Input type="date" value={o.date} onChange={(e) => updateOverride(o.id, { date: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">ID do cliente (opcional)</Label>
                  <Input value={o.client_id} onChange={(e) => updateOverride(o.id, { client_id: e.target.value })} placeholder="uid do atleta" />
                </div>
                <div>
                  <Label className="text-xs">Preço (R$)</Label>
                  <Input type="number" min="0" step="0.01" value={o.price} onChange={(e) => updateOverride(o.id, { price: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Rótulo</Label>
                  <Input value={o.label} onChange={(e) => updateOverride(o.id, { label: e.target.value })} placeholder="Feriado" />
                </div>
              </div>
              <Input className="mt-2" value={o.note} onChange={(e) => updateOverride(o.id, { note: e.target.value })} placeholder="Observação (opcional)" />
              <div className="mt-2 flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => removeOverride(o.id)} className="text-red-600">
                  <Trash2 className="h-4 w-4" /> <span className="ml-1">Remover</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={save.isPending}>{save.isPending ? 'Salvando…' : 'Salvar preços'}</Button>
      </div>
    </div>
  );
}
