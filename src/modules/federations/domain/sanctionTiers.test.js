import { describe, it, expect } from 'vitest';
import { sanctionState, buildSanctionRequest, sanctionDecision } from './sanction.js';

describe('chancela com as categorias da federação (Etapa 4)', () => {
  const FGP = {
    id: 'fgp', name: 'Federação Gaúcha', acronym: 'FGP',
    ranking_config: { tiers: [
      { id: 'fgp1000', code: 'FGP 1000', group: 'G1', name: 'Estadual', points_by_place: { 1: 1000 } },
      { id: 'fgp500', code: 'FGP 500', group: 'G2', points_by_place: { 1: 500 } },
      { id: 'velha', code: 'FGP 250', points_by_place: { 1: 250 }, active: false },
    ] },
  };

  it('o pedido guarda a categoria escolhida e a cópia de sigla, grupo e nome', () => {
    const p = buildSanctionRequest({ federation: FGP, uid: 'org', tier: 'fgp500' });
    expect(p.federation_sanction).toMatchObject({ tier: 'fgp500', tier_code: 'FGP 500', tier_group: 'G2', tier_name: '' });
    // categoria arquivada ou inexistente não é escolhível: cai na primeira ativa
    expect(buildSanctionRequest({ federation: FGP, uid: 'org', tier: 'velha' }).federation_sanction.tier).toBe('fgp1000');
    expect(buildSanctionRequest({ federation: FGP, uid: 'org', tier: 'major' }).federation_sanction.tier).toBe('fgp1000');
  });

  it('sem categorias próprias valem as três de antes', () => {
    expect(buildSanctionRequest({ federation: { id: 'x' }, uid: 'org', tier: 'major' }).federation_sanction.tier).toBe('major');
  });

  it('a equipe aprova escolhendo a categoria e quem realiza; recusar não mexe na categoria', () => {
    const pedido = { federation_id: 'fgp', ...buildSanctionRequest({ federation: FGP, uid: 'org', tier: 'fgp500' }) };
    const ok = sanctionDecision(pedido, 'approve', { uid: 'eq', federation: FGP, tier: 'fgp1000', origin: 'federation' });
    expect(ok.federation_sanction).toMatchObject({ status: 'approved', tier: 'fgp1000', tier_code: 'FGP 1000', origin: 'federation' });
    expect(sanctionState({ federation_id: 'fgp', ...ok })).toMatchObject({
      byFederation: true, origin: 'federation', tierShort: 'FGP 1000 · G1', tierLabel: 'FGP 1000 · G1 · Estadual',
    });
    const autorizado = sanctionDecision(pedido, 'approve', { uid: 'eq', federation: FGP });
    expect(sanctionState({ federation_id: 'fgp', ...autorizado })).toMatchObject({ byFederation: false, origin: 'sanctioned', tier: 'fgp500' });
    const comVelha = { federation_id: 'fgp', federation_sanction: { status: 'approved', tier: 'velha', tier_code: 'FGP 250' } };
    expect(sanctionDecision(comVelha, 'revoke', { uid: 'eq', reason: 'fora do regulamento', federation: FGP }).federation_sanction.tier).toBe('velha');
    // aprovar de novo mantém a arquivada se ela já era a do torneio
    expect(sanctionDecision(comVelha, 'approve', { uid: 'eq', federation: FGP }).federation_sanction.tier).toBe('velha');
  });

  it('o organizador não marca "realizado pela federação": pendente não tem origem', () => {
    const t = { federation_id: 'fgp', federation_sanction: { status: 'pending', origin: 'federation' } };
    expect(sanctionState(t)).toMatchObject({ byFederation: false, origin: null });
  });

  it('torneio antigo mostra o nome da categoria antiga', () => {
    expect(sanctionState({ federation_id: 'f', federation_sanction: { status: 'approved', tier: 'state' } }).tierShort).toBe('Etapa estadual');
  });
});
