import { describe, it, expect } from 'vitest';
import {
  readRecordFilters, hasActiveRecordFilters, filterRecords, sortRecords, withRecordIndex,
  recordsOverview, recordUfCounts, lastReminderByUid, reminderAudience, reminderAuditChunks,
  recordsCsv, csvCell, recordRole, NO_UF,
} from './userRecordsView';
import { userRecordStatus } from './adminUserEdit';
import { testAccountSignals } from './accountDeletion';
import { accountStatusOf } from './accountStatus';
import { duprRecordCheck } from './duprRecord';

const DIA = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 29, 12);

const COMPLETO = {
  platform_name: 'Completa', full_name: 'Ana Completa', birth_date: '1990-01-01', phone: '51999999999',
  gender: 'F', city: 'Porto Alegre', state: 'RS', address: 'Rua X', pickleball_experience: '1-2 anos',
  competition_gender: 'female', court_side: 'right', leveling_level: '3.5', dupr_id: 'DDQ0KL',
  dupr_rating: 3.5, photo_url: 'https://x/y.jpg',
};

const linha = (u) => withRecordIndex({
  ...u,
  _status: userRecordStatus(u, { essencial: true }),
  _teste: testAccountSignals(u),
  _conta: accountStatusOf(u, NOW),
  _dupr: duprRecordCheck(u),
});

const params = (obj) => new URLSearchParams(obj);

const ana = linha({ ...COMPLETO, uid: 'ana', platform_name: 'Ana', email: 'ana@x.com', created_at: NOW - 400 * DIA, last_login: NOW - 2 * DIA });
const bia = linha({ uid: 'bia', email: 'bia@x.com', platform_name: 'Beatriz', city: 'São Paulo', state: 'sp', created_at: NOW - 5 * DIA, last_login: NOW - 5 * DIA });
const caio = linha({ ...COMPLETO, uid: 'caio', platform_name: 'Caio', full_name: 'Caio Souza', state: 'XX', dupr_rating: 8, created_at: NOW - 100 * DIA, last_login: NOW - 200 * DIA, is_coach: true });
const sem = linha({ uid: 'sem', email: 'zz@x.com', account_status: 'blocked', role: 'platform_admin' });
const TODOS = [ana, bia, caio, sem];

describe('leitura dos filtros da URL', () => {
  it('valor inventado cai no padrão, em vez de virar uma lista vazia', () => {
    const f = readRecordFilters(params({ situacao: 'xpto', ordem: 'drop', falta: 'senha', uf: 'ZZ', atividade: '1', perfil: 'deus' }));
    expect(f).toMatchObject({ situacao: 'todos', ordem: 'prioridade', falta: '', uf: '', atividade: '', perfil: '' });
    expect(hasActiveRecordFilters(f)).toBe(false);
  });

  it('aceita o que existe; UF em minúscula vira maiúscula; "sem" é sem UF', () => {
    expect(readRecordFilters(params({ uf: 'rs', falta: 'city', situacao: 'dupr' }))).toMatchObject({ uf: 'RS', falta: 'city', situacao: 'dupr' });
    expect(readRecordFilters(params({ uf: NO_UF })).uf).toBe(NO_UF);
    expect(hasActiveRecordFilters(readRecordFilters(params({ uf: 'RS' })))).toBe(true);
  });
});

describe('filtros', () => {
  const f = (obj) => filterRecords(TODOS, { ...readRecordFilters(params({})), ...obj }, { now: NOW });
  const uids = (rows) => rows.map((r) => r.uid).sort();

  it('situação', () => {
    expect(uids(f({ situacao: 'pendentes' }))).toEqual(['bia', 'sem']);
    expect(uids(f({ situacao: 'completos' }))).toEqual(['ana', 'caio']);
    expect(uids(f({ situacao: 'dupr' }))).toEqual(['caio']);
    expect(uids(f({ situacao: 'fechadas' }))).toEqual(['sem']);
  });

  it('atividade: nunca ter entrado conta como "sem entrar"', () => {
    expect(uids(f({ atividade: 'novos' }))).toEqual(['bia']);
    expect(uids(f({ atividade: 'ativos' }))).toEqual(['ana', 'bia']);
    expect(uids(f({ atividade: 'inativos' }))).toEqual(['caio', 'sem']);
  });

  it('campo que falta, UF (UF inválida é "sem UF") e perfil', () => {
    expect(uids(f({ falta: 'birth_date' }))).toEqual(['bia', 'sem']);
    expect(uids(f({ uf: 'SP' }))).toEqual(['bia']);
    expect(uids(f({ uf: NO_UF }))).toEqual(['caio', 'sem']);
    expect(uids(f({ perfil: 'professores' }))).toEqual(['caio']);
    expect(uids(f({ perfil: 'admins' }))).toEqual(['sem']);
    expect(recordRole({ role: 'platform_admin', is_coach: true })).toBe('admins');
  });

  it('busca ignora acento e caixa, e cada palavra pode estar num campo', () => {
    expect(uids(f({ busca: 'sao paulo' }))).toEqual(['bia']);
    expect(uids(f({ busca: 'ana porto' }))).toEqual(['ana']);
    expect(uids(f({ busca: 'ddq0kl' }))).toEqual(['ana', 'caio']);
  });

  it('os filtros se somam', () => {
    expect(uids(f({ situacao: 'pendentes', atividade: 'novos' }))).toEqual(['bia']);
  });
});

describe('ordem', () => {
  const ordem = (o) => sortRecords(TODOS, o).map((r) => r.uid);

  it('padrão: obrigatório faltando, depois DUPR a conferir, depois em dia', () => {
    const r = ordem('prioridade');
    expect(r.slice(0, 2).sort()).toEqual(['bia', 'sem']);
    expect(r.slice(2)).toEqual(['caio', 'ana']);
  });

  it('nome A–Z, sem nome no fim', () => {
    expect(ordem('nome')).toEqual(['ana', 'bia', 'caio', 'sem']);
  });

  it('datas: ausente vai para o fim; "há mais tempo sem entrar" põe quem nunca entrou antes', () => {
    expect(ordem('recentes')).toEqual(['bia', 'caio', 'ana', 'sem']);
    expect(ordem('antigos')).toEqual(['ana', 'caio', 'bia', 'sem']);
    expect(ordem('acesso_antigo')).toEqual(['sem', 'caio', 'bia', 'ana']);
  });

  it('não altera a lista original', () => {
    const copia = [...TODOS];
    sortRecords(TODOS, 'nome');
    expect(TODOS).toEqual(copia);
  });
});

describe('panorama', () => {
  it('conta a base inteira e diz o que mais falta', () => {
    const r = recordsOverview(TODOS, { now: NOW });
    expect(r).toMatchObject({ total: 4, completos: 2, pendentes: 2, completosPct: 50, dupr: 1, fechadas: 1, novos: 1, ativos: 2, inativos: 2 });
    expect(r.porCampo[0]).toMatchObject({ count: 2 });
    expect(r.porCampo.every((c) => c.count > 0)).toBe(true);
    expect(r.porCampo.find((c) => c.key === 'city')).toMatchObject({ count: 1 });
  });

  it('base vazia não divide por zero', () => {
    expect(recordsOverview([], { now: NOW })).toMatchObject({ total: 0, completosPct: 0, porCampo: [] });
  });

  it('UFs com contagem, "sem UF" no fim', () => {
    expect(recordUfCounts(TODOS)).toEqual([
      { uf: 'RS', count: 1 }, { uf: 'SP', count: 1 }, { uf: NO_UF, count: 2 },
    ]);
  });
});

describe('pedido para completar o cadastro', () => {
  it('só quem tem obrigatório faltando e conta aberta', () => {
    const r = reminderAudience(TODOS, { now: NOW });
    expect(r).toEqual({ uids: ['bia'], recentes: 0, fechadas: 1, emDia: 2 });
  });

  it('quem recebeu há menos de 7 dias fica de fora; sem a Auditoria (null), ninguém é deixado de fora por isso', () => {
    const logs = [
      { created_at_ms: NOW - 2 * DIA, details: { uids: ['bia'] } },
      { created_at_ms: NOW - 30 * DIA, details: { uids: ['bia', 'ana'] } },
    ];
    const ultimo = lastReminderByUid(logs);
    expect(ultimo.get('bia')).toBe(NOW - 2 * DIA);
    expect(ultimo.get('ana')).toBe(NOW - 30 * DIA);
    expect(reminderAudience(TODOS, { lastReminder: ultimo, now: NOW })).toMatchObject({ uids: [], recentes: 1 });
    expect(reminderAudience(TODOS, { lastReminder: null, now: NOW }).uids).toEqual(['bia']);
    expect(reminderAudience(TODOS, { lastReminder: ultimo, now: NOW + 6 * DIA }).uids).toEqual(['bia']);
  });

  it('lotes de auditoria', () => {
    expect(reminderAuditChunks(['a', 'b', 'c'], 2)).toEqual([['a', 'b'], ['c']]);
    expect(reminderAuditChunks([])).toEqual([]);
  });
});

describe('planilha', () => {
  it('⭐ não leva e-mail nem telefone', () => {
    const csv = recordsCsv(TODOS);
    expect(csv).not.toContain('@x.com');
    expect(csv).not.toContain('51999999999');
    expect(csv.split('\r\n')).toHaveLength(5);
    expect(csv).toContain('3.500');
  });

  it('célula não vira fórmula nem quebra a coluna', () => {
    expect(csvCell('=SOMA(A1)')).toBe("'=SOMA(A1)");
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('diz "oi"')).toBe('"diz ""oi"""');
  });
});
