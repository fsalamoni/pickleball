import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  PLAY_KIND, PLAY_WINDOW_DAYS, nextDaysISO, gameDayEndsAt, gameDayStartsAt, gameDayPlace,
  arenaGameDayHasLimit, gameDayVacanciesLeft, buildPlayList, playItemsForMe, PLAY_ORIGIN,
} from './playDiscovery.js';

// Quarta, 30/09/2026, 10:00 (hora local).
const agora = new Date(2026, 8, 30, 10, 0).getTime();
const hoje = '2026-09-30';

const diaArena = (over = {}) => ({
  id: 'arena1',
  title: 'Dia de jogo da arena',
  visibility: 'public',
  status: 'active',
  arena_id: 'A1',
  arena_name: 'Arena Sol',
  arena_city: 'Canoas',
  arena_state: 'RS',
  created_by: 'gestor',
  member_uids: ['gestor'],
  date: '2026-10-02',
  capacity: 8,
  arena_slots: [{ court_id: 'q1', court_name: 'Quadra 1', start_time: '18:00', end_time: '21:00' }],
  ...over,
});
const diaAtleta = (over = {}) => ({
  id: 'atleta1',
  title: 'Racha de sábado',
  visibility: 'public',
  status: 'active',
  created_by: 'ana',
  creator_name: 'Ana',
  member_uids: ['ana'],
  date: '2026-10-03',
  time: '09:00',
  city: 'Porto Alegre',
  state: 'RS',
  ...over,
});

describe('janela de dias', () => {
  it('hoje e os próximos, no máximo 30 (o limite do `in` do Firestore)', () => {
    const dias = nextDaysISO(hoje);
    expect(dias).toHaveLength(PLAY_WINDOW_DAYS);
    expect(dias[0]).toBe('2026-09-30');
    expect(dias[1]).toBe('2026-10-01'); // virada de mês local
    expect(nextDaysISO(hoje, 999)).toHaveLength(30);
    expect(nextDaysISO('lixo')).toEqual([]);
  });
});

describe('quando começa e termina', () => {
  it('arena: a faixa de horário; atleta: o início + 3 h; sem hora, o fim do dia', () => {
    expect(new Date(gameDayStartsAt(diaArena())).getHours()).toBe(18);
    expect(new Date(gameDayEndsAt(diaArena())).getHours()).toBe(21);
    expect(new Date(gameDayEndsAt(diaAtleta())).getHours()).toBe(12);
    const semHora = new Date(gameDayEndsAt(diaAtleta({ time: null })));
    expect([semHora.getHours(), semHora.getMinutes()]).toEqual([23, 59]);
  });
  it('lugar: o do dia; na arena, o da arena', () => {
    expect(gameDayPlace(diaAtleta())).toEqual({ city: 'Porto Alegre', state: 'RS' });
    expect(gameDayPlace(diaArena())).toEqual({ city: 'Canoas', state: 'RS' });
    const semCopia = diaArena({ arena_city: null, arena_state: null });
    expect(gameDayPlace(semCopia, new Map([['A1', { city: 'Esteio', state: 'RS' }]]))).toEqual({ city: 'Esteio', state: 'RS' });
  });
});

describe('vagas da arena', () => {
  it('conta só quando há teto', () => {
    expect(arenaGameDayHasLimit(diaArena())).toBe(true);
    expect(arenaGameDayHasLimit(diaArena({ capacity: null }))).toBe(false);
    expect(arenaGameDayHasLimit(diaAtleta())).toBe(false);
    expect(gameDayVacanciesLeft(diaArena(), [{ user_id: 'x' }, { user_id: 'y' }])).toBe(6);
    expect(gameDayVacanciesLeft(diaArena(), undefined)).toBeNull(); // ainda não sabe
  });
});

describe('buildPlayList', () => {
  const base = { hoje, agora, uid: 'eu' };

  it('⭐ o dia de jogo da ARENA aparece — era o que faltava — e leva para DENTRO dele', () => {
    const lista = buildPlayList({ ...base, diasPublicos: [diaArena()] });
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      kind: PLAY_KIND.DIA, link: '/dia-de-jogo/arena1', daArena: true, place: { city: 'Canoas', state: 'RS' },
    });
    expect(lista[0].subtitle).toContain('18:00–21:00');
    expect(lista[0].subtitle).toContain('Arena Sol');
  });

  it('mostra as vagas que sobram e tira o lotado', () => {
    const cheio = Array.from({ length: 8 }, (_, i) => ({ user_id: `u${i}` }));
    const inscritosPorDia = new Map([['arena1', [{ user_id: 'a' }]]]);
    expect(buildPlayList({ ...base, diasPublicos: [diaArena()], inscritosPorDia })[0].badge).toBe('7 vagas');
    expect(buildPlayList({ ...base, diasPublicos: [diaArena()], inscritosPorDia: new Map([['arena1', cheio]]) })).toEqual([]);
  });

  it('⭐ o que já passou não aparece: o dia que terminou hoje, o de ontem, o convite vencido', () => {
    const cedo = diaArena({ id: 'cedo', date: hoje, arena_slots: [{ court_id: 'q', start_time: '07:00', end_time: '09:00' }] });
    const tarde = diaArena({ id: 'tarde', date: hoje });
    const ontem = diaAtleta({ id: 'ontem', date: '2026-09-29' });
    const lista = buildPlayList({
      ...base,
      diasPublicos: [cedo, tarde, ontem],
      convites: [{ id: 'c1', status: 'open', date: '2026-09-29', when_text: 'ontem', created_by: 'b' }],
    });
    expect(lista.map((i) => i.id)).toEqual(['tarde']);
  });

  it('convite sem data vale 14 dias desde a última atualização', () => {
    const velho = { id: 'velho', status: 'open', when_text: 'sábado', created_by: 'b', created_at: Timestamp.fromMillis(agora - 20 * 86_400_000) };
    const novo = { id: 'novo', status: 'open', when_text: 'domingo', created_by: 'b', created_at: Timestamp.fromMillis(agora - 2 * 86_400_000) };
    const lista = buildPlayList({ ...base, convites: [velho, novo] });
    expect(lista.map((i) => i.id)).toEqual(['novo']);
    expect(lista[0].link).toBe('/procura-jogo');
  });

  it('o que a pessoa CRIOU não aparece (ela organiza); o que ela já tem aparece com "Você vai"', () => {
    const lista = buildPlayList({
      ...base,
      diasPublicos: [diaAtleta({ created_by: 'eu' }), diaArena({ member_uids: ['gestor', 'eu'] }), diaAtleta({ id: 'outro' })],
      meusDias: new Set(['outro']),
    });
    expect(lista.map((i) => [i.id, i.estou, i.badge])).toEqual([
      ['arena1', true, 'Você vai'],
      ['outro', true, 'Você vai'],
    ]);
  });

  it('⭐ ficar na lista depois de entrar: sumir no clique parece que falhou', () => {
    const lotadoComigo = diaArena({ capacity: 2, member_uids: ['gestor', 'eu'] });
    const inscritos = new Map([['arena1', [{ user_id: 'eu' }, { user_id: 'b' }]]]);
    const [item] = buildPlayList({ ...base, diasPublicos: [lotadoComigo], inscritosPorDia: inscritos });
    expect(item).toMatchObject({ estou: true, badge: 'Você vai', vagas: null });
  });

  it('quem administra (nomeado) é membro do dia sem ser jogador: não conta como "estou"', () => {
    const [item] = buildPlayList({
      ...base,
      diasPublicos: [diaAtleta({ admin_uids: ['eu'], member_uids: ['ana', 'eu'] })],
    });
    expect(item.estou).toBe(false);
  });

  it('com a lista de inscritos em mãos, é ela que diz se estou', () => {
    const dia = diaAtleta({ member_uids: ['ana', 'eu'] });
    const [comLista] = buildPlayList({ ...base, diasPublicos: [dia], inscritosPorDia: new Map([['atleta1', []]]) });
    expect(comLista.estou).toBe(false);
  });

  it('um jogo, um item: o espelho do dia de jogo não duplica; o órfão não aparece', () => {
    const espelho = { id: 'og1', kind: 'game_day', game_day_id: 'atleta1', status: 'open', date: '2026-10-03', created_by: 'ana' };
    const orfao = { id: 'og2', kind: 'game_day', game_day_id: 'arquivado', status: 'open', date: '2026-10-05', created_by: 'ana' };
    const semData = { id: 'og3', kind: 'game_day', game_day_id: 'semdata', status: 'open', date: null, when_text: 'Racha', created_by: 'ana', updated_at: Timestamp.fromMillis(agora) };
    const lista = buildPlayList({ ...base, diasPublicos: [diaAtleta()], convites: [espelho, orfao, semData] });
    expect(lista.map((i) => i.key)).toEqual(['dia:atleta1', 'convite:og3']);
    // o espelho sem data leva para dentro do dia de jogo
    expect(lista[1].link).toBe('/dia-de-jogo/semdata');
  });

  it('o dia de jogo que nasceu de um jogo aberto aparece pela vitrine, que leva ao dia', () => {
    const vaga = {
      id: 's1', arena_id: 'A1', arena_name: 'Arena Sol', date: '2026-10-01', start: '19:00', end: '21:00',
      total_spots: 4, participants: ['x'], game_day_id: 'gdSlot',
    };
    const lista = buildPlayList({
      ...base,
      diasPublicos: [diaArena({ id: 'gdSlot', open_slot_id: 's1' })],
      vagas: [vaga],
      arenasById: new Map([['A1', { name: 'Arena Sol', city: 'Canoas', state: 'RS' }]]),
    });
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      kind: PLAY_KIND.JOGO_ABERTO, link: '/dia-de-jogo/gdSlot', badge: '3 vagas', place: { city: 'Canoas', state: 'RS' },
    });
  });

  it('jogo aberto lotado não entra; o que já tenho entra, com "Você vai"', () => {
    const vagas = [
      { id: 's1', arena_id: 'A', date: '2026-10-01', start: '19:00', total_spots: 4, participants: ['eu'] },
      { id: 's2', arena_id: 'A', date: '2026-10-01', start: '19:00', total_spots: 2, participants: ['a', 'b'] },
      { id: 's3', arena_id: 'A', date: '2026-10-01', start: '20:00', total_spots: 2, participants: ['a', 'eu'] },
    ];
    expect(buildPlayList({ ...base, vagas }).map((i) => [i.id, i.estou])).toEqual([['s1', true], ['s3', true]]);
  });

  it('⭐ requisitos: o jogo aberto diz se o meu nível cabe na faixa (e por quê, quando não)', () => {
    const vagas = [
      { id: 'baixo', arena_id: 'A', date: '2026-10-01', start: '19:00', total_spots: 4, participants: [], min_level: 2.5, max_level: 3.0 },
      { id: 'meu', arena_id: 'A', date: '2026-10-01', start: '20:00', total_spots: 4, participants: [], min_level: 3.5, max_level: 4.5 },
      { id: 'livre', arena_id: 'A', date: '2026-10-01', start: '21:00', total_spots: 4, participants: [] },
    ];
    const lista = buildPlayList({ ...base, vagas, nivel: 4.0 });
    expect(lista.map((i) => [i.id, i.cabe])).toEqual([['baixo', false], ['meu', true], ['livre', true]]);
    expect(lista[0].motivo).toMatch(/até o nível 3.0/);
    // O início mostra só o que eu posso entrar (ou já tenho).
    expect(playItemsForMe(lista).map((i) => i.id)).toEqual(['meu', 'livre']);
  });

  it('nível desconhecido não barra ninguém (a plataforma não inventa nível)', () => {
    const vagas = [{ id: 'faixa', arena_id: 'A', date: '2026-10-01', start: '19:00', total_spots: 4, participants: [], min_level: 4.0 }];
    expect(buildPlayList({ ...base, vagas, nivel: null })[0].cabe).toBe(true);
  });

  it('ordena do mais cedo para o mais tarde; convite sem data no fim', () => {
    const lista = buildPlayList({
      ...base,
      diasPublicos: [diaAtleta({ id: 'sab' }), diaArena({ id: 'sex', date: '2026-10-02' })],
      convites: [{ id: 'flex', status: 'open', when_text: 'qualquer dia', created_by: 'b' }],
    });
    expect(lista.map((i) => i.id)).toEqual(['sex', 'sab', 'flex']);
  });

  it('privado ou arquivado não entra, mesmo que chegue', () => {
    expect(buildPlayList({ ...base, diasPublicos: [diaAtleta({ visibility: 'private' }), diaArena({ status: 'archived' })] })).toEqual([]);
  });
});

describe('⭐ os dias de jogo dos CLUBES da pessoa', () => {
  const base = { hoje, agora, uid: 'eu' };
  const diaClube = (over = {}) => ({
    id: 'clube1',
    title: 'Terça do clube · 06/10',
    visibility: 'private',
    status: 'active',
    club_id: 'c1',
    club_name: 'Clube Ace',
    created_by: 'org',
    member_uids: ['org'],
    date: '2026-10-06',
    time: '19:00',
    ...over,
  });
  const clubesById = new Map([['c1', { id: 'c1', name: 'Clube Ace', city: 'Canoas', state: 'RS' }]]);

  it('entram mesmo privados — é por ser do clube que a pessoa os recebe —, com a cidade do clube', () => {
    const [item] = buildPlayList({ ...base, diasDoClube: [diaClube()], clubesById });
    expect(item).toMatchObject({
      origem: PLAY_ORIGIN.CLUBE, link: '/dia-de-jogo/clube1', estou: false, cabe: true, badge: 'Do seu clube',
      place: { city: 'Canoas', state: 'RS' },
    });
    expect(item.subtitle).toMatch(/Clube Ace/);
  });

  it('quem agendou a data pode entrar para jogar: a lista de inscritos diz se ele vai', () => {
    const dia = diaClube({ created_by: 'eu', member_uids: ['eu'] });
    const [semEntrar] = buildPlayList({ ...base, diasDoClube: [dia], inscritosPorDia: new Map([['clube1', []]]) });
    expect(semEntrar.estou).toBe(false);
    const [jogando] = buildPlayList({ ...base, diasDoClube: [dia], inscritosPorDia: new Map([['clube1', [{ user_id: 'eu' }]]]) });
    expect(jogando).toMatchObject({ estou: true, badge: 'Você vai' });
  });

  it('o que já passou e o arquivado não aparecem; sem `club_id` não é dia de clube', () => {
    const lista = buildPlayList({
      ...base,
      diasDoClube: [
        diaClube({ id: 'ontem', date: '2026-09-29' }),
        diaClube({ id: 'arq', status: 'archived' }),
        diaClube({ id: 'sem', club_id: undefined }),
      ],
      clubesById,
    });
    expect(lista).toEqual([]);
  });

  it('o mesmo dia não aparece duas vezes (público e do clube)', () => {
    const dia = diaClube({ visibility: 'public' });
    const lista = buildPlayList({ ...base, diasPublicos: [dia], diasDoClube: [dia], clubesById });
    expect(lista).toHaveLength(1);
  });
});
