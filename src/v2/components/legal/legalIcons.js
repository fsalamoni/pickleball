/**
 * Mapa nome→ícone (lucide) usado pelos documentos legais, mantendo o registro
 * de documentos (`legalDocuments.js`) livre de JSX/imports de UI.
 */
import {
  FileText, ShieldCheck, Database, Eye, UserCheck, RefreshCw, HeartHandshake,
  AlertTriangle, Cookie, CreditCard, CalendarX, Trophy, Building2, GraduationCap,
  Scale, Lock, Users, Ban, Landmark, Gavel,
} from 'lucide-react';

const ICONS = {
  FileText, ShieldCheck, Database, Eye, UserCheck, RefreshCw, HeartHandshake,
  AlertTriangle, Cookie, CreditCard, CalendarX, Trophy, Building2, GraduationCap,
  Scale, Lock, Users, Ban, Landmark, Gavel,
};

export function legalIcon(name) {
  return ICONS[name] || FileText;
}
