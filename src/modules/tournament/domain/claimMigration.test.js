import { describe, it, expect } from 'vitest';
import {
  buildOfficialPlayer,
  buildRegistrationMigrationDiff,
  filterRegistrationsByEmails,
  normalizeEmail,
  recomputeRegistrationFlags,
} from './claimMigration.js';

const PLAYER = {
  uid: 'q4tFakmMjzMS3CWgqqC43TZ0Cbz1',
  name: 'Vicente Borges',
  email: 'vicente.bcosta@icloud.com',
  level: 'avancado',
  competition_gender: 'M',
  photo_url: 'https://example.com/vicente.jpg',
};

describe('normalizeEmail', () => {
  it('faz trim e lowercase', () => {
    expect(normalizeEmail('  Foo@Bar.COM  ')).toBe('foo@bar.com');
  });
  it('tolera null/undefined/number', () => {
    expect(normalizeEmail(null)).toBe('');
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail(0)).toBe('');
  });
});

describe('buildOfficialPlayer', () => {
  it('prioriza platform_name e cai para full_name/displayName/email', () => {
    expect(buildOfficialPlayer({ uid: 'u1', email: 'a@b.com' }, { platform_name: 'Plat' })).toMatchObject({
      uid: 'u1',
      name: 'Plat',
      email: 'a@b.com',
    });
    expect(buildOfficialPlayer({ uid: 'u1', email: 'a@b.com' }, { full_name: 'Full' })).toMatchObject({
      name: 'Full',
    });
    expect(buildOfficialPlayer({ uid: 'u1', email: 'a@b.com', displayName: 'Disp' }, {})).toMatchObject({
      name: 'Disp',
    });
    expect(buildOfficialPlayer({ uid: 'u1', email: 'a@b.com' }, {})).toMatchObject({
      name: 'a@b.com',
    });
  });

  it('mapeia level e leveling_level (legado)', () => {
    expect(buildOfficialPlayer({ uid: 'u1' }, { level: 'avancado' }).level).toBe('avancado');
    expect(buildOfficialPlayer({ uid: 'u1' }, { leveling_level: 'pro' }).level).toBe('pro');
    expect(buildOfficialPlayer({ uid: 'u1' }, { level: 'avancado', leveling_level: 'pro' }).level).toBe('avancado');
  });
});

describe('buildRegistrationMigrationDiff', () => {
  it('retorna null quando nenhum email bate', () => {
    const reg = {
      player_a_email_lc: 'outro@x.com',
      player_b_email_lc: '',
      player_a_user_id: null,
      player_b_user_id: null,
    };
    expect(buildRegistrationMigrationDiff(reg, ['vicente@google.com'], PLAYER)).toBeNull();
  });

  it('preenche player_a quando player_a_email_lc bate', () => {
    const reg = {
      player_a_email_lc: 'vicente.b.costa@icloud.com',
      player_a_user_id: null,
      player_a_name: 'Vicente',
      player_a_photo: '',
      player_a_competition_gender: null,
      format: 'simples',
    };
    const diff = buildRegistrationMigrationDiff(
      reg,
      ['vicente.b.costa@icloud.com', 'vicente@google.com'],
      PLAYER,
    );
    expect(diff).toMatchObject({
      player_a_user_id: PLAYER.uid,
      user_id: PLAYER.uid,
      player_a_name: 'Vicente Borges',
      player_a_email: 'vicente.bcosta@icloud.com',
      player_a_email_lc: 'vicente.bcosta@icloud.com',
      player_a_level: 'avancado',
      player_a_competition_gender: 'M',
      player_a_photo: 'https://example.com/vicente.jpg',
      player_a_provisional: false,
    });
    expect(diff.player_b_user_id).toBeUndefined();
  });

  it('preenche player_b quando só player_b_email_lc bate', () => {
    const reg = {
      player_a_email_lc: 'parceiro@x.com',
      player_b_email_lc: 'vicente@google.com',
      player_a_user_id: 'uid-parceiro',
      player_b_user_id: null,
      player_b_name: 'Vicente (provisório)',
      player_b_photo: '',
      player_b_competition_gender: null,
      format: 'doubles',
    };
    const diff = buildRegistrationMigrationDiff(reg, ['vicente@google.com'], PLAYER);
    expect(diff).toMatchObject({
      player_b_user_id: PLAYER.uid,
      player_b_name: 'Vicente Borges',
      player_b_email: 'vicente.bcosta@icloud.com',
      player_b_email_lc: 'vicente.bcosta@icloud.com',
      player_b_provisional: false,
    });
    expect(diff.player_a_user_id).toBeUndefined();
    expect(diff.user_id).toBeUndefined();
  });

  it('preenche player_a e player_b quando ambos os emails batem (dupla self-play improvável mas tratado)', () => {
    const reg = {
      player_a_email_lc: 'vicente.b.costa@icloud.com',
      player_b_email_lc: 'vicente@google.com',
      player_a_user_id: null,
      player_b_user_id: null,
      format: 'doubles',
    };
    const diff = buildRegistrationMigrationDiff(
      reg,
      ['vicente.b.costa@icloud.com', 'vicente@google.com'],
      PLAYER,
    );
    expect(diff.player_a_user_id).toBe(PLAYER.uid);
    expect(diff.player_b_user_id).toBe(PLAYER.uid);
  });

  it('não sobrescreve gênero já gravado quando o perfil não tem', () => {
    const reg = {
      player_a_email_lc: 'vicente@google.com',
      player_a_user_id: null,
      player_a_competition_gender: 'M', // admin já tinha preenchido
    };
    const playerSemGenero = { ...PLAYER, competition_gender: null };
    const diff = buildRegistrationMigrationDiff(reg, ['vicente@google.com'], playerSemGenero);
    expect(diff.player_a_competition_gender).toBe('M');
  });

  it('retorna null se o player_a já está reivindicado para o mesmo UID (idempotente)', () => {
    const reg = {
      player_a_email_lc: 'vicente.bcosta@icloud.com',
      player_a_user_id: PLAYER.uid,
      player_b_email_lc: '',
      player_b_user_id: null,
    };
    expect(
      buildRegistrationMigrationDiff(reg, ['vicente.bcosta@icloud.com'], PLAYER),
    ).toBeNull();
  });

  it('retorna null quando player/reg/fromEmails são inválidos', () => {
    expect(buildRegistrationMigrationDiff(null, ['x@y.com'], PLAYER)).toBeNull();
    expect(buildRegistrationMigrationDiff({ player_a_email_lc: 'x@y.com' }, [], PLAYER)).toBeNull();
    expect(
      buildRegistrationMigrationDiff({ player_a_email_lc: 'x@y.com' }, ['x@y.com'], null),
    ).toBeNull();
  });
});

describe('recomputeRegistrationFlags', () => {
  it('marca is_provisional=false quando nenhum dos slots é provisório', () => {
    expect(
      recomputeRegistrationFlags({
        format: 'simples',
        player_a_name: 'Vicente',
        player_a_provisional: false,
        player_b_provisional: false,
      }),
    ).toEqual({ is_provisional: false, label: 'Vicente' });
  });

  it('mantém is_provisional=true se o parceiro ainda é provisório', () => {
    expect(
      recomputeRegistrationFlags({
        format: 'doubles',
        player_a_name: 'Vicente',
        player_a_provisional: false,
        player_b_name: 'Convidado',
        player_b_provisional: true,
      }),
    ).toEqual({
      is_provisional: true,
      label: 'Vicente / Convidado',
    });
  });

  it('formata label de duplas com " / "', () => {
    expect(
      recomputeRegistrationFlags({
        format: 'doubles',
        player_a_name: 'A',
        player_b_name: 'B',
        player_a_provisional: false,
        player_b_provisional: false,
      }).label,
    ).toBe('A / B');
  });
});

describe('filterRegistrationsByEmails', () => {
  const regs = [
    { id: '1', player_a_email_lc: 'vicente@google.com' },
    { id: '2', player_a_email_lc: 'parceiro@x.com', player_b_email_lc: 'vicente.b.costa@icloud.com' },
    { id: '3', player_a_email_lc: 'outro@x.com' },
  ];

  it('filtra por player_a_email_lc e player_b_email_lc', () => {
    const filtered = filterRegistrationsByEmails(regs, [
      'vicente@google.com',
      'vicente.b.costa@icloud.com',
    ]);
    expect(filtered.map((r) => r.id)).toEqual(['1', '2']);
  });

  it('normaliza emails antes de comparar', () => {
    const filtered = filterRegistrationsByEmails(regs, ['  VICENTE@GOOGLE.COM  ']);
    expect(filtered.map((r) => r.id)).toEqual(['1']);
  });

  it('retorna [] quando nenhum bate', () => {
    expect(filterRegistrationsByEmails(regs, ['nao@existe.com']).length).toBe(0);
  });
});
