import { describe, it, expect } from 'vitest';
import {
  mergeCoachRoster, arenaCoachFromPartner, partnershipToggle, partnershipStatus,
  publicCoachRoster,
} from './coachRoster.js';

const parceiro = (id, over = {}) => ({ id, display_name: `Prof ${id}`, residency: { status: 'active' }, ...over });
const daAula = (id, over = {}) => ({ id, name: `Aula ${id}`, active: true, partner: false, ...over });

describe('mergeCoachRoster', () => {
  it('⭐ o mesmo professor nos dois cadastros vira UMA linha', () => {
    const r = mergeCoachRoster([parceiro('u1')], [daAula('c1', { user_id: 'u1', partner: true })]);
    expect(r).toHaveLength(1);
    expect(r[0].partner.id).toBe('u1');
    expect(r[0].arenaCoach.id).toBe('c1');
    expect(r[0].teaches).toBe(true);
  });

  it('professor da casa sem conta é uma linha só dele', () => {
    const r = mergeCoachRoster([], [daAula('c2')]);
    expect(r[0]).toMatchObject({ key: 'c_c2', uid: null, house: true, partner: null });
  });

  it('⭐ parceiro ativo que não dá aula pode ser habilitado; pendente não', () => {
    const r = mergeCoachRoster([parceiro('a'), parceiro('b', { residency: { status: 'pending' } })], []);
    const porUid = Object.fromEntries(r.map((l) => [l.uid, l]));
    expect(porUid.a.canEnableClasses).toBe(true);
    expect(porUid.b.canEnableClasses).toBe(false);
    expect(porUid.b.partnership).toBe('pending');
  });

  it('professor de aula desativado não "dá aula"', () => {
    expect(mergeCoachRoster([], [daAula('c3', { active: false })])[0].teaches).toBe(false);
  });

  it('o nome das aulas vence o do perfil (é o que o aluno vê na agenda)', () => {
    const r = mergeCoachRoster([parceiro('u1')], [daAula('c1', { user_id: 'u1', name: 'Carla' })]);
    expect(r[0].name).toBe('Carla');
  });

  it('ordem alfabética', () => {
    const r = mergeCoachRoster([], [daAula('1', { name: 'Zé' }), daAula('2', { name: 'Ana' })]);
    expect(r.map((l) => l.name)).toEqual(['Ana', 'Zé']);
  });

  it('parceria antiga sem status vale como ativa', () => {
    expect(partnershipStatus({ residency: {} })).toBe('active');
  });
});

describe('arenaCoachFromPartner', () => {
  it('⭐ parceiro da plataforma paga comissão e vem com a conta vinculada', () => {
    const c = arenaCoachFromPartner({ id: 'u9', display_name: 'Rui', photo_url: 'f', hourly_rate: 120, modalities: ['duplas'] });
    expect(c).toMatchObject({ name: 'Rui', user_id: 'u9', partner: true, price_per_hour: 120, specialties: ['duplas'], active: true });
  });

  it('o valor/hora vem de `hourly_rate` (o nome no perfil da plataforma)', () => {
    expect(arenaCoachFromPartner({ id: 'u1', display_name: 'A', hourly_rate: 150 }).price_per_hour).toBe(150);
    expect(arenaCoachFromPartner({ id: 'u1', display_name: 'A', hourly_rate: null }).price_per_hour).toBe(0);
    expect(arenaCoachFromPartner({ id: 'u1', display_name: 'A' }).price_per_hour).toBe(0);
  });
});

describe('partnershipToggle — pausar e retomar', () => {
  it('pausar guarda o estado anterior', () => {
    expect(partnershipToggle({ status: 'active' })).toEqual({ status: 'paused', status_before_pause: 'active' });
    expect(partnershipToggle({ status: 'pending' })).toEqual({ status: 'paused', status_before_pause: 'pending' });
  });

  it('⭐ convite pendente, pausado e retomado, volta a PENDENTE — não vira ativo sem aceite', () => {
    const pausado = { status: 'paused', status_before_pause: 'pending' };
    expect(partnershipToggle(pausado)).toEqual({ status: 'pending', status_before_pause: null });
  });

  it('parceria ativa pausada volta ativa; pausa antiga (sem registro) volta ativa', () => {
    expect(partnershipToggle({ status: 'paused', status_before_pause: 'active' }).status).toBe('active');
    expect(partnershipToggle({ status: 'paused' }).status).toBe('active');
  });
});

describe('publicCoachRoster — o que a página da arena divulga', () => {
  const comStatus = (id, status) => ({ id, display_name: `P ${id}`, residency: status ? { status } : {} });

  it('parceria ATIVA aparece, com link para o perfil', () => {
    const rows = publicCoachRoster(mergeCoachRoster([comStatus('u1')], []));
    expect(rows).toHaveLength(1);
    expect(rows[0].profileLink).toBe('/coaches/u1');
  });

  it('⭐ convite pendente e parceria pausada NÃO são divulgados', () => {
    const rows = publicCoachRoster(mergeCoachRoster([comStatus('u1', 'pending'), comStatus('u2', 'paused')], []));
    expect(rows).toEqual([]);
  });

  it('professor só das aulas aparece enquanto ativo, sem link de perfil', () => {
    const rows = publicCoachRoster(mergeCoachRoster([], [
      { id: 'c1', name: 'Ana', active: true },
      { id: 'c2', name: 'Bia', active: false },
    ]));
    expect(rows.map((r) => r.name)).toEqual(['Ana']);
    expect(rows[0].profileLink).toBeNull();
  });

  it('parceiro pausado que dá aula continua aparecendo pelas aulas — sem o link do perfil', () => {
    const rows = publicCoachRoster(mergeCoachRoster(
      [comStatus('u1', 'paused')],
      [{ id: 'c1', name: 'P u1', user_id: 'u1', active: true, partner: true }],
    ));
    expect(rows).toHaveLength(1);
    expect(rows[0].profileLink).toBeNull();
  });
});
