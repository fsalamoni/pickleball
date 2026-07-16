import { describe, it, expect } from 'vitest';
import {
  duplicatedTournamentFields,
  duplicatedModalityFields,
  duplicatedRegistrationFields,
  copyableRegistrations,
  isRegistrationCopyable,
  validateDuplicationPlan,
} from './duplication.js';
import { REGISTRATION_STATUS } from './constants.js';

describe('duplicatedTournamentFields', () => {
  const source = {
    id: 't1',
    name: 'Aberto de Verão',
    description: 'desc',
    city: 'Rio',
    state: 'RJ',
    venue: 'Clube X',
    ruleset: 'cbp',
    scoring: { ruleset: 'cbp', win_by_two: true },
    visibility: 'public',
    cover_image_url: 'http://img',
    starts_at: '2026-01-01',
    ends_at: '2026-01-02',
    registration_deadline: '2025-12-20',
  };

  it('copia as definições e aplica sufixo de cópia por padrão', () => {
    const out = duplicatedTournamentFields(source, { copyDefinitions: true });
    expect(out.name).toBe('Aberto de Verão (cópia)');
    expect(out.city).toBe('Rio');
    expect(out.visibility).toBe('public');
    expect(out.scoring).toEqual(source.scoring);
    expect(out.starts_at).toBe('2026-01-01');
  });

  it('sem definições, leva apenas o nome', () => {
    const out = duplicatedTournamentFields(source, { copyDefinitions: false });
    expect(out).toEqual({ name: 'Aberto de Verão (cópia)' });
  });

  it('respeita um nome customizado', () => {
    const out = duplicatedTournamentFields(source, { copyDefinitions: false, name: '  Edição 2 ' });
    expect(out.name).toBe('Edição 2');
  });
});

describe('duplicatedModalityFields', () => {
  it('copia a configuração sem id/tournament_id/timestamps', () => {
    const modality = {
      id: 'm1',
      tournament_id: 't1',
      name: 'Duplas M',
      format: 'doubles',
      skill_level: 'intermediate',
      gender_category: 'male',
      age_category: 'open',
      max_entries: 16,
      entry_fee_cents: 5000,
      scoring_override: null,
      stages: [{ type: 'group' }],
      court_count: 2,
      notes: 'obs',
      created_at: 'x',
    };
    const out = duplicatedModalityFields(modality);
    expect(out).not.toHaveProperty('id');
    expect(out).not.toHaveProperty('tournament_id');
    expect(out).not.toHaveProperty('created_at');
    expect(out.name).toBe('Duplas M');
    expect(out.max_entries).toBe(16);
    expect(out.stages).toEqual([{ type: 'group' }]);
  });
});

describe('copyableRegistrations / isRegistrationCopyable', () => {
  const regs = [
    { id: 'r1', status: REGISTRATION_STATUS.CONFIRMED },
    { id: 'r2', status: REGISTRATION_STATUS.CANCELLED },
    { id: 'r3', status: REGISTRATION_STATUS.WAITLIST },
    { id: 'r4', status: REGISTRATION_STATUS.PENDING_PAYMENT },
  ];

  it('exclui inscrições canceladas', () => {
    expect(isRegistrationCopyable(regs[1])).toBe(false);
    expect(copyableRegistrations(regs).map((r) => r.id)).toEqual(['r1', 'r3', 'r4']);
  });
});

describe('duplicatedRegistrationFields', () => {
  it('preserva jogadores e status, zera o seed', () => {
    const reg = {
      id: 'r1',
      tournament_id: 't1',
      modality_id: 'm1',
      format: 'doubles',
      is_provisional: true,
      user_id: 'u1',
      player_a_user_id: 'u1',
      player_a_name: 'Ana',
      player_a_email: 'ANA@x.com',
      player_a_level: '3.5',
      player_a_competition_gender: 'female',
      player_b_name: 'Bia',
      player_b_provisional: true,
      status: REGISTRATION_STATUS.CONFIRMED,
      seed: 3,
      label: 'Ana / Bia',
    };
    const out = duplicatedRegistrationFields(reg);
    expect(out).not.toHaveProperty('id');
    expect(out.seed).toBeNull();
    expect(out.status).toBe(REGISTRATION_STATUS.CONFIRMED);
    expect(out.player_a_user_id).toBe('u1');
    expect(out.player_a_email_lc).toBe('ANA@x.com'); // usa o lc informado ou o email cru
    expect(out.player_b_name).toBe('Bia');
    expect(out.is_provisional).toBe(true);
  });
});

describe('validateDuplicationPlan', () => {
  it('erro quando nada é selecionado', () => {
    expect(validateDuplicationPlan({ copyDefinitions: false, modalitySelections: [{ selected: false }] }))
      .toMatch(/Selecione/);
  });

  it('ok quando só as definições são selecionadas', () => {
    expect(validateDuplicationPlan({ copyDefinitions: true, modalitySelections: [] })).toBeNull();
  });

  it('ok quando ao menos uma modalidade é selecionada', () => {
    expect(validateDuplicationPlan({ copyDefinitions: false, modalitySelections: [{ selected: true }] }))
      .toBeNull();
  });
});
