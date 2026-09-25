/**
 * Como cada TIPO de cupom aparece na tela — só o que é de apresentação (o
 * ícone). O que o tipo É (rótulo, família, dica, exemplo) mora no domínio,
 * em `COUPON_KIND_META`, e esta tabela só o complementa.
 */
import {
  CalendarDays, Clock, CupSoda, GraduationCap, Gift, Handshake, Package, Percent,
  Sparkles, Target, Users, UtensilsCrossed,
} from 'lucide-react';
import {
  COUPON_FAMILY, COUPON_FAMILY_META, COUPON_KIND, COUPON_KIND_META,
} from '@/modules/arenas/domain/marketing';

export const COUPON_KIND_ICON = Object.freeze({
  [COUPON_KIND.DISCOUNT]: Percent,
  [COUPON_KIND.FREE_HOURS]: Clock,
  [COUPON_KIND.PRIVATE_LESSON]: GraduationCap,
  [COUPON_KIND.GROUP_LESSON]: Users,
  [COUPON_KIND.CLINIC]: Target,
  [COUPON_KIND.FOOD]: UtensilsCrossed,
  [COUPON_KIND.DRINK]: CupSoda,
  [COUPON_KIND.PRODUCT]: Gift,
  [COUPON_KIND.RENTAL]: Package,
  [COUPON_KIND.EVENT]: CalendarDays,
  [COUPON_KIND.OTHER]: Sparkles,
  [COUPON_KIND.REFERRAL]: Handshake,
});

/**
 * Os tipos agrupados por família, na ordem em que aparecem no seletor. O tipo
 * indicação só entra com o módulo de indicações ligado.
 * @param {{ referralOn?: boolean }} [opts]
 */
export function kindGroups({ referralOn = false } = {}) {
  return [COUPON_FAMILY.BOOKING, COUPON_FAMILY.VOUCHER, COUPON_FAMILY.REFERRAL]
    .filter((fam) => fam !== COUPON_FAMILY.REFERRAL || referralOn)
    .map((fam) => ({
      family: fam,
      ...COUPON_FAMILY_META[fam],
      kinds: Object.entries(COUPON_KIND_META)
        .filter(([, meta]) => meta.family === fam)
        .map(([kind, meta]) => ({ kind, ...meta, icon: COUPON_KIND_ICON[kind] })),
    }));
}
