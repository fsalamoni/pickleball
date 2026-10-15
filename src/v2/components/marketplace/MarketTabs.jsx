/**
 * MERCADO — as abas de cada canto de quem compra. Juntam o que é da mesma
 * família em vez de espalhar um botão por tela:
 *  - Minhas compras: Pedidos · Ofertas · Vales-presente
 *  - Salvos: Favoritos · Buscas salvas
 * Cada aba é uma rota (ou `?aba=`), então recarregar e mandar o link funcionam.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Gift, HandCoins, Heart, ShoppingBag } from 'lucide-react';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import { t, tk } from '@/core/i18n';

const GRUPOS = {
  compras: {
    rotulo: tk('Minhas compras'),
    abas: [
      { value: 'pedidos', label: tk('Pedidos'), icon: ShoppingBag, to: '/mercado/pedidos' },
      { value: 'ofertas', label: tk('Ofertas'), icon: HandCoins, to: '/mercado/pedidos?aba=ofertas' },
      { value: 'vales', label: tk('Vales-presente'), icon: Gift, to: '/mercado/vales' },
    ],
  },
  salvos: {
    rotulo: tk('Salvos'),
    abas: [
      { value: 'favoritos', label: tk('Favoritos'), icon: Heart, to: '/mercado/favoritos' },
      { value: 'buscas', label: tk('Buscas salvas'), icon: Bell, to: '/mercado/buscas', dica: 'mercado-buscas' },
    ],
  },
};

export default function MarketTabs({ grupo, ativo }) {
  const navigate = useNavigate();
  const g = GRUPOS[grupo];
  if (!g) return null;
  return (
    <V2SubTabs
      ariaLabel={t(g.rotulo)}
      tabs={g.abas.map((a) => ({ ...a, label: t(a.label) }))}
      activeValue={ativo}
      onSelect={(a) => navigate(a.to)}
    />
  );
}
