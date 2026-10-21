import { describe, it, expect } from 'vitest';
import {
  ALL_SIDEBAR_ITEMS, SIDEBAR_ITEM as I, SIDEBAR_ITEM_META, SIDEBAR_PRESET, SIDEBAR_PRESET_ITEMS,
  chosenSidebar, defaultSidebarPreset, hiddenSidebarItems, isPresetSidebar, moveSidebarItem,
  newSidebarItems, sidebarPresetAvailable, toggleSidebarItem, visibleSidebarItems,
} from './sidebarNav';

const semFlags = (itens) => itens.filter((i) => i !== I.MERCADO && i !== I.FEDERACOES);

describe('padrões por papel', () => {
  it('arena > professor > atleta', () => {
    expect(defaultSidebarPreset({})).toBe('atleta');
    expect(defaultSidebarPreset({ professor: true })).toBe('professor');
    expect(defaultSidebarPreset({ arenas: true, professor: true })).toBe('arena');
  });
  it('cada padrão começa no Início e termina na Minha área, só com itens conhecidos', () => {
    Object.values(SIDEBAR_PRESET_ITEMS).forEach((itens) => {
      expect(itens[0]).toBe(I.INICIO);
      expect(itens[itens.length - 1]).toBe(I.PERFIL);
      itens.forEach((id) => expect(ALL_SIDEBAR_ITEMS).toContain(id));
    });
  });
  it('o padrão da arena e do professor só para quem é', () => {
    expect(sidebarPresetAvailable('arena', {})).toBe(false);
    expect(sidebarPresetAvailable('arena', { arenas: true })).toBe(true);
    expect(sidebarPresetAvailable('atleta', {})).toBe(true);
  });
});

describe('chosenSidebar', () => {
  it('sem escolha, o padrão do papel; o item de papel que a pessoa não tem some', () => {
    // O Mercado e as Federações só entram com a flag de cada um ligada.
    expect(chosenSidebar(null, {})).toEqual({ preset: 'atleta', items: semFlags(SIDEBAR_PRESET_ITEMS.atleta) });
    expect(chosenSidebar(null, { mercado: true, federacoes: true })).toEqual({ preset: 'atleta', items: SIDEBAR_PRESET_ITEMS.atleta });
    const arena = chosenSidebar(null, { arenas: true });
    expect(arena.preset).toBe('arena');
    expect(arena.items[1]).toBe(I.MINHA_ARENA);
    // Guardou "arena" e perdeu a arena: a Central some, o resto fica.
    expect(chosenSidebar({ preset: 'arena', items: SIDEBAR_PRESET_ITEMS.arena }, {}).items).not.toContain(I.MINHA_ARENA);
  });
  it('⭐ Início, Minha área e Admin (para o admin) nunca saem', () => {
    const r = chosenSidebar({ preset: 'atleta', items: ['jogar'] }, { admin: true });
    expect(r.items).toEqual([I.INICIO, I.JOGAR, I.PERFIL, I.ADMIN]);
    expect(visibleSidebarItems(['perfil', 'inicio', 'competir'], {})).toEqual([I.INICIO, I.PERFIL, I.COMPETIR]);
  });
  it('lixo na escolha guardada vira lista válida', () => {
    expect(visibleSidebarItems(['x', 42, 'jogar', 'jogar'], {})).toEqual([I.INICIO, I.JOGAR, I.PERFIL]);
    expect(chosenSidebar({ preset: 'nada', items: ['competir'] }, { professor: true }).preset).toBe('professor');
  });
});

describe('⭐ item que a pessoa passa a ver entra na barra que ela já escolheu', () => {
  it('as Federações estão nos três padrões, antes do Mercado', () => {
    Object.values(SIDEBAR_PRESET_ITEMS).forEach((itens) => {
      expect(itens.indexOf(I.FEDERACOES)).toBe(itens.indexOf(I.MERCADO) - 1);
    });
  });
  it('escolha antiga (sem `known`): só as Federações entram, antes da Minha área', () => {
    expect(newSidebarItems(undefined)).toEqual([I.FEDERACOES]);
    const r = chosenSidebar({ preset: 'atleta', items: [I.INICIO, I.JOGAR, I.PERFIL] }, { federacoes: true, mercado: true });
    expect(r.items).toEqual([I.INICIO, I.JOGAR, I.FEDERACOES, I.PERFIL]);
    // Sem a flag, nada muda.
    expect(chosenSidebar({ preset: 'atleta', items: [I.INICIO, I.JOGAR, I.PERFIL] }, {}).items).toEqual([I.INICIO, I.JOGAR, I.PERFIL]);
  });
  it('com `known`: o que a pessoa já podia ver e tirou continua fora; a funcionalidade que ela não via entra; item de papel, não', () => {
    const known = ALL_SIDEBAR_ITEMS.filter((i) => i !== I.FEDERACOES && i !== I.MINHA_ARENA);
    const salvo = { preset: 'atleta', items: [I.INICIO, I.JOGAR, I.PERFIL], known };
    const r = chosenSidebar(salvo, { federacoes: true, mercado: true, arenas: true });
    expect(r.items).toEqual([I.INICIO, I.JOGAR, I.FEDERACOES, I.PERFIL]);
    expect(r.items).not.toContain(I.MERCADO);
    expect(chosenSidebar({ ...salvo, known: ALL_SIDEBAR_ITEMS }, { federacoes: true }).items).toEqual([I.INICIO, I.JOGAR, I.PERFIL]);
  });
});

describe('editar', () => {
  const papeis = { arenas: true, professor: true };
  it('ligar entra antes da Minha área; desligar tira; fixo não sai', () => {
    const base = SIDEBAR_PRESET_ITEMS.atleta;
    const com = toggleSidebarItem(base, I.PROFESSOR, papeis);
    expect(com[com.length - 1]).toBe(I.PERFIL);
    expect(com[com.length - 2]).toBe(I.PROFESSOR);
    expect(toggleSidebarItem(com, I.PROFESSOR, papeis)).toEqual(visibleSidebarItems(base, papeis));
    expect(toggleSidebarItem(base, I.PERFIL, papeis)).toContain(I.PERFIL);
    expect(toggleSidebarItem(base, I.INICIO, papeis)[0]).toBe(I.INICIO);
    // Item que a pessoa não pode ter não entra.
    expect(toggleSidebarItem(base, I.MINHA_ARENA, {})).not.toContain(I.MINHA_ARENA);
  });
  it('mover: ninguém passa à frente do Início; na ponta não faz nada', () => {
    const base = semFlags(SIDEBAR_PRESET_ITEMS.atleta);
    expect(moveSidebarItem(base, I.JOGAR, -1)).toEqual(base);
    expect(moveSidebarItem(base, I.INICIO, 1)).toEqual(base);
    expect(moveSidebarItem(base, I.COMPETIR, -1)[1]).toBe(I.COMPETIR);
    expect(moveSidebarItem(base, I.PERFIL, 1)).toEqual(base);
  });
  it('isPreset e escondidos', () => {
    expect(isPresetSidebar(SIDEBAR_PRESET_ITEMS.arena, 'arena', papeis)).toBe(true);
    expect(isPresetSidebar(SIDEBAR_PRESET_ITEMS.arena, 'atleta', papeis)).toBe(false);
    expect(hiddenSidebarItems(SIDEBAR_PRESET_ITEMS.atleta, {})).toEqual([I.PARCEIROS]);
    expect(hiddenSidebarItems(SIDEBAR_PRESET_ITEMS.atleta, papeis)).toEqual([I.PARCEIROS, I.MINHA_ARENA, I.PROFESSOR]);
  });
  it('todo item tem rótulo e descrição', () => {
    ALL_SIDEBAR_ITEMS.forEach((id) => {
      expect(SIDEBAR_ITEM_META[id].label).toBeTruthy();
      expect(SIDEBAR_ITEM_META[id].description).toBeTruthy();
    });
  });
});
