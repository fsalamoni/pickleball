import { FEATURE_FLAG } from '@/core/featureFlags';
import { useFeatureFlag } from '@/core/lib/FeatureFlagsContext';
import { navRotulos } from '@/core/domain/navRotulos';

/** Os rótulos da navegação (ver `core/domain/navRotulos.js`) para a flag atual. */
export function useNavRotulos() {
  return navRotulos(useFeatureFlag(FEATURE_FLAG.NAV_V3));
}
