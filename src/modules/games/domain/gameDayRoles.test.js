import { describe, it, expect } from 'vitest';
import {
  GAME_DAY_MANAGE_MODE, gameDayManageMode, isGameDayOpenToParticipants,
  gameDayAdminUids, isGameDayCreator, isGameDayAdmin, isGameDayParticipant,
  canConfigureGameDay, canManageGameDay, gameDayAdminList,
} from './gameDayRoles.js';

const DONO = 'uid-dono';
const ADMIN = 'uid-admin';
const JOGA = 'uid-joga';
const ESTRANHO = 'uid-estranho';

const dia = (extra = {}) => ({
  id: 'gd1', created_by: DONO, member_uids: [DONO, ADMIN, JOGA], ...extra,
});
const participantes = [
  { id: 'p1', user_id: DONO }, { id: 'p2', user_id: ADMIN },
  { id: 'p3', user_id: JOGA }, { id: 'p4', user_id: null, name: 'Convidado' },
];

describe('modo de gestão', () => {
  it('sem o campo, é RESTRITO — nenhum dia de jogo antigo muda de comportamento', () => {
    expect(gameDayManageMode(dia())).toBe(GAME_DAY_MANAGE_MODE.OWNER_ONLY);
    expect(gameDayManageMode({})).toBe(GAME_DAY_MANAGE_MODE.OWNER_ONLY);
    expect(gameDayManageMode(null)).toBe(GAME_DAY_MANAGE_MODE.OWNER_ONLY);
  });

  it('valor desconhecido também cai no restrito', () => {
    expect(gameDayManageMode(dia({ manage_mode: 'qualquer_coisa' }))).toBe(GAME_DAY_MANAGE_MODE.OWNER_ONLY);
    expect(gameDayManageMode(dia({ manage_mode: true }))).toBe(GAME_DAY_MANAGE_MODE.OWNER_ONLY);
  });

  it('reconhece o modo aberto', () => {
    const aberto = dia({ manage_mode: GAME_DAY_MANAGE_MODE.PARTICIPANTS });
    expect(gameDayManageMode(aberto)).toBe(GAME_DAY_MANAGE_MODE.PARTICIPANTS);
    expect(isGameDayOpenToParticipants(aberto)).toBe(true);
    expect(isGameDayOpenToParticipants(dia())).toBe(false);
  });
});

describe('administradores', () => {
  it('o criador NÃO entra na lista de nomeados (ele já é admin por ser criador)', () => {
    expect(gameDayAdminUids(dia({ admin_uids: [DONO, ADMIN] }))).toEqual([ADMIN]);
  });

  it('normaliza: sem campo, com nulos, com repetição', () => {
    expect(gameDayAdminUids(dia())).toEqual([]);
    expect(gameDayAdminUids(dia({ admin_uids: null }))).toEqual([]);
    expect(gameDayAdminUids(dia({ admin_uids: [ADMIN, null, '', ADMIN, 42] }))).toEqual([ADMIN]);
  });

  it('o criador é sempre admin, esteja ou não na lista', () => {
    expect(isGameDayCreator(dia(), DONO)).toBe(true);
    expect(isGameDayAdmin(dia(), DONO)).toBe(true);
    expect(isGameDayAdmin(dia({ admin_uids: [] }), DONO)).toBe(true);
  });

  it('quem foi nomeado é admin; quem não foi, não', () => {
    const d = dia({ admin_uids: [ADMIN] });
    expect(isGameDayAdmin(d, ADMIN)).toBe(true);
    expect(isGameDayAdmin(d, JOGA)).toBe(false);
    expect(isGameDayAdmin(d, ESTRANHO)).toBe(false);
  });

  it('sem uid, ninguém é nada', () => {
    expect(isGameDayAdmin(dia(), null)).toBe(false);
    expect(isGameDayCreator(dia(), undefined)).toBe(false);
  });
});

describe('participação', () => {
  it('usa a lista de participantes quando ela existe', () => {
    expect(isGameDayParticipant(dia(), JOGA, participantes)).toBe(true);
    expect(isGameDayParticipant(dia(), ESTRANHO, participantes)).toBe(false);
  });

  it('sem a lista, cai em member_uids', () => {
    expect(isGameDayParticipant(dia(), JOGA, null)).toBe(true);
    expect(isGameDayParticipant(dia(), ESTRANHO, null)).toBe(false);
  });

  it('convidado avulso (sem conta) não conta como uid participante', () => {
    expect(isGameDayParticipant(dia(), null, participantes)).toBe(false);
  });
});

describe('canConfigureGameDay — só o criador', () => {
  it('o criador configura', () => {
    expect(canConfigureGameDay(dia({ admin_uids: [ADMIN] }), DONO)).toBe(true);
  });

  it('nem o admin nomeado, nem o participante, nem estranho configuram', () => {
    const d = dia({ admin_uids: [ADMIN], manage_mode: GAME_DAY_MANAGE_MODE.PARTICIPANTS });
    expect(canConfigureGameDay(d, ADMIN)).toBe(false);
    expect(canConfigureGameDay(d, JOGA)).toBe(false);
    expect(canConfigureGameDay(d, ESTRANHO)).toBe(false);
  });
});

describe('canManageGameDay — modo RESTRITO (o padrão)', () => {
  const d = dia({ admin_uids: [ADMIN] });

  it('criador e admin gerenciam', () => {
    expect(canManageGameDay(d, DONO, { participants: participantes })).toBe(true);
    expect(canManageGameDay(d, ADMIN, { participants: participantes })).toBe(true);
  });

  it('participante comum NÃO gerencia', () => {
    expect(canManageGameDay(d, JOGA, { participants: participantes })).toBe(false);
  });

  it('estranho não gerencia', () => {
    expect(canManageGameDay(d, ESTRANHO, { participants: participantes })).toBe(false);
  });
});

describe('canManageGameDay — modo ABERTO', () => {
  const d = dia({ admin_uids: [ADMIN], manage_mode: GAME_DAY_MANAGE_MODE.PARTICIPANTS });

  it('participante inscrito passa a gerenciar', () => {
    expect(canManageGameDay(d, JOGA, { participants: participantes })).toBe(true);
  });

  it('criador e admin seguem gerenciando', () => {
    expect(canManageGameDay(d, DONO, { participants: participantes })).toBe(true);
    expect(canManageGameDay(d, ADMIN, { participants: participantes })).toBe(true);
  });

  it('quem NÃO está inscrito continua de fora, mesmo com o dia aberto', () => {
    expect(canManageGameDay(d, ESTRANHO, { participants: participantes })).toBe(false);
  });

  it('abrir o dia não dá poder de CONFIGURAR a ninguém', () => {
    expect(canConfigureGameDay(d, JOGA)).toBe(false);
  });
});

describe('canManageGameDay — bordas', () => {
  it('sem uid ou sem dia de jogo, é sempre não', () => {
    expect(canManageGameDay(dia(), null)).toBe(false);
    expect(canManageGameDay(null, DONO)).toBe(false);
    expect(canManageGameDay(undefined, undefined)).toBe(false);
  });

  it('sem a lista de participantes, o modo aberto usa member_uids', () => {
    const d = dia({ manage_mode: GAME_DAY_MANAGE_MODE.PARTICIPANTS });
    expect(canManageGameDay(d, JOGA)).toBe(true);
    expect(canManageGameDay(d, ESTRANHO)).toBe(false);
  });
});

describe('gameDayAdminList', () => {
  it('traz o criador primeiro, marcado', () => {
    const lista = gameDayAdminList(dia({ admin_uids: [ADMIN] }));
    expect(lista.map((a) => a.uid)).toEqual([DONO, ADMIN]);
    expect(lista[0].criador).toBe(true);
    expect(lista[1].criador).toBe(false);
  });

  it('enriquece com nome e foto quando há perfis', () => {
    const perfis = new Map([[ADMIN, { platform_name: 'Bia', photo_url: 'x.png' }]]);
    const lista = gameDayAdminList(dia({ admin_uids: [ADMIN] }), perfis);
    expect(lista[1].nome).toBe('Bia');
    expect(lista[1].foto).toBe('x.png');
    expect(lista[0].nome).toBeNull();
  });

  it('dia de jogo sem criador não quebra', () => {
    expect(gameDayAdminList({})).toEqual([]);
    expect(gameDayAdminList(null)).toEqual([]);
  });
});
