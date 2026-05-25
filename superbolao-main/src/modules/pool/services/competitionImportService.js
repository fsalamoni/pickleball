import { httpsCallable } from 'firebase/functions';
import { functions } from '@/core/config/firebase';

export const OFFICIAL_COMPETITION_PROVIDERS = Object.freeze({
  fifa: {
    code: 'fifa',
    label: 'FIFA (site oficial)',
    default_competition_id: '17',
    default_from: '2026-06-01',
    default_to: '2026-07-31',
    helper_text: 'Informe o ID oficial da competição da FIFA e o intervalo de datas a importar.',
  },
});

export async function importOfficialCompetitionToPool(payload) {
  const callable = httpsCallable(functions, 'importOfficialCompetitionToPool');
  const result = await callable(payload);
  return result.data;
}
