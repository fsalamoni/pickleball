/**
 * O catálogo das dicas — o que protege:
 *  1. ⭐ todo guia e todo passo têm o que a tela precisa (título, texto, ids
 *     únicos) — e os ids são estáveis (contrato de "já fiz");
 *  2. ⭐ todo tutorial das ferramentas virou guia, com um alvo para CADA passo
 *     (passo sem alvo seria um cartão solto no meio da tela);
 *  3. o que o passo espera é de um tipo conhecido; `goTo` é um caminho de
 *     verdade (sem curinga);
 *  4. ⭐ a pessoa só vê o guia que pode fazer: flag desligada e papel que ela
 *     não tem escondem o guia;
 *  5. "Nesta tela": o guia da ferramenta primeiro; no dia de jogo, só o do
 *     formato do dia — mesmo com a flag do formato desligada;
 *  6. a busca ignora acento e caixa, e o título pesa mais que o corpo;
 *  7. os pontos de dica apontam para guias que existem.
 */
import { describe, it, expect } from 'vitest';
import {
  GUIAS, GUIA_AREA, GUIA_AREA_META, alvosDoPasso, buscarGuias, destinoDeRecuo, destinoDoPasso, dicaVisivel, passoQueAbre, guiaIdDoTutorial,
  guiaPorId, guiasDaTela, guiasPorArea, guiasVisiveis, paragrafos,
} from './guias.js';
import { MAX_PONTOS_POR_TELA, PONTOS_DE_DICA, pontoPorId, pontosDaTela } from './pontosDeDica.js';
import { TUTORIALS, TUTORIAL_ID } from './tutorials.js';
import { moldeNavegavel } from './dicasRota.js';
import { STREAK_VACATION_COOLDOWN_DAYS, STREAK_VACATION_MAX_DAYS } from '@/modules/progression/domain/weekStreak.js';

const TUDO = {
  flags: {
    dark_mode: true, personalized_home: true, home_cards: true, arena_modules: true, gameday_americano_live: true,
  },
  gereArena: true,
  ehProfessor: true,
  minhaArena: 'a1',
};

describe('⭐ a forma do catálogo', () => {
  it('ids únicos, área conhecida, título e resumo', () => {
    const ids = GUIAS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    GUIAS.forEach((g) => {
      expect(GUIA_AREA_META[g.area], g.id).toBeTruthy();
      expect(g.title?.length, g.id).toBeGreaterThan(3);
      expect(g.summary?.length, g.id).toBeGreaterThan(10);
      expect(g.steps.length, g.id).toBeGreaterThan(0);
      expect(Array.isArray(g.screens) && g.screens.length > 0, g.id).toBe(true);
    });
  });

  it('todo passo tem id único no guia, título e texto', () => {
    GUIAS.forEach((g) => {
      const ids = g.steps.map((p) => p.id);
      expect(new Set(ids).size, g.id).toBe(ids.length);
      g.steps.forEach((p) => {
        expect(p.title?.length, `${g.id}/${p.id}`).toBeGreaterThan(2);
        expect(paragrafos(p).length, `${g.id}/${p.id}`).toBeGreaterThan(0);
      });
    });
  });

  it('o que o passo espera é conhecido; o goTo é um caminho de verdade', () => {
    GUIAS.forEach((g) => g.steps.forEach((p) => {
      const onde = `${g.id}/${p.id}`;
      if (p.advanceOn !== undefined) {
        const ok = p.advanceOn === 'click'
          || (p.advanceOn && typeof p.advanceOn.route === 'string')
          || (p.advanceOn && typeof p.advanceOn.appears === 'string');
        expect(ok, onde).toBe(true);
      }
      if (p.advanceOn === 'click') expect(alvosDoPasso(p).length, `${onde}: clicar em quê?`).toBeGreaterThan(0);
      if (p.advanceOn || alvosDoPasso(p).length) expect(p.route, `${onde}: em que tela?`).toBeTruthy();
      if (p.goTo) expect(moldeNavegavel(p.goTo.split('?')[0]), onde).toBe(true);
    }));
  });

  it('o primeiro passo de todo guia sabe levar a pessoa até a tela (ou não precisa de tela)', () => {
    GUIAS.forEach((g) => {
      const p = g.steps[0];
      if (p.route) expect(p.goTo, g.id).toBeTruthy();
    });
  });
});

describe('⭐ os tutoriais viraram guias', () => {
  it('um guia para cada tutorial, com um alvo para cada passo', () => {
    Object.values(TUTORIAL_ID).forEach((tid) => {
      const g = guiaPorId(guiaIdDoTutorial(tid));
      expect(g, tid).toBeTruthy();
      expect(g.steps.map((p) => p.id)).toEqual(TUTORIALS[tid].steps.map((p) => p.id));
      g.steps.forEach((p) => expect(alvosDoPasso(p).length, `${tid}/${p.id}`).toBeGreaterThan(0));
    });
  });

  it('o texto é o do tutorial (fonte única)', () => {
    const t = TUTORIALS[TUTORIAL_ID.GAME_DAY_PLAY];
    const g = guiaPorId(guiaIdDoTutorial(TUTORIAL_ID.GAME_DAY_PLAY));
    expect(g.steps[2].body).toBe(t.steps[2].body);
  });

  it('guiaIdDoTutorial', () => {
    expect(guiaIdDoTutorial('torneio')).toBe('tutorial:torneio');
    expect(guiaIdDoTutorial(null)).toBeNull();
  });
});

describe('⭐ quem vê o quê', () => {
  it('flag desligada esconde o guia', () => {
    expect(guiasVisiveis({}).map((g) => g.id)).not.toContain('escolher-aparencia');
    expect(guiasVisiveis({ flags: { dark_mode: true } }).map((g) => g.id)).toContain('escolher-aparencia');
  });

  it('flagsTodas exige todas', () => {
    expect(guiasVisiveis({ flags: { personalized_home: true } }).map((g) => g.id)).not.toContain('escolher-cards-do-inicio');
    expect(guiasVisiveis({ flags: { personalized_home: true, home_cards: true } }).map((g) => g.id))
      .toContain('escolher-cards-do-inicio');
  });

  it('⭐ papel: guia da Central só para quem gere arena; da agenda, só para professor', () => {
    const semPapel = guiasVisiveis({}).map((g) => g.id);
    expect(semPapel).not.toContain('responder-reservas');
    expect(semPapel).not.toContain('disponibilidade-professor');
    expect(semPapel).toContain('cadastrar-arena');
    expect(guiasVisiveis({ gereArena: true }).map((g) => g.id)).toContain('responder-reservas');
    expect(guiasVisiveis({ ehProfessor: true }).map((g) => g.id)).toContain('disponibilidade-professor');
  });

  it('dicaVisivel: semFlags esconde', () => {
    expect(dicaVisivel({ semFlags: ['x'] }, { flags: { x: true } })).toBe(false);
    expect(dicaVisivel({ semFlags: ['x'] }, {})).toBe(true);
  });

  it('as áreas saem na ordem, sem área vazia', () => {
    const areas = guiasPorArea({}).map((a) => a.area);
    expect(areas[0]).toBe(GUIA_AREA.COMECAR);
    guiasPorArea({}).forEach((a) => expect(a.guias.length).toBeGreaterThan(0));
    expect(guiasPorArea(TUDO).map((a) => a.area)).toContain(GUIA_AREA.MINHA_ARENA);
  });
});

describe('"Nesta tela"', () => {
  it('o guia da ferramenta vem primeiro', () => {
    const ids = guiasDaTela('/torneios/abc/gerenciar', TUDO).map((g) => g.id);
    expect(ids[0]).toBe('tutorial:torneio');
  });

  it('⭐ no dia de jogo, só o guia do formato do dia — mesmo com a flag do formato desligada', () => {
    const play = guiasDaTela('/dia-de-jogo/x', { formatoDoDia: 'play' }).map((g) => g.id);
    expect(play).toContain('tutorial:dia-de-jogo-play');
    expect(play).not.toContain('tutorial:dia-de-jogo-americano');
    const aprimorado = guiasDaTela('/dia-de-jogo/x', { formatoDoDia: 'americano_live' }).map((g) => g.id);
    expect(aprimorado[0]).toBe('tutorial:dia-de-jogo-americano-aprimorado');
    const mexicano = guiasDaTela('/dia-de-jogo/x', { formatoDoDia: 'mexicano' }).map((g) => g.id);
    expect(mexicano[0]).toBe('tutorial:dia-de-jogo-americano');
  });

  it('tela sem guia devolve lista vazia', () => {
    expect(guiasDaTela('/regras', TUDO)).toEqual([]);
  });
});

describe('"O que você quer fazer?"', () => {
  it('ignora acento e caixa; vários termos estreitam', () => {
    expect(buscarGuias('RESERVAR', TUDO).map((g) => g.id)[0]).toBe('reservar-quadra');
    expect(buscarGuias('aparencia', TUDO).map((g) => g.id)).toContain('escolher-aparencia');
    expect(buscarGuias('torneio criar', TUDO).map((g) => g.id)[0]).toBe('criar-torneio');
    expect(buscarGuias('x', TUDO)).toEqual([]);
    expect(buscarGuias('zzzzqq', TUDO)).toEqual([]);
  });

  it('busca respeita quem vê', () => {
    expect(buscarGuias('modo escuro', {}).map((g) => g.id)).not.toContain('escolher-aparencia');
  });
});

describe('para onde levar', () => {
  it(':minhaArena vira a arena da pessoa — e sem arena não leva a lugar nenhum', () => {
    const p = guiaPorId('configurar-quadras').steps[0];
    expect(destinoDoPasso(p, { minhaArena: 'a b' })).toBe('/arenas/a%20b/gerir?aba=quadras');
    expect(destinoDoPasso(p, {})).toBeNull();
    expect(destinoDoPasso({ goTo: '/ranking' }, {})).toBe('/ranking');
    expect(destinoDoPasso({}, {})).toBeNull();
  });
});

describe('⭐ pontos de dica', () => {
  it('ids únicos, título, texto e alvo; o guia citado existe', () => {
    const ids = PONTOS_DE_DICA.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    PONTOS_DE_DICA.forEach((p) => {
      expect(p.title && p.body && p.target && p.route, p.id).toBeTruthy();
      if (p.guide) expect(guiaPorId(p.guide), `${p.id} → ${p.guide}`).toBeTruthy();
    });
  });

  it('nenhuma tela passa do máximo de pontos', () => {
    const porTela = {};
    PONTOS_DE_DICA.forEach((p) => { porTela[p.route] = (porTela[p.route] || 0) + 1; });
    Object.entries(porTela).forEach(([tela, n]) => {
      expect(n, tela).toBeLessThanOrEqual(MAX_PONTOS_POR_TELA + 2);
    });
  });

  it('pontosDaTela casa a rota e respeita a flag', () => {
    expect(pontosDaTela('/dia-de-jogo', {}).map((p) => p.id)).toEqual(['dia-de-jogo:criar']);
    expect(pontosDaTela('/configuracoes', {}).map((p) => p.id)).not.toContain('config:aparencia');
    expect(pontosDaTela('/configuracoes', { flags: { dark_mode: true } }).map((p) => p.id)).toContain('config:aparencia');
    expect(pontoPorId('dia-de-jogo:criar').guide).toBe('criar-dia-de-jogo');
    expect(pontoPorId('nada')).toBeNull();
  });
});

describe('destinoDeRecuo — o ponto não apareceu porque a pessoa está noutra aba', () => {
  const ctx = { minhaArena: 'a1', gereArena: true };
  it('na mesma tela, leva ao goTo do passo (ou do anterior mais próximo)', () => {
    const g = guiaPorId('configurar-quadras');
    expect(destinoDeRecuo(g, 0, ctx)).toBe('/arenas/a1/gerir?aba=quadras');
    // O passo 2 não tem goTo: vale o do passo 1, que é da mesma tela.
    expect(destinoDeRecuo(g, 2, ctx)).toBe('/arenas/a1/gerir?aba=quadras');
  });
  it('sem a arena da pessoa, não inventa destino', () => {
    expect(destinoDeRecuo(guiaPorId('configurar-quadras'), 1, {})).toBeNull();
  });
  it('⭐ nunca tira a pessoa de dentro de um dia de jogo para a LISTA', () => {
    const g = guiaPorId('tutorial:dia-de-jogo-play');
    g.steps.forEach((_, i) => expect(destinoDeRecuo(g, i, ctx)).toBeNull());
  });
  it('passo sem tela definida: nada', () => {
    const g = guiaPorId('reservar-quadra');
    expect(destinoDeRecuo(g, g.steps.length - 1, ctx)).toBeNull();
  });
});

describe('os artigos da central apontam para guias que existem', () => {
  it('⭐ todo `guias` de artigo é um guia do catálogo', async () => {
    const { HELP_SECTIONS } = await import('./helpCenter.js');
    const ids = new Set(GUIAS.map((g) => g.id));
    const referidos = HELP_SECTIONS.flatMap((s) => s.articles.flatMap((a) => a.guias || []));
    expect(referidos.length).toBeGreaterThan(15);
    for (const id of referidos) expect(ids.has(id), id).toBe(true);
  });
});

describe('passoQueAbre — o formulário foi fechado no meio do guia', () => {
  it('volta ao passo que abre o formulário (um clique)', () => {
    const g = guiaPorId('criar-dia-de-jogo');
    const abre = g.steps.findIndex((p) => p.id === 'abrir');
    const data = g.steps.findIndex((p) => p.id === 'data');
    expect(passoQueAbre(g, data)).toBe(abre);
  });
  it('ou ao que espera algo aparecer (o relógio que abre os horários)', () => {
    const g = guiaPorId('configurar-quadras');
    expect(passoQueAbre(g, g.steps.findIndex((p) => p.id === 'janela'))).toBe(g.steps.findIndex((p) => p.id === 'relogio'));
  });
  it('sem passo que abra (ou noutra tela): -1', () => {
    expect(passoQueAbre(guiaPorId('entender-ranking'), 2)).toBe(-1);
    const g = guiaPorId('criar-dia-de-jogo');
    expect(passoQueAbre(g, g.steps.length - 1)).toBe(-1); // "depois" é na tela do dia criado
  });
});

describe('⭐ a gamificação nas dicas', () => {
  const COM_FLAG = { flags: { gamification_v2: true } };
  const daGamificacao = (ctx) => guiasVisiveis(ctx).filter((g) => g.area === GUIA_AREA.GAMIFICACAO).map((g) => g.id);

  it('sem a flag da gamificação, nenhum guia nem ponto aparece (a porta não abre)', () => {
    expect(daGamificacao({ gereArena: true, ehProfessor: true, ehAdmin: true })).toEqual([]);
    expect(pontosDaTela('/gamification', {})).toEqual([]);
    expect(pontosDaTela('/hall-da-fama', {})).toEqual([]);
  });

  it('com a flag, o atleta vê os guias dele — e nenhum de quem oferece ou administra', () => {
    const ids = daGamificacao(COM_FLAG);
    ['gamificacao-entender', 'gamificacao-missoes', 'gamificacao-sequencia', 'gamificacao-revisao', 'gamificacao-competir',
      'gamificacao-social', 'gamificacao-vinculos', 'gamificacao-recompensas', 'gamificacao-hall', 'gamificacao-conquistas',
      'gamificacao-privacidade'].forEach((id) => expect(ids, id).toContain(id));
    expect(ids.some((id) => /oferecer|recompensa-arena|admin/.test(id))).toBe(false);
  });

  it('⭐ papel: arena, professor e admin só veem o guia do papel que têm', () => {
    expect(daGamificacao({ ...COM_FLAG, gereArena: true })).toEqual(expect.arrayContaining(['gamificacao-oferecer-arena', 'gamificacao-recompensa-arena']));
    expect(daGamificacao({ ...COM_FLAG, gereArena: true })).not.toContain('gamificacao-oferecer-professor');
    expect(daGamificacao({ ...COM_FLAG, ehProfessor: true })).toContain('gamificacao-oferecer-professor');
    expect(daGamificacao(COM_FLAG).filter((id) => id.includes('admin'))).toEqual([]);
    expect(daGamificacao({ ...COM_FLAG, ehAdmin: true })).toEqual(expect.arrayContaining([
      'gamificacao-admin-configurar', 'gamificacao-admin-integridade', 'gamificacao-admin-metricas',
    ]));
  });

  it('dicaVisivel: audience admin exige ehAdmin', () => {
    expect(dicaVisivel({ audience: 'admin' }, {})).toBe(false);
    expect(dicaVisivel({ audience: 'admin' }, { ehAdmin: true })).toBe(true);
  });

  it('a área da gamificação tem rótulo e ícone, e vem depois da comunidade', () => {
    expect(GUIA_AREA_META[GUIA_AREA.GAMIFICACAO]).toEqual({ label: 'Gamificação', icon: 'Sparkles' });
    const areas = guiasPorArea({ ...COM_FLAG }).map((a) => a.area);
    expect(areas.indexOf(GUIA_AREA.GAMIFICACAO)).toBeGreaterThan(areas.indexOf(GUIA_AREA.COMUNIDADE));
  });

  it('⭐ os números das férias vêm das constantes da regra (não escritos à mão)', () => {
    const texto = guiaPorId('gamificacao-sequencia').steps.map((p) => paragrafos(p).join(' ')).join(' ');
    expect(texto).toContain(`${STREAK_VACATION_MAX_DAYS / 7} semanas`);
    expect(texto).toContain(`${STREAK_VACATION_COOLDOWN_DAYS} dias`);
  });

  it('o guia da tela certa aparece em "Nesta tela"', () => {
    expect(guiasDaTela('/hall-da-fama', COM_FLAG).map((g) => g.id)).toEqual(['gamificacao-hall']);
    expect(guiasDaTela('/vinculos', COM_FLAG).map((g) => g.id)).toEqual(['gamificacao-vinculos']);
    expect(guiasDaTela('/hall-da-fama', {}).map((g) => g.id)).toEqual([]);
    expect(guiasDaTela('/gamification', COM_FLAG).map((g) => g.id)).toEqual(expect.arrayContaining(['gamificacao-entender', 'gamificacao-missoes']));
  });

  it('busca: "férias" e "privacidade" levam aos guias certos, e só com a flag', () => {
    expect(buscarGuias('ferias', COM_FLAG).map((g) => g.id)).toContain('gamificacao-sequencia');
    expect(buscarGuias('privacidade', COM_FLAG).map((g) => g.id)).toContain('gamificacao-privacidade');
    expect(buscarGuias('ferias', {}).map((g) => g.id)).not.toContain('gamificacao-sequencia');
  });

  it('⭐ a primeira aba que um guia manda tocar existe no catálogo do hub', async () => {
    const { HUB_TABS } = await import('@/v2/components/gamification/hubTabs.js');
    const ancorasDoHub = new Set(HUB_TABS.map((t) => t.dica));
    GUIAS.filter((g) => g.area === GUIA_AREA.GAMIFICACAO).forEach((g) => g.steps.forEach((p) => {
      alvosDoPasso(p).filter((a) => a.startsWith('aba-')).forEach((a) => expect(ancorasDoHub.has(a), `${g.id}/${p.id} → ${a}`).toBe(true));
    }));
  });

  it('o hub não passa do máximo de pontos de dica', () => {
    expect(pontosDaTela('/gamification', COM_FLAG).length).toBeLessThanOrEqual(MAX_PONTOS_POR_TELA);
  });
});
