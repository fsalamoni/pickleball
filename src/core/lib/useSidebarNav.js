/**
 * A escolha da barra lateral, para quem desenha: a barra (V2Layout), o cartão
 * de Configurações e o seletor veem a mesma coisa ao mesmo tempo.
 *
 * `papeis` vem de quem chama (a barra já sabe se a pessoa gere arena, dá aula
 * ou administra) — o hook não consulta nada.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import {
  SIDEBAR_PRESET_ITEMS, chosenSidebar, isPresetSidebar, moveSidebarItem, toggleSidebarItem,
} from '@/core/domain/sidebarNav';
import { resetSidebar, saveSidebar, sidebarSnapshot, subscribeSidebar } from '@/core/lib/sidebarNavPreference';

/**
 * @param {{ arenas?: boolean, professor?: boolean, admin?: boolean }} papeis
 * @returns {{
 *   itens: string[], preset: string, personalizado: boolean, padrao: boolean,
 *   alternar: (id: string) => void, mover: (id: string, passo: number) => void,
 *   aplicarPreset: (preset: string) => void, restaurar: () => void,
 * }}
 */
export function useSidebarNav(papeis) {
  const { user } = useAuth();
  const uid = user?.uid || null;
  const retrato = useSyncExternalStore(subscribeSidebar, () => sidebarSnapshot(uid), () => sidebarSnapshot(uid));
  const escolha = useMemo(() => chosenSidebar(retrato.salvo, papeis), [retrato, papeis]);
  const { preset, items: itens } = escolha;
  const alternar = useCallback((id) => saveSidebar(uid, preset, toggleSidebarItem(itens, id, papeis)), [uid, preset, itens, papeis]);
  const mover = useCallback((id, passo) => saveSidebar(uid, preset, moveSidebarItem(itens, id, passo, papeis)), [uid, preset, itens, papeis]);
  const aplicarPreset = useCallback((p) => { if (SIDEBAR_PRESET_ITEMS[p]) saveSidebar(uid, p, SIDEBAR_PRESET_ITEMS[p]); }, [uid]);
  const restaurar = useCallback(() => { resetSidebar(uid); }, [uid]);
  return {
    itens,
    preset,
    personalizado: retrato.salvo !== null,
    padrao: isPresetSidebar(itens, preset, papeis),
    alternar,
    mover,
    aplicarPreset,
    restaurar,
  };
}
