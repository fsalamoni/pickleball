/**
 * Mapa nome→ícone (lucide) para os interesses da plataforma, mantendo o domínio
 * `profileMeta.js` livre de imports de UI. Usado no onboarding, editor de perfil
 * e painel.
 */
import {
  Trophy, ClipboardList, Users, Handshake, Dices, Dumbbell, GraduationCap,
  Building2, CalendarCheck, Zap, Medal, Sparkles,
} from 'lucide-react';

const ICONS = {
  Trophy, ClipboardList, Users, Handshake, Dices, Dumbbell, GraduationCap,
  Building2, CalendarCheck, Zap, Medal, Sparkles,
};

export function interestIcon(name) {
  return ICONS[name] || Sparkles;
}
