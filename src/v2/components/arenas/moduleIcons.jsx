/**
 * O ícone de cada módulo, resolvido pelo NOME que está no catálogo.
 *
 * O catálogo é domínio puro e guarda só o nome (`icon: 'Wallet'`) — ele não
 * pode importar componentes React. A tradução para o componente do lucide
 * mora aqui, e o mapa é explícito de propósito: importar o pacote inteiro
 * (`import * as Icons`) traria centenas de ícones para o pacote que a tela
 * baixa. Nome desconhecido cai num ícone neutro, nunca em tela quebrada.
 */

import {
  Activity, Award, BarChartHorizontal, BookOpen, Box, Brain, Briefcase,
  ClipboardCheck, Cpu, Gift, Globe, GraduationCap, Lightbulb, LineChart, Link2,
  ListOrdered, Mail, Megaphone, Network, Package, PackageOpen, Palette, Play,
  Puzzle, QrCode, Repeat, Search, ShoppingCart, Smartphone, Smile, Sparkles,
  Split, Star, Store, Tag, TrendingUp, Trophy, UserCheck, UserPlus, Users,
  Video, Wallet, Wrench,
} from 'lucide-react';

const ICONS = {
  Activity, Award, BarChartHorizontal, BookOpen, Box, Brain, Briefcase,
  ClipboardCheck, Cpu, Gift, Globe, GraduationCap, Lightbulb, LineChart,
  Link: Link2, ListOrdered, Mail, Megaphone, Network, Package, PackageOpen,
  Palette, Play, QrCode, Repeat, Search, ShoppingCart, Smartphone, Smile,
  Sparkles, Split, Star, Store, Tag, TrendingUp, Trophy, UserCheck, UserPlus,
  Users, Video, Wallet, Wrench,
};

/**
 * @param {string|undefined} name — o campo `icon` do catálogo
 * @returns {React.ComponentType<{className?: string}>}
 */
export function moduleIcon(name) {
  return ICONS[name] || Puzzle;
}

/** Fundo suave por cor do catálogo, para o quadradinho do ícone. */
export const MODULE_COLOR_CLASS = Object.freeze({
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  yellow: 'bg-yellow-50 text-yellow-700',
  pink: 'bg-pink-50 text-pink-600',
  slate: 'bg-slate-100 text-slate-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  rose: 'bg-rose-50 text-rose-600',
  violet: 'bg-violet-50 text-violet-600',
});

/**
 * O quadradinho do ícone do módulo, do mesmo tamanho em toda a plataforma.
 * @param {{ module: Object, size?: 'sm'|'md' }} props
 */
export function ModuleIcon({ module: mod, size = 'md', className = '' }) {
  const Icon = moduleIcon(mod?.icon);
  const box = size === 'sm' ? 'h-8 w-8 rounded-xl' : 'h-10 w-10 rounded-2xl';
  const glyph = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const tone = MODULE_COLOR_CLASS[mod?.color] || MODULE_COLOR_CLASS.slate;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${box} ${tone} ${className}`}>
      <Icon className={glyph} aria-hidden="true" />
    </span>
  );
}
