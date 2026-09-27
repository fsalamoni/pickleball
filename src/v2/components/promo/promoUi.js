/**
 * Apresentação da DIVULGAÇÃO (Onda CG) — o que é de tela, não de regra.
 *
 * O emissor chega às telas como um objeto `issuer` (`{ type, id, name }`) e a
 * "marca" dele para os editores de banner e de cupom (cor e nome no rodapé da
 * arte). Os ícones dos tipos são os MESMOS do cupom da arena: o mesmo tipo tem
 * a mesma cara em qualquer lugar da plataforma.
 */
import { COUPON_KIND_ICON } from '@/v2/components/arenas/marketing/coupons/couponKindUi';
import { PLATFORM_ISSUER_ID, PROMO_FAMILY, PROMO_ISSUER, promoKinds } from '@/modules/promo/domain/promo';

export { COUPON_KIND_ICON as PROMO_KIND_ICON };

/** A cor da marca PickleRush (o "acid" da paleta). */
export const PICKLERUSH_COLOR = '#D4F82E';

/** O emissor "plataforma". */
export const PLATFORM_ISSUER = Object.freeze({ type: PROMO_ISSUER.PLATFORM, id: PLATFORM_ISSUER_ID, name: 'PickleRush' });

/** O emissor "professor" a partir do perfil. */
export function coachIssuer(uid, coach) {
  if (!uid) return null;
  return { type: PROMO_ISSUER.COACH, id: uid, name: String(coach?.display_name || coach?.name || 'Professor').slice(0, 80) };
}

/** A marca do emissor para os editores de arte. */
export function issuerBrand(issuer) {
  if (issuer?.type === PROMO_ISSUER.PLATFORM) {
    return { color: PICKLERUSH_COLOR, label: 'Usar as cores do PickleRush', name: 'PickleRush' };
  }
  return { color: '', label: '', name: issuer?.name || '' };
}

/** A pasta dos envios (Storage), por emissor. */
export function uploadFolderFor(issuer, kind) {
  const base = issuer?.type === PROMO_ISSUER.PLATFORM ? 'platform' : 'coach';
  return `${base}-${kind === 'coupon' ? 'coupons' : 'banners'}`;
}

/** Como o emissor aparece para quem vê: "PickleRush" / "Prof. Ana". */
export function issuerDisplayName(doc) {
  if (doc?.issuer_type === PROMO_ISSUER.PLATFORM) return 'PickleRush';
  return doc?.issuer_name || 'Professor';
}

/** Os tipos agrupados por família, para o seletor. */
export function promoKindGroups(issuerType) {
  const todos = promoKinds(issuerType).map((k) => ({ ...k, icon: COUPON_KIND_ICON[k.kind] }));
  const coach = issuerType === PROMO_ISSUER.COACH;
  return [
    {
      family: PROMO_FAMILY.DISCOUNT,
      label: coach ? 'Desconto na aula' : 'Desconto',
      hint: coach
        ? 'O aluno informa o código ao pedir a aula; o desconto entra quando você confirma.'
        : 'Percentual ou valor fixo. Quem usa mostra o código e a plataforma registra o uso.',
      kinds: todos.filter((k) => k.family === PROMO_FAMILY.DISCOUNT),
    },
    {
      family: PROMO_FAMILY.VOUCHER,
      label: 'Vale',
      hint: coach
        ? 'Um benefício entregue por você: o aluno mostra o código e você registra o uso. O vale de aula particular também entra no pedido de aula.'
        : 'Um benefício entregue pela plataforma: a pessoa mostra o código e a equipe registra o uso.',
      kinds: todos.filter((k) => k.family === PROMO_FAMILY.VOUCHER),
    },
  ];
}

/** "1 pessoa" / "3 pessoas". */
export const pessoas = (n) => `${n} ${n === 1 ? 'pessoa' : 'pessoas'}`;

/**
 * Quanto do AVISO da campanha chegou. `recipients_count` é o público pedido e
 * `sent_count` o que foi confirmado; campanha antiga (sem `recipients_count`)
 * tinha só o número do público — segue como antes.
 */
export function avisoEnviado(campaign) {
  const confirmados = Number(campaign?.sent_count) || 0;
  const publico = Number(campaign?.recipients_count) || 0;
  if (publico > 0 && confirmados < publico) return `Aviso confirmado para ${confirmados} de ${pessoas(publico)}`;
  return `Aviso para ${pessoas(confirmados || publico)}`;
}
