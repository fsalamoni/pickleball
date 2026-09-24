/**
 * Os atalhos dos módulos: o que aparece, o que some e o que não se repete.
 *
 * Este teste existe por causa de um defeito real: o console de marketing tinha
 * rota e NENHUM link na plataforma levava até ele — o módulo podia estar ligado
 * que ninguém achava a tela. A lista de atalhos agora vem do catálogo, e é isto
 * que garante que módulo entregue nasce alcançável.
 */
import { describe, it, expect } from 'vitest';

import { shortcutsFor } from './ArenaModuleShortcuts.jsx';
import { ARENA_MODULE_ID } from '@/modules/arenas/domain/modules';

const ligados = (...ids) => {
  const set = new Set(ids);
  return (id) => set.has(id);
};

describe('atalhos dos módulos de arena', () => {
  it('módulo desligado não tem porta', () => {
    const atalhos = shortcutsFor(ligados(), 'a1', 'manage');
    expect(atalhos).toEqual([]);
  });

  it('⭐ módulo com tela própria é alcançável quando está ligado', () => {
    const atalhos = shortcutsFor(ligados(ARENA_MODULE_ID.OPERATIONS), 'a1', 'manage');
    expect(atalhos.map((a) => a.to)).toContain('/arenas/a1/gerir/operacoes');
  });

  it('⭐ o marketing virou seção da Central: sem atalho para fora', () => {
    const ids = [ARENA_MODULE_ID.MARKETING, ARENA_MODULE_ID.MARKETING_COUPONS, ARENA_MODULE_ID.MARKETING_NPS];
    expect(shortcutsFor(ligados(...ids), 'a1', 'manage')).toEqual([]);
    expect(shortcutsFor(ligados(...ids), 'a1', 'public')).toEqual([]);
  });

  it('o :arenaId é substituído pela arena de verdade', () => {
    const atalhos = shortcutsFor(ligados(ARENA_MODULE_ID.IOT_QR_KIOSK), 'minha-arena', 'manage');
    expect(atalhos[0].to).toBe('/arenas/minha-arena/gerir/presenca');
    expect(atalhos[0].to).not.toContain(':arenaId');
  });

  it('o público do ATLETA é outro: a rota pública, não a de gestão', () => {
    const atalhos = shortcutsFor(ligados(ARENA_MODULE_ID.IOT_QR_KIOSK), 'a1', 'public');
    expect(atalhos[0].to).toBe('/arenas/a1/chegada');
  });

  it('⭐ a loja virou parte da arena (Pedidos do app + seção Loja): sem atalho', () => {
    const ids = [ARENA_MODULE_ID.PDV, ARENA_MODULE_ID.PDV_CATALOG, ARENA_MODULE_ID.PDV_SPLIT];
    expect(shortcutsFor(ligados(...ids), 'a1', 'manage')).toEqual([]);
    expect(shortcutsFor(ligados(...ids), 'a1', 'public')).toEqual([]);
  });

  it('⭐ jogo aberto e buscar parceiro viraram parte da arena: sem atalho', () => {
    const ids = [ARENA_MODULE_ID.MATCHMAKING_OPEN_MATCH, ARENA_MODULE_ID.MATCHMAKING_PARTNER_FINDER];
    expect(shortcutsFor(ligados(...ids), 'a1', 'manage')).toEqual([]);
    expect(shortcutsFor(ligados(...ids), 'a1', 'public')).toEqual([]);
  });

  it('⭐ módulo INTEGRADO à arena não vira atalho para fora', () => {
    // Membros tem aba na Central e seção na página pública. Um botão levando
    // para outra tela seria justamente o "separado da arena" que a integração
    // desfaz — nos dois públicos.
    expect(shortcutsFor(ligados(ARENA_MODULE_ID.MEMBERS), 'a1', 'manage')).toEqual([]);
    expect(shortcutsFor(ligados(ARENA_MODULE_ID.MEMBERS), 'a1', 'public')).toEqual([]);
  });

  it('⭐ módulo sem tela para este público não vira botão quebrado', () => {
    // Operações não tem rota pública — só a arena mexe nela.
    const atalhos = shortcutsFor(ligados(ARENA_MODULE_ID.OPERATIONS), 'a1', 'public');
    expect(atalhos).toEqual([]);
  });

  it('⭐ dois módulos com o MESMO destino viram um botão só', () => {
    // A família avançada inteira cai em /gerir/avancado; quatro botões iguais
    // seriam ruído, não navegação.
    const atalhos = shortcutsFor(
      ligados(ARENA_MODULE_ID.MULTI_UNIT, ARENA_MODULE_ID.WHITE_LABEL, ARENA_MODULE_ID.AI),
      'a1',
      'manage',
    );
    const destinos = atalhos.map((a) => a.to);
    expect(destinos.length).toBeGreaterThan(0);
    expect(new Set(destinos).size).toBe(destinos.length);
  });

  it('cada atalho tem rótulo em pt-BR, não o id cru', () => {
    const atalhos = shortcutsFor(ligados(ARENA_MODULE_ID.IOT_QR_KIOSK), 'a1', 'manage');
    expect(atalhos[0].label).not.toBe(ARENA_MODULE_ID.IOT_QR_KIOSK);
    expect(atalhos[0].label.length).toBeGreaterThan(2);
  });
});
