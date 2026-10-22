import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { memberTypeCatalog } from './memberTypes.js';
import {
  REGISTRY_ALL, bondCounts, folderBlocks, inRegistry, memberBond, memberTimeline, memberTypeIdOf, orgPeopleWithMembership, plansOfType, pointsBySeason, registryList, registryTabs,
} from './registry.js';

const catalogo = memberTypeCatalog({ member_types: [{ id: 'coach', active: false }, { id: 'dirigente', label: 'Dirigente', entity: 'person', category: 'none' }] });
const m = (id, extra = {}) => ({ id, status: 'active', user_name: id, ...extra });

describe('cadastro por tipo', () => {
  it('tipo e vínculo de filiações antigas', () => {
    expect(memberTypeIdOf({})).toBe('athlete');
    expect(memberTypeIdOf({ org_kind: 'club' })).toBe('club');
    expect(memberTypeIdOf({ person_type: 'referee' })).toBe('referee');
    expect(memberBond({})).toBe('federated');
    expect(memberBond({ tier: 'registered' })).toBe('registered');
    expect(inRegistry(m('a', { status: 'pending' }))).toBe(false);
    expect(inRegistry(m('a', { status: 'cancelled' }))).toBe(false);
    expect(inRegistry(m('a', { status: 'expired' }))).toBe(true);
  });

  it('abas: tipos ligados, desligados com gente e tipos que saíram do catálogo', () => {
    const membros = [m('a'), m('b', { person_type: 'coach' }), m('c', { person_type: 'escola', person_type_label: 'Escola' }), m('d', { status: 'pending', person_type: 'referee' })];
    const abas = registryTabs(catalogo, membros, [{ person_type: 'club' }]);
    const ids = abas.map((x) => x.id);
    expect(ids[0]).toBe(REGISTRY_ALL);
    expect(abas[0].count).toBe(3);
    // Professor está desligado mas tem gente: continua com a aba.
    expect(ids).toContain('coach');
    expect(ids).toContain('dirigente');
    expect(ids).toContain('escola');
    expect(abas.find((x) => x.id === 'escola').type.label).toBe('Escola');
    // Pedido não conta na aba de árbitros.
    expect(abas.find((x) => x.id === 'referee').count).toBe(0);
    expect(abas.find((x) => x.id === 'club').plans).toBe(1);
  });

  it('tipo desligado sem gente nem plano some', () => {
    expect(registryTabs(catalogo, [], []).map((x) => x.id)).not.toContain('coach');
  });

  it('lista por tipo e vínculo, com as contagens', () => {
    const membros = [m('a', { tier: 'registered' }), m('b'), m('c', { person_type: 'referee' })];
    expect(registryList(membros, { tipo: 'athlete' }).map((x) => x.id)).toEqual(['a', 'b']);
    expect(registryList(membros, { tipo: 'athlete', vinculo: 'registered' }).map((x) => x.id)).toEqual(['a']);
    expect(bondCounts(registryList(membros))).toEqual({ todos: 3, federated: 2, registered: 1 });
  });

  it('planos do tipo, os ativos primeiro', () => {
    const planos = [{ name: 'B', person_type: 'club', active: false }, { name: 'A', person_type: 'club' }, { name: 'C' }];
    expect(plansOfType(planos, 'club').map((p) => p.name)).toEqual(['A', 'B']);
    expect(plansOfType(planos, 'athlete').map((p) => p.name)).toEqual(['C']);
  });

  it('blocos da pasta por tipo', () => {
    const tipo = (id) => catalogo.find((x) => x.id === id);
    expect(folderBlocks(m('a'), tipo('athlete'))).toEqual(['resumo', 'cobrancas', 'documentos', 'cursos', 'pontos', 'sancoes', 'historico']);
    expect(folderBlocks(m('a'), tipo('referee'))).toContain('arbitragem');
    expect(folderBlocks(m('a'), tipo('referee'))).not.toContain('pontos');
    // Árbitro que já pontuou como atleta e atleta que está no quadro de arbitragem.
    expect(folderBlocks(m('a'), tipo('referee'), { hasPoints: true })).toContain('pontos');
    expect(folderBlocks(m('a'), tipo('athlete'), { rostered: true })).toContain('arbitragem');
    expect(folderBlocks(m('a', { org_kind: 'arena' }), tipo('arena'))).toEqual(['resumo', 'cobrancas', 'documentos', 'entidade', 'sancoes', 'historico']);
  });

  it('histórico junta as fontes, do mais novo ao mais antigo, e ignora a que não carregou', () => {
    const membro = m('a', { requested_at: Timestamp.fromMillis(1000), activated_at_ms: 3000, plan_name: 'Anual' });
    const linha = memberTimeline(membro, {
      charges: [{ paid_at_ms: 2000, plan_name: 'Anual' }],
      credentials: [{ issued_at: '2026-10-12', course_name: 'Árbitro I' }],
      documents: undefined,
    });
    expect(linha.map((e) => e.kind)).toEqual(['credencial', 'filiacao', 'pagamento', 'filiacao']);
    // A data sem hora vale o dia local, ao meio-dia.
    expect(new Date(linha[0].at).getDate()).toBe(12);
    expect(memberTimeline(null)).toEqual([]);
  });

  it('pontos por ano somam só o que vale', () => {
    const anos = pointsBySeason([
      { season: 2026, points: 100, date: '2026-03-01' }, { season: 2026, points: 50, status: 'cancelled', date: '2026-05-01' }, { season: 2025, points: 30 },
    ]);
    expect(anos.map((a) => [a.season, a.total, a.items.length])).toEqual([[2026, 100, 2], [2025, 30, 1]]);
    expect(anos[0].items[0].date).toBe('2026-05-01');
  });

  it('pessoas da entidade com a filiação daqui, sem repetir', () => {
    const pessoas = [{ user_id: 'u1', user_name: 'Bia', role: 'admin' }, { user_id: 'u2', user_name: 'Ana' }, { user_id: 'u1', user_name: 'Bia' }, { user_name: 'sem uid' }];
    const membros = [m('x', { user_id: 'u1' }), m('y', { user_id: 'u2', status: 'cancelled' })];
    const r = orgPeopleWithMembership(pessoas, membros);
    expect(r.map((p) => [p.uid, Boolean(p.member)])).toEqual([['u1', true], ['u2', false]]);
  });
});
