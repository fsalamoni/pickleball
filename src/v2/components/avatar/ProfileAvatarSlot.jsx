/**
 * O lugar da foto no perfil (Minha área e perfil público). Com o avatar como
 * foto e a flag ligada, ele aparece VIVO, em 3D (respira, pisca, gira e anima ao toque);
 * enquanto o desenho baixa — e em qualquer outro caso — fica a foto de
 * sempre (que, com o avatar como foto, já é a imagem dele: a troca não pisca).
 */
import React, { lazy, Suspense } from 'react';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { FEATURE_FLAG } from '@/core/featureFlags';
import { cn } from '@/core/lib/utils';
import { V2Avatar } from '@/v2/ui/primitives';
import { useLiveBrandPaddles } from '@/modules/avatar/hooks/useAvatarCatalog';

const Avatar3D = lazy(() => import('@/modules/avatar/components/Avatar3D.jsx'));

/**
 * @param {{ name:string, photoUrl:string, recipe?:object|null, className:string }} props
 * `recipe` só quando o avatar É a foto (a Minha área confere; o espelho público só o leva assim).
 */
export default function ProfileAvatarSlot({ name, photoUrl, recipe, className }) {
  const on = useFeatureFlag(FEATURE_FLAG.AVATAR_CREATOR);
  // O catálogo só é lido quando a receita usa uma raquete de marca.
  const brand = useLiveBrandPaddles({ enabled: Boolean(on && recipe?.paddleBrand) });
  const photo = <V2Avatar name={name} photoUrl={photoUrl} size="xl" className={className} />;
  if (!on || !recipe) return photo;
  return (
    <Suspense fallback={photo}>
      <Avatar3D
        recipe={recipe}
        view="bust"
        label={name}
        brandItems={brand.items}
        fallback={<V2Avatar name={name} photoUrl={photoUrl} size="xl" className="h-full w-full border-0" />}
        className={cn('block shrink-0 overflow-hidden rounded-full border border-gray-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-acid/50', className)}
      />
    </Suspense>
  );
}
