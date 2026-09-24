/**
 * Um pacote de horas à venda — o mesmo cartão na página da arena e na página
 * "Você nesta arena". Mora aqui, e não dentro de uma das páginas, porque
 * importar de uma página traria a página inteira para o pacote da outra.
 */
import React from 'react';
import { formatPrice } from '@/modules/arenas/domain/pricing';
import { V2Badge, V2Button } from '@/v2/ui/primitives';

export default function PackageForSaleCard({ pkg, onComprar, ocupado }) {
  const porHora = pkg.hours > 0 ? pkg.price / pkg.hours : 0;
  return (
    <div className="flex h-full flex-col rounded-2xl border border-gray-100 bg-paper-pure p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-ink">{pkg.name}</h3>
          {pkg.description && <p className="mt-1 text-xs leading-5 text-gray-500">{pkg.description}</p>}
        </div>
        <V2Badge tone="amber">{pkg.hours}h</V2Badge>
      </div>
      <div className="mt-4 flex items-end gap-2">
        <span className="font-display text-2xl font-bold text-ink">{formatPrice(pkg.price)}</span>
        <span className="pb-1 text-xs text-gray-500">{formatPrice(porHora)}/h</span>
      </div>
      <p className="mt-1 text-xs text-gray-500">Vale por {pkg.validity_days} dias após a compra</p>
      <div className="mt-auto pt-4">
        <V2Button size="sm" className="w-full" disabled={ocupado} onClick={() => onComprar(pkg)}>
          Quero este pacote
        </V2Button>
      </div>
    </div>
  );
}
