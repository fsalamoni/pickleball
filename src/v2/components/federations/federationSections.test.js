import { describe, it, expect } from 'vitest';
import { FED_PERMISSION } from '@/modules/federations/domain/constants';
import { buildFederationSections, residualModules } from './federationSections';

const todas = Object.values(FED_PERMISSION);
const abas = (sections) => sections.flatMap((s) => s.tabs.map((t) => t.value));
const fed = (modules) => ({ id: 'fpp', modules });

describe('seções da Central × módulos', () => {
  it('módulo ligado abre as abas dele; desligado, elas somem', () => {
    const ligado = abas(buildFederationSections(todas, fed({ discipline: true, tournaments: true, ranking: true, news: true })));
    expect(ligado).toEqual(expect.arrayContaining(['sancoes', 'ouvidoria', 'chancelas', 'resultados', 'ranking', 'noticias']));
    const desligado = abas(buildFederationSections(todas, fed({})));
    expect(desligado).not.toEqual(expect.arrayContaining(['sancoes']));
    ['sancoes', 'ouvidoria', 'chancelas', 'resultados', 'ranking', 'noticias'].forEach((a) => expect(desligado).not.toContain(a));
  });

  it('desligado com decisão em aberto: a aba de decidir fica, a de receber coisa nova não', () => {
    const residual = { discipline: true, tournaments: true };
    const a = abas(buildFederationSections(todas, fed({}), { residual }));
    expect(a).toContain('sancoes');
    expect(a).toContain('chancelas');
    expect(a).not.toContain('ouvidoria');
    expect(a).not.toContain('resultados');
  });

  it('residualModules: recurso ou sanção em vigor; pedido de chancela pendente', () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const sancoes = [{ status: 'appealed', kind: 'warning' }];
    const torneios = [{ federation_id: 'fpp', federation_sanction: { status: 'pending' } }];
    expect(residualModules(fed({}), { sanctions: sancoes, tournaments: torneios })).toEqual({ discipline: true, tournaments: true });
    // Ligado não é resíduo; sem nada em aberto também não; leitura que não veio não inventa.
    expect(residualModules(fed({ discipline: true, tournaments: true }), { sanctions: sancoes, tournaments: torneios })).toEqual({ discipline: false, tournaments: false });
    expect(residualModules(fed({}), { sanctions: [{ status: 'revoked', kind: 'suspension', ends_at: hoje }], tournaments: [{ federation_id: 'fpp', federation_sanction: { status: 'approved' } }] })).toEqual({ discipline: false, tournaments: false });
    expect(residualModules(fed({}), {})).toEqual({ discipline: false, tournaments: false });
  });
});
