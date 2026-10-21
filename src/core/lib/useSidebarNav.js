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
  ALL_SIDEBAR_ITEMS, SIDEBAR_PRESET_ITEMS, chosenSidebar, isPresetSidebar, moveSidebarItem, sidebarItemAvailable, toggleSidebarItem,
} from '@/core/domain/sidebarNav';
import { resetSidebar, saveSidebar, sidebarSnapshot, subscribeSidebar } from '@/core/lib/sidebarNavPreference';

/**
 * @param {{ arenas?: boolean, professor?: boolean, admin?: boolean, mercado?: boolean, federacoes?: boolean }} papeis
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
  // O que a pessoa vê hoje vai junto: item que ela passar a ver depois (uma
  // funcionalidade ligada, um papel novo) entra na barra dela (`newSidebarItems`).
  const conhecidos = useMemo(() => ALL_SIDEBAR_ITEMS.filter((id) => sidebarItemAvailable(id, papeis)), [papeis]);
  const alternar = useCallback((id) => saveSidebar(uid, preset, toggleSidebarItem(itens, id, papeis), conhecidos), [uid, preset, itens, papeis, conhecidos]);
  const mover = useCallback((id, passo) => saveSidebar(uid, preset, moveSidebarItem(itens, id, passo, papeis), conhecidos), [uid, preset, itens, papeis, conhecidos]);
  const aplicarPreset = useCallback((p) => { if (SIDEBAR_PRESET_ITEMS[p]) saveSidebar(uid, p, SIDEBAR_PRESET_ITEMS[p], conhecidos); }, [uid, conhecidos]);
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
