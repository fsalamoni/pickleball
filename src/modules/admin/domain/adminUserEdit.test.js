import { describe, it, expect } from 'vitest';
import {
  ADMIN_EDITABLE_FIELDS, ADMIN_FORBIDDEN_FIELDS, sanitizeAdminUserPatch,
  diffAdminUserPatch, missingUserFields, isUserRecordComplete, userRecordStatus,
  validateAdminEdit,
} from './adminUserEdit.js';

const completo = {
  platform_name: 'Ana', full_name: 'Ana Silva', birth_date: '1990-01-01',
  phone: '51999999999', gender: 'F', city: 'Porto Alegre', state: 'RS',
  address: 'Rua X, 1', pickleball_experience: '1-2 anos', competition_gender: 'female',
  court_side: 'right', leveling_level: '3.5', dupr_id: 'ABC', dupr_rating: 3.5,
  photo_url: 'https://x/y.jpg',
};

describe('a lista de campos editáveis é fechada', () => {
  it('⭐ NENHUM campo proibido é editável — poder, privacidade e login ficam fora', () => {
    const editaveis = new Set(ADMIN_EDITABLE_FIELDS.map((f) => f.key));
    Object.keys(ADMIN_FORBIDDEN_FIELDS).forEach((proibido) => {
      expect(editaveis.has(proibido)).toBe(false);
    });
  });

  it('⭐ os campos de PODER estão explicitamente proibidos', () => {
    expect(ADMIN_FORBIDDEN_FIELDS).toHaveProperty('role');
    expect(ADMIN_FORBIDDEN_FIELDS).toHaveProperty('can_create_pools');
  });

  it('⭐ as preferências de PRIVACIDADE estão explicitamente proibidas', () => {
    ['email_public', 'phone_public', 'address_public', 'directory_listed'].forEach((k) => {
      expect(ADMIN_FORBIDDEN_FIELDS).toHaveProperty(k);
    });
  });

  it('todo campo editável tem rótulo em pt-BR e grupo', () => {
    ADMIN_EDITABLE_FIELDS.forEach((f) => {
      expect(f.label).toBeTruthy();
      expect(f.group).toBeTruthy();
      expect(f.key).toMatch(/^[a-z_]+$/);
    });
  });
});

describe('sanitizeAdminUserPatch', () => {
  it('⭐ DESCARTA campo proibido em vez de deixar a escrita ser recusada inteira', () => {
    const { patch, ignored } = sanitizeAdminUserPatch({
      city: 'Canoas', role: 'platform_admin', email_public: true, uid: 'outro',
    });
    expect(patch).toEqual({ city: 'Canoas' });
    expect(ignored.sort()).toEqual(['email_public', 'role', 'uid']);
  });

  it('normaliza: trim, UF em maiúsculas e limite de tamanho', () => {
    const { patch } = sanitizeAdminUserPatch({ city: '  Canoas ', state: 'rs', phone: ' 51 9 ' });
    expect(patch.city).toBe('Canoas');
    expect(patch.state).toBe('RS');
    expect(patch.phone).toBe('51 9');
  });

  it('UF longa é cortada em 2', () => {
    expect(sanitizeAdminUserPatch({ state: 'Rio Grande do Sul' }).patch.state).toBe('RI');
  });

  it('número inválido vira null em vez de NaN', () => {
    expect(sanitizeAdminUserPatch({ dupr_rating: 'abc' }).patch.dupr_rating).toBeNull();
    expect(sanitizeAdminUserPatch({ dupr_rating: '3.75' }).patch.dupr_rating).toBe(3.75);
  });

  it('⭐ campo numérico VAZIO é ausência, nunca zero', () => {
    // `Number('')` é 0 e é finito. Sem a guarda, abrir um cadastro sem DUPR e
    // salvar gravaria `dupr_rating: 0` — valor errado injetado em silêncio.
    expect(sanitizeAdminUserPatch({ dupr_rating: '' }).patch.dupr_rating).toBeNull();
    expect(sanitizeAdminUserPatch({ dupr_rating: null }).patch.dupr_rating).toBeNull();
    expect(sanitizeAdminUserPatch({ dupr_rating: undefined }).patch.dupr_rating).toBeNull();
    // E zero de verdade continua sendo zero.
    expect(sanitizeAdminUserPatch({ dupr_rating: 0 }).patch.dupr_rating).toBe(0);
    expect(sanitizeAdminUserPatch({ dupr_rating: '0' }).patch.dupr_rating).toBe(0);
  });

  it('⭐ abrir um cadastro sem DUPR e não mexer em nada não gera alteração', () => {
    // A consequência prática do bug acima: o botão "salvar" ficava habilitado
    // sozinho e gravaria um zero que ninguém digitou.
    const semDupr = { platform_name: 'Ana', dupr_rating: '' };
    const { patch } = sanitizeAdminUserPatch(semDupr);
    expect(diffAdminUserPatch(semDupr, patch)).toHaveLength(0);
  });

  it('entrada vazia não quebra', () => {
    expect(sanitizeAdminUserPatch()).toEqual({ patch: {}, ignored: [] });
    expect(sanitizeAdminUserPatch(null)).toEqual({ patch: {}, ignored: [] });
  });
});

describe('diffAdminUserPatch — o antes/depois que vai para a auditoria', () => {
  it('⭐ registra só o que MUDOU, com rótulo legível', () => {
    const d = diffAdminUserPatch(completo, { city: 'Canoas', state: 'RS' });
    expect(d).toHaveLength(1);
    expect(d[0]).toEqual({ field: 'city', label: 'Cidade', from: 'Porto Alegre', to: 'Canoas' });
  });

  it('valor igual não vira alteração (evita escrita à toa)', () => {
    expect(diffAdminUserPatch(completo, { city: 'Porto Alegre' })).toHaveLength(0);
    expect(diffAdminUserPatch(completo, { dupr_rating: 3.5 })).toHaveLength(0);
  });

  it('preencher campo vazio é alteração, com "de" vazio', () => {
    const d = diffAdminUserPatch({ platform_name: 'Ana' }, { city: 'Canoas' });
    expect(d[0]).toMatchObject({ field: 'city', from: '', to: 'Canoas' });
  });

  it('campo fora da lista é ignorado no diff', () => {
    expect(diffAdminUserPatch(completo, { role: 'platform_admin' })).toHaveLength(0);
  });
});

describe('missingUserFields — a parte "complementar o que falta"', () => {
  it('cadastro completo não tem pendência', () => {
    expect(missingUserFields(completo)).toHaveLength(0);
    expect(isUserRecordComplete(completo)).toBe(true);
  });

  it('⭐ aponta exatamente o que está vazio', () => {
    const faltando = missingUserFields({ platform_name: 'Ana', city: '  ' });
    const chaves = faltando.map((f) => f.key);
    expect(chaves).toContain('birth_date');
    expect(chaves).toContain('phone');
    expect(chaves).toContain('city'); // só espaços conta como vazio
    expect(chaves).not.toContain('platform_name');
  });

  it('⭐ separa o que é OBRIGATÓRIO do que é opcional', () => {
    const s = userRecordStatus({ platform_name: 'Ana' });
    expect(s.complete).toBe(false);
    expect(s.missingRequired.map((f) => f.key).sort())
      .toEqual(['birth_date', 'phone', 'pickleball_experience']);
    expect(s.filledCount).toBe(1);
    expect(s.totalCount).toBe(ADMIN_EDITABLE_FIELDS.length);
  });

  it('cadastro só com obrigatórios já conta como completo', () => {
    const s = userRecordStatus({
      platform_name: 'Ana', birth_date: '1990-01-01', phone: '51999999999',
      pickleball_experience: '1-2 anos',
    });
    expect(s.complete).toBe(true);
    expect(s.missingCount).toBeGreaterThan(0); // ainda há opcionais a preencher
  });

  it('documento vazio não quebra', () => {
    expect(userRecordStatus({}).complete).toBe(false);
    expect(userRecordStatus().missingCount).toBe(ADMIN_EDITABLE_FIELDS.length);
  });
});

describe('validateAdminEdit — motivo é obrigatório', () => {
  const mudanca = [{ field: 'city', label: 'Cidade', from: 'a', to: 'b' }];

  it('⭐ edição de dado alheio SEM motivo não passa', () => {
    const v = validateAdminEdit({ changes: mudanca, reason: '' });
    expect(v.isValid).toBe(false);
    expect(v.errors.reason).toBeTruthy();
  });

  it('motivo curto demais também não passa', () => {
    expect(validateAdminEdit({ changes: mudanca, reason: 'oi' }).isValid).toBe(false);
  });

  it('sem alteração nenhuma não passa', () => {
    expect(validateAdminEdit({ changes: [], reason: 'corrigindo a pedido' }).isValid).toBe(false);
  });

  it('com alteração e motivo, passa', () => {
    expect(validateAdminEdit({ changes: mudanca, reason: 'a pedido do atleta' }).isValid).toBe(true);
  });
});
