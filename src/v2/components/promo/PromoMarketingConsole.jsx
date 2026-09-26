/**
 * A DIVULGAÇÃO de um emissor — plataforma ou professor (Onda CG): cupons e
 * campanhas, com as mesmas ferramentas do marketing da arena.
 *
 * Um corpo só, montado em dois lugares: o painel do admin (emissor
 * "plataforma") e o painel do professor (emissor = o próprio professor). A
 * aba fica na URL (`?divulgacao=cupons|campanhas`), para o link de volta cair
 * no mesmo lugar.
 */
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Megaphone, Tag } from 'lucide-react';
import { cn } from '@/core/lib/utils';
import PromoCampaignsPanel from './PromoCampaignsPanel';
import PromoCouponsPanel from './PromoCouponsPanel';

const ABAS = [
  { v: 'cupons', label: 'Cupons', icon: Tag },
  { v: 'campanhas', label: 'Campanhas', icon: Megaphone },
];

/**
 * @param {{ issuer: { type: string, id: string, name: string }, intro?: React.ReactNode }} props
 */
export default function PromoMarketingConsole({ issuer, intro = null }) {
  const [params, setParams] = useSearchParams();
  const aba = ABAS.some((a) => a.v === params.get('divulgacao')) ? params.get('divulgacao') : 'cupons';
  const ir = (v) => {
    const next = new URLSearchParams(params);
    next.set('divulgacao', v);
    setParams(next, { replace: true });
  };

  return (
    <div className="space-y-4" data-divulgacao={issuer.type}>
      {intro}
      <div role="tablist" aria-label="Divulgação" className="flex flex-wrap gap-2">
        {ABAS.map(({ v, label, icon: Icon }) => (
          <button key={v} type="button" role="tab" aria-selected={aba === v} onClick={() => ir(v)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink',
              aba === v ? 'border-ink bg-ink text-white' : 'border-gray-200 bg-paper-pure text-gray-600 hover:border-ink',
            )}>
            <Icon className="h-4 w-4" aria-hidden /> {label}
          </button>
        ))}
      </div>
      {aba === 'cupons' ? <PromoCouponsPanel issuer={issuer} /> : <PromoCampaignsPanel issuer={issuer} />}
    </div>
  );
}
