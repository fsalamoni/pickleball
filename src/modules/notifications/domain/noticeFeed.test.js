import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  BELL_LIMIT, NOTICE_AREA, NOTICE_AREAS, bellAccessibleLabel, bellSlice, filterNotices,
  formatUnreadBadge, groupNotices, noticeArea, noticeAreaCounts, noticeAreaFromLink,
  noticeFiltersFromParams, noticeFiltersToParams, noticeFullDate, noticeGroupOf, noticeTime,
  noticeTimeLabel, semAcento, sortNotices,
} from './noticeFeed';
import { mutedNotificationsSummary } from './preferences';

// Datas LOCAIS: o teste não depende do fuso da máquina.
const AGORA = new Date(2026, 8, 30, 14, 5).getTime(); // qua, 30/09/2026 14:05
const em = (...partes) => new Date(...partes).getTime();

describe('noticeTime — a hora de cada aviso', () => {
  it('⭐ lê o Timestamp do banco (não o número de segundos que ele vira com Number())', () => {
    const ms = em(2026, 8, 30, 10, 0);
    expect(noticeTime({ created_at: Timestamp.fromMillis(ms) })).toBe(ms);
  });

  it('⭐ logo depois de criado (serverTimestamp ainda nulo), vale o created_at_ms do cliente', () => {
    expect(noticeTime({ created_at: null, created_at_ms: 123456 })).toBe(123456);
  });

  it('aviso do servidor sem created_at_ms usa o created_at', () => {
    const ms = em(2026, 8, 1);
    expect(noticeTime({ created_at: Timestamp.fromMillis(ms) })).toBe(ms);
  });

  it('sem data legível: NaN (nunca 0 = 1970)', () => {
    expect(noticeTime({})).toBeNaN();
    expect(noticeTime(null)).toBeNaN();
  });
});

describe('sortNotices', () => {
  it('do mais novo ao mais antigo, e o sem data vai para o FIM (não finge ser novo)', () => {
    const lista = [
      { id: 'velho', created_at_ms: 1000 },
      { id: 'sem' },
      { id: 'novo', created_at: Timestamp.fromMillis(5000) },
      { id: 'meio', created_at_ms: 3000 },
    ];
    expect(sortNotices(lista).map((n) => n.id)).toEqual(['novo', 'meio', 'velho', 'sem']);
  });

  it('não altera a lista recebida e é estável no empate', () => {
    const lista = [{ id: 'a', created_at_ms: 1 }, { id: 'b', created_at_ms: 1 }];
    const copia = [...lista];
    expect(sortNotices(lista).map((n) => n.id)).toEqual(['a', 'b']);
    expect(lista).toEqual(copia);
  });
});

describe('noticeTimeLabel — o rótulo curto de tempo', () => {
  it('agora, minutos e horas no mesmo dia', () => {
    expect(noticeTimeLabel(AGORA - 20_000, AGORA)).toBe('agora');
    expect(noticeTimeLabel(AGORA - 5 * 60_000, AGORA)).toBe('há 5 min');
    expect(noticeTimeLabel(AGORA - 3 * 3_600_000, AGORA)).toBe('há 3 h');
  });

  it('relógio do aparelho um pouco atrasado não mostra tempo negativo', () => {
    expect(noticeTimeLabel(AGORA + 2 * 60_000, AGORA)).toBe('agora');
  });

  it('⭐ "ontem" é o dia de CALENDÁRIO anterior, não 24 h atrás', () => {
    // 23:50 de ontem, consultado às 00:10 de hoje: 20 min atrás, mas ontem.
    const meiaNoite = em(2026, 8, 30, 0, 10);
    expect(noticeTimeLabel(em(2026, 8, 29, 23, 50), meiaNoite)).toBe('ontem, 23:50');
    expect(noticeTimeLabel(em(2026, 8, 29, 9, 3), AGORA)).toBe('ontem, 09:03');
  });

  it('até 6 dias: dia da semana e hora', () => {
    expect(noticeTimeLabel(em(2026, 8, 28, 18, 0), AGORA)).toBe('seg, 18:00');
    expect(noticeTimeLabel(em(2026, 8, 24, 8, 0), AGORA)).toBe('qui, 08:00');
  });

  it('mais antigo: a data, com o ano só quando não é o corrente', () => {
    expect(noticeTimeLabel(em(2026, 7, 2, 10, 0), AGORA)).toBe('02/08');
    expect(noticeTimeLabel(em(2025, 11, 31, 10, 0), AGORA)).toBe('31/12/2025');
  });

  it('sem data: vazio', () => {
    expect(noticeTimeLabel(NaN, AGORA)).toBe('');
  });

  it('a data completa para o leitor de tela', () => {
    expect(noticeFullDate(em(2026, 8, 28, 14, 5))).toBe('segunda-feira, 28 de setembro de 2026, 14:05');
    expect(noticeFullDate(NaN)).toBe('');
  });
});

describe('grupos do dia', () => {
  it('Hoje, Ontem, Nos últimos 7 dias e um grupo por mês', () => {
    expect(noticeGroupOf(AGORA - 60_000, AGORA).label).toBe('Hoje');
    expect(noticeGroupOf(em(2026, 8, 29, 8, 0), AGORA).label).toBe('Ontem');
    expect(noticeGroupOf(em(2026, 8, 24, 8, 0), AGORA).label).toBe('Nos últimos 7 dias');
    expect(noticeGroupOf(em(2026, 8, 23, 8, 0), AGORA).label).toBe('Setembro de 2026');
    expect(noticeGroupOf(em(2025, 0, 5), AGORA)).toEqual({ key: 'mes-2025-01', label: 'Janeiro de 2025' });
    expect(noticeGroupOf(NaN, AGORA).label).toBe('Sem data');
  });

  it('agrupa preservando a ordem da lista', () => {
    const lista = sortNotices([
      { id: 'h1', created_at_ms: AGORA - 1000 },
      { id: 'h2', created_at_ms: AGORA - 2000 },
      { id: 'o', created_at_ms: em(2026, 8, 29, 10) },
      { id: 'ago', created_at_ms: em(2026, 7, 10) },
      { id: 'sem' },
    ]);
    const grupos = groupNotices(lista, AGORA);
    expect(grupos.map((g) => [g.label, g.items.map((n) => n.id)])).toEqual([
      ['Hoje', ['h1', 'h2']],
      ['Ontem', ['o']],
      ['Agosto de 2026', ['ago']],
      ['Sem data', ['sem']],
    ]);
  });
});

describe('noticeArea — de onde vem cada aviso', () => {
  it('o tipo específico decide', () => {
    expect(noticeArea({ type: 'chat_message' })).toBe(NOTICE_AREA.SOCIAL);
    expect(noticeArea({ type: 'partner_invite', link: '/arenas/x' })).toBe(NOTICE_AREA.TORNEIOS);
    expect(noticeArea({ type: 'club_invite' })).toBe(NOTICE_AREA.CLUBES);
    expect(noticeArea({ type: 'profile_admin_edit' })).toBe(NOTICE_AREA.CONTA);
  });

  it('⭐ o genérico (quase todo aviso da plataforma) decide pelo DESTINO', () => {
    const g = (link) => noticeArea({ type: 'generic', link });
    expect(g('/minhas-reservas')).toBe(NOTICE_AREA.ARENAS);
    expect(g('/dia-de-jogo/gd1')).toBe(NOTICE_AREA.JOGOS);
    expect(g('/arenas/A1/open-match')).toBe(NOTICE_AREA.JOGOS);
    expect(g('/arenas/A1/campanhas/c1')).toBe(NOTICE_AREA.PROMOCOES);
    expect(g('/campanhas/c1')).toBe(NOTICE_AREA.PROMOCOES);
    expect(g('/arenas/A1/aulas')).toBe(NOTICE_AREA.AULAS);
    expect(g('/minhas-aulas')).toBe(NOTICE_AREA.AULAS);
    expect(g('/arenas/A1/torneios')).toBe(NOTICE_AREA.TORNEIOS);
    expect(g('/torneios/t1/admin')).toBe(NOTICE_AREA.TORNEIOS);
    expect(g('/p/t1')).toBe(NOTICE_AREA.TORNEIOS);
    expect(g('/clubes/c1/eventos/e1')).toBe(NOTICE_AREA.CLUBES);
    expect(g('/chat?c=1')).toBe(NOTICE_AREA.SOCIAL);
    expect(g('/atleta/u1')).toBe(NOTICE_AREA.SOCIAL);
    expect(g('/perfil/editar')).toBe(NOTICE_AREA.CONTA);
    expect(g('/perfil/torneios')).toBe(NOTICE_AREA.TORNEIOS);
    expect(g('/arenas/A1#arena-planos')).toBe(NOTICE_AREA.ARENAS);
  });

  it('⭐ os avisos da gamificação caem em Gamificação (o servidor os escreve com tipo `gamification` e link para o hub)', () => {
    expect(noticeArea({ type: 'gamification', link: '/gamification?aba=duelo' })).toBe(NOTICE_AREA.GAMIFICACAO);
    const g = (link) => noticeArea({ type: 'generic', link });
    expect(g('/gamification')).toBe(NOTICE_AREA.GAMIFICACAO);
    expect(g('/gamification/revisao')).toBe(NOTICE_AREA.GAMIFICACAO);
    expect(g('/gamification?aba=recompensas')).toBe(NOTICE_AREA.GAMIFICACAO);
    expect(g('/vinculos?aba=mentorias')).toBe(NOTICE_AREA.GAMIFICACAO);
    expect(g('/conquistas')).toBe(NOTICE_AREA.GAMIFICACAO);
    expect(g('/hall-da-fama')).toBe(NOTICE_AREA.GAMIFICACAO);
  });

  it('a gestão da arena é Arenas, mesmo quando o assunto é aula ou dia de jogo', () => {
    expect(noticeAreaFromLink('/arenas/A1/gerir?aba=pedidos')).toBe(NOTICE_AREA.ARENAS);
    expect(noticeAreaFromLink('/arenas/A1/gerir/dia-de-jogo/g1')).toBe(NOTICE_AREA.ARENAS);
    expect(noticeAreaFromLink('/arenas/A1/gerir/aulas')).toBe(NOTICE_AREA.ARENAS);
  });

  it('sem pista: Outros (e link estranho não quebra)', () => {
    expect(noticeArea({ type: 'generic' })).toBe(NOTICE_AREA.OUTROS);
    expect(noticeArea({ type: 'generic', link: '/rota-que-nao-existe' })).toBe(NOTICE_AREA.OUTROS);
    expect(noticeArea({ type: 'generic', link: '//site.com/x' })).toBe(NOTICE_AREA.OUTROS);
    expect(noticeArea({ type: 'generic', link: 42 })).toBe(NOTICE_AREA.OUTROS);
    expect(noticeArea(null)).toBe(NOTICE_AREA.OUTROS);
  });

  it('toda área tem rótulo, e os ids não se repetem', () => {
    const ids = NOTICE_AREAS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(Object.values(NOTICE_AREA)));
    NOTICE_AREAS.forEach((a) => { expect(a.label).toBeTruthy(); expect(a.curto).toBeTruthy(); });
  });
});

describe('filtros', () => {
  const lista = [
    { id: '1', title: 'Reserva confirmada', message: 'Quadra 2', link: '/minhas-reservas', read: false },
    { id: '2', title: 'Nova mensagem', message: 'Ana: bora jogar?', type: 'chat_message', read: true, actor_name: 'Ana Souza' },
    { id: '3', title: 'Dia de jogo cancelado', message: 'Reunião da arena', link: '/dia-de-jogo/g', read: false },
  ];

  it('não lidas, área e busca (sem acento, vários termos estreitam)', () => {
    expect(filterNotices(lista, { somenteNaoLidas: true }).map((n) => n.id)).toEqual(['1', '3']);
    expect(filterNotices(lista, { area: NOTICE_AREA.SOCIAL }).map((n) => n.id)).toEqual(['2']);
    expect(filterNotices(lista, { busca: 'reuniao' }).map((n) => n.id)).toEqual(['3']);
    expect(filterNotices(lista, { busca: 'souza' }).map((n) => n.id)).toEqual(['2']);
    expect(filterNotices(lista, { busca: 'quadra reserva' }).map((n) => n.id)).toEqual(['1']);
    expect(filterNotices(lista, { busca: 'quadra mensagem' })).toEqual([]);
    expect(filterNotices(lista, {}).length).toBe(3);
  });

  it('áreas presentes, na ordem dos filtros, com total e não lidas', () => {
    expect(noticeAreaCounts(lista).map((a) => [a.id, a.total, a.naoLidas])).toEqual([
      [NOTICE_AREA.JOGOS, 1, 1],
      [NOTICE_AREA.ARENAS, 1, 1],
      [NOTICE_AREA.SOCIAL, 1, 0],
    ]);
  });

  it('semAcento', () => {
    expect(semAcento('Ação Rápida')).toBe('acao rapida');
  });
});

describe('o sino', () => {
  it('selo: vazio, número, e 99+ (um círculo de 16 px não cabe "137")', () => {
    expect(formatUnreadBadge(0)).toBe('');
    expect(formatUnreadBadge(-3)).toBe('');
    expect(formatUnreadBadge(7)).toBe('7');
    expect(formatUnreadBadge(99)).toBe('99');
    expect(formatUnreadBadge(137)).toBe('99+');
  });

  it('nome acessível com a contagem por extenso', () => {
    expect(bellAccessibleLabel(0)).toBe('Notificações');
    expect(bellAccessibleLabel(1)).toBe('Notificações (1 não lida)');
    expect(bellAccessibleLabel(5)).toBe('Notificações (5 não lidas)');
  });

  it('⭐ o recorte diz quantos ficaram de fora — e quantos deles não foram lidos', () => {
    const lista = Array.from({ length: BELL_LIMIT + 5 }, (_, i) => ({ id: `n${i}`, read: i < BELL_LIMIT + 2 }));
    const r = bellSlice(lista);
    expect(r.itens).toHaveLength(BELL_LIMIT);
    expect(r.restantes).toBe(5);
    expect(r.naoLidasFora).toBe(3);
    expect(bellSlice([], 5)).toEqual({ itens: [], restantes: 0, naoLidasFora: 0 });
  });
});

describe('filtros na URL', () => {
  it('lê e valida (área inventada cai no padrão)', () => {
    const p = new URLSearchParams('filtro=nao-lidas&area=torneios&q=reserva&silenciados=1');
    expect(noticeFiltersFromParams(p)).toEqual({
      somenteNaoLidas: true, area: 'torneios', busca: 'reserva', silenciados: true,
    });
    expect(noticeFiltersFromParams(new URLSearchParams('area=hackeado')).area).toBeNull();
    expect(noticeFiltersFromParams(null)).toEqual({ somenteNaoLidas: false, area: null, busca: '', silenciados: false });
  });

  it('escreve só o que difere do padrão, e ida e volta dá o mesmo', () => {
    expect(noticeFiltersToParams({})).toEqual({});
    const f = { somenteNaoLidas: true, area: 'arenas', busca: 'quadra ', silenciados: false };
    const params = new URLSearchParams(noticeFiltersToParams(f));
    expect(noticeFiltersFromParams(params)).toEqual(f);
    expect(noticeFiltersToParams({ busca: '   ' })).toEqual({});
  });
});

describe('mutedNotificationsSummary — o que as preferências escondem', () => {
  it('conta por categoria silenciada e diz quais', () => {
    const lista = [
      { type: 'chat_message', read: false },
      { type: 'forum_reply', read: true },
      { type: 'tournament_open', read: false },
      { type: 'generic', read: false },
    ];
    expect(mutedNotificationsSummary(lista, { social: false })).toEqual({
      total: 2, naoLidas: 1, categorias: ['Mensagens e fórum'],
    });
    expect(mutedNotificationsSummary(lista, {})).toEqual({ total: 0, naoLidas: 0, categorias: [] });
  });
});
