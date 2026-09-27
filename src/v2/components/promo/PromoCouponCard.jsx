/**
 * Um cupom da plataforma ou de um professor, como QUEM USA vê (Onda CG): o
 * tíquete (a arte, com o código copiável no canhoto), quem divulga, até
 * quando vale e onde usar. O mesmo tíquete da arena — o mesmo cupom tem a
 * mesma cara em qualquer lugar.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { formatDateShortBR } from '@/modules/arenas/domain/calendar';
import { instanteEmMs } from '@/core/domain/instant';
import { PROMO_ISSUER, PROMO_VISIBILITY, promoBenefitText, promoUseHint } from '@/modules/promo/domain/promo';
import CouponArt from '@/v2/components/arenas/marketing/coupons/CouponArt';
import { issuerDisplayName } from './promoUi';

function ateQuando(coupon) {
  const ms = instanteEmMs(coupon?.expires_at);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const d = new Date(ms);
  const p = (x) => String(x).padStart(2, '0');
  return `até ${formatDateShortBR(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)}`;
}

/** @param {{ coupon: object, showIssuer?: boolean, notch?: string }} props */
export default function PromoCouponCard({ coupon, showIssuer = true, notch = 'bg-paper' }) {
  const ehProfessor = coupon.issuer_type === PROMO_ISSUER.COACH;
  const dono = issuerDisplayName(coupon);
  return (
    <div className="space-y-1.5" data-promo-cupom={coupon.code}>
      <CouponArt coupon={coupon} code={coupon.code} benefit={promoBenefitText(coupon)} description={coupon.description}
        footer={ateQuando(coupon)} arenaName={dono} copyable notch={notch}
        copyMessage={`Código ${coupon.code} copiado. ${promoUseHint(coupon)}`} />
      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 text-xs text-gray-500">
        {showIssuer && ehProfessor && (
          <Link to={`/coaches/${coupon.issuer_id}`} className="inline-flex items-center gap-1 font-semibold text-ink hover:underline">
            <GraduationCap className="h-3.5 w-3.5" aria-hidden /> {dono}
          </Link>
        )}
        <span>{promoUseHint(coupon)}</span>
        {coupon.visibility === PROMO_VISIBILITY.STUDENTS && <span className="font-semibold text-ink">Só para alunos</span>}
        {coupon.once_per_user !== false && <span>1 por pessoa</span>}
      </p>
    </div>
  );
}
