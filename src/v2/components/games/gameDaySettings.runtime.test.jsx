/**
 * ⭐ AS CONFIGURAÇÕES DO DIA DE JOGO SÃO UM CARTÃO SÓ, IGUAL EM TODA ORIGEM.
 *
 * Dois defeitos ficam presos aqui:
 *
 * **(1) Espalhadas por três telas.** O dia de jogo nasce em três lugares e era
 * configurado em três lugares diferentes; nos formatos de GRADE (o padrão de
 * uma data de clube) o número de quadras não aparecia em configuração nenhuma.
 *
 * **(2) Espalhadas DENTRO da tela.** "Quem organiza" vivia no cartão
 * *Organização*, formato e quadras noutro cartão, e nome/data/local atrás de um
 * modal — a ponto de o modo de gestão existir em DOIS lugares ao mesmo tempo.
 *
 * Um teste de comportamento comum não pega isto: cada tela, isolada, funciona.
 * Por isso os casos abaixo rodam o MESMO componente sobre as três origens.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const auth = { user: { uid: 'u1' }, userProfile: {} };
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));

const arenasGeridas = { lista: [] };
vi.mock('@/modules/arenas/hooks/useArenas', () => ({
  useMyManagedArenas: () => ({ data: arenasGeridas.lista }),
}));
const papel = { role: 'admin' };
vi.mock('@/modules/clubs/hooks/useClubs', () => ({ useMyMembership: () => ({ data: papel }) }));

const flags = { americanoLive: false };
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => flags.americanoLive }));

vi.mock('@/modules/athletes/hooks/useAthletes', () => ({
  useAthletes: () => ({ data: [{ uid: 'a9', platform_name: 'Ana' }], isError: false }),
}));

const estado = { games: [], falhouJogos: false, participants: [] };
const gravado = { patches: [], modos: [], admins: [] };
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useGameDayGames: () => ({ data: estado.games, isError: estado.falhouJogos }),
  useGameDayParticipants: () => ({ data: estado.participants }),
  useUpdateGameDay: () => ({
    mutateAsync: vi.fn(async (args) => { gravado.patches.push(args); return {}; }),
    isPending: false,
  }),
  useSetGameDayManageMode: () => ({
    mutateAsync: vi.fn(async (m) => { gravado.modos.push(m); return {}; }),
    isPending: false,
  }),
  useAddGameDayAdmin: () => ({
    mutateAsync: vi.fn(async (uid) => { gravado.admins.push(['add', uid]); return {}; }),
    isPending: false,
  }),
  useRemoveGameDayAdmin: () => ({
    mutateAsync: vi.fn(async (uid) => { gravado.admins.push(['rm', uid]); return {}; }),
    isPending: false,
  }),
}));

const { default: GameDaySettingsCard } = await import('./GameDaySettingsCard.jsx');

const DIA_BASE = {
  id: 'gd1', title: 'Rachão', format: 'americano', play_courts: 1, created_by: 'u1',
};
const doAtleta = (extra = {}) => ({ ...DIA_BASE, ...extra });
const doClube = (extra = {}) => ({ ...DIA_BASE, club_id: 'clube1', club_event_id: 'ev1', ...extra });
const daArena = (extra = {}) => ({ ...DIA_BASE, arena_id: 'arena1', play_courts: 3, ...extra });

const AS_TRES_ORIGENS = [
  ['atleta', doAtleta],
  ['clube', doClube],
  ['arena', daArena],
];

let container;
let root;

/**
 * Renderiza e ABRE o cartão — o corpo é desmontado enquanto recolhido.
 *
 * ⚠️ Clica só se estiver FECHADO. `V2CollapsibleCard` grava a preferência no
 * `localStorage`, que sobrevive entre os testes do arquivo: clicar às cegas
 * fecharia o cartão na segunda chamada, e o teste acusaria o componente por um
 * defeito do próprio teste.
 */
function abrir(gameDay) {
  act(() => {
    root.render(
      <MemoryRouter><GameDaySettingsCard gameDay={gameDay} /></MemoryRouter>,
    );
  });
  const toggle = container.querySelector('button[aria-expanded]');
  if (toggle && toggle.getAttribute('aria-expanded') === 'false') {
    act(() => { toggle.click(); });
  }
  return container.textContent;
}

/** Renderiza SEM abrir — para conferir o resumo e a ausência do cartão. */
function render(gameDay) {
  act(() => {
    root.render(
      <MemoryRouter><GameDaySettingsCard gameDay={gameDay} /></MemoryRouter>,
    );
  });
  return container.textContent;
}

const seletorFormato = () => container.querySelector('#gds-fmt-gd1');
const campoQuadras = () => container.querySelector('#gds-qd-gd1');
const campoNome = () => container.querySelector('#gds-nome-gd1');
const botoesDeModo = () => Array.from(container.querySelectorAll('button[aria-pressed]'))
  .filter((b) => /organizar as partidas|participante/i.test(b.textContent));

beforeEach(() => {
  // A preferência de recolhido é por navegador: sem limpar, um teste herda o
  // estado aberto/fechado do anterior.
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  estado.games = [];
  estado.falhouJogos = false;
  estado.participants = [];
  gravado.patches = [];
  gravado.modos = [];
  gravado.admins = [];
  papel.role = 'admin';
  arenasGeridas.lista = [{ id: 'arena1' }];
  flags.americanoLive = false;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('⭐ um cartão só, nas TRÊS origens', () => {
  AS_TRES_ORIGENS.forEach(([nome, monta]) => {
    it(`⭐ ${nome}: formato, quadras, quem organiza E os organizadores`, () => {
      const texto = abrir(monta());
      expect(seletorFormato(), `${nome} ficou sem o formato`).toBeTruthy();
      expect(texto, `${nome} ficou sem as quadras`).toContain('Quadras disponíveis');
      expect(texto, `${nome} ficou sem "quem organiza"`).toContain('Quem organiza as partidas');
      expect(texto, `${nome} ficou sem a lista de organizadores`).toContain('Organizadores');
      expect(texto, `${nome} ficou sem nomear organizador`).toContain('Nomear organizador');
    });
  });

  it('⭐ o resumo conta o essencial com o cartão FECHADO', () => {
    const texto = render(doClube({ play_courts: 2, manage_mode: 'participants' }));
    expect(texto).toContain('Americano');
    expect(texto).toContain('2 quadras');
    expect(texto).toContain('Aberto a todos');
    // Fechado, o corpo nem é montado.
    expect(seletorFormato()).toBeNull();
  });

  it('⭐ "quem organiza" grava por UM caminho só', () => {
    abrir(doClube({ manage_mode: 'participants' }));
    const botoes = botoesDeModo();
    expect(botoes.length).toBe(2);
    act(() => { botoes.find((b) => b.getAttribute('aria-pressed') === 'false').click(); });
    // ⚠️ Pelo hook dedicado — não por um patch genérico. Dois escritores no
    // mesmo campo foi o que criou dois cartões de organização.
    expect(gravado.modos).toEqual(['owner_only']);
    expect(gravado.patches).toEqual([]);
  });

  it('⭐ o número de quadras vale também nos formatos de GRADE', () => {
    abrir(doClube({ format: 'americano' }));
    const campo = campoQuadras();
    expect(campo).toBeTruthy();
    campo.value = '3';
    act(() => { campo.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(gravado.patches.at(-1).patch).toEqual({ play_courts: 3 });
  });
});

describe('⭐ nome, data e local: de quem é a origem', () => {
  it('⭐ no ATLETA são editados aqui — sem modal', () => {
    const texto = abrir(doAtleta());
    expect(campoNome(), 'o atleta perdeu a edição de nome').toBeTruthy();
    expect(texto).toContain('Visibilidade');
    expect(container.querySelector('#gds-local-gd1')).toBeTruthy();
  });

  it('⭐ salvar só aparece depois de MUDAR alguma coisa', () => {
    const antes = abrir(doAtleta());
    expect(antes).not.toContain('Salvar alterações');
    const nome = campoNome();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    act(() => {
      setter.call(nome, 'Rachão de sexta');
      nome.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.textContent).toContain('Salvar alterações');
  });

  it('⭐ no CLUBE e na ARENA não se edita aqui — e a tela diz onde', () => {
    const clube = abrir(doClube());
    expect(campoNome(), 'o clube ganhou um segundo lugar para editar o nome').toBeNull();
    expect(clube).toContain('DATA do evento');
    expect(clube).toContain('Editar no clube');

    const arena = abrir(daArena());
    expect(campoNome()).toBeNull();
    expect(arena).toContain('Editar na gestão da arena');
  });
});

describe('⭐ trocar o formato: só enquanto não houver partidas', () => {
  it('⭐ sem partidas, é editável', () => {
    abrir(doClube());
    expect(seletorFormato().disabled).toBe(false);
  });

  it('⭐ com partidas, trava e EXPLICA em vez de só desabilitar', () => {
    estado.games = [{ id: 'g1', round: 1 }];
    const texto = abrir(doClube());
    expect(seletorFormato().disabled).toBe(true);
    expect(texto).toContain('já tem partidas');
  });

  it('⭐ consulta de jogos FALHANDO também trava — estado desconhecido não libera comando', () => {
    estado.falhouJogos = true;
    const texto = abrir(doClube());
    expect(seletorFormato().disabled).toBe(true);
    expect(texto).toContain('não carregou');
  });

  it('⭐ o Americano aprimorado só aparece com a flag ligada', () => {
    abrir(doClube());
    const valores = Array.from(seletorFormato().querySelectorAll('option')).map((o) => o.value);
    expect(valores).not.toContain('americano_live');
    expect(valores).toContain('americano');
    expect(valores).toContain('play');
  });

  it('o formato GRAVADO aparece mesmo com a flag desligada (senão o seletor mentiria)', () => {
    abrir(doClube({ format: 'americano_live' }));
    const valores = Array.from(seletorFormato().querySelectorAll('option')).map((o) => o.value);
    expect(valores).toContain('americano_live');
  });

  it('⭐ trocar o formato leva as quadras junto, para o dia nunca ficar sem contagem', () => {
    abrir(doClube({ play_courts: 2 }));
    const sel = seletorFormato();
    sel.value = 'play';
    act(() => { sel.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(gravado.patches.at(-1).patch).toEqual({ format: 'play', play_courts: 2 });
  });
});

describe('⭐ na ARENA as quadras vêm do calendário, não de um número solto', () => {
  it('⭐ o campo é de leitura e diz onde se muda', () => {
    const texto = abrir(daArena());
    expect(campoQuadras(), 'a arena ganhou um campo livre de quadras').toBeNull();
    expect(texto).toContain('3 quadras');
    expect(texto).toContain('calendário da arena');
  });

  it('⭐ mas formato e quem organiza continuam editáveis', () => {
    abrir(daArena());
    expect(seletorFormato()).toBeTruthy();
    expect(botoesDeModo().length).toBe(2);
  });
});

describe('⭐ quem vê o cartão', () => {
  it('⭐ ADMINISTRADOR do clube configura mesmo sem ter agendado a data', () => {
    papel.role = 'admin';
    abrir(doClube({ created_by: 'outra-pessoa' }));
    expect(seletorFormato()).toBeTruthy();
  });

  it('⭐ membro COMUM do clube NÃO configura, nem organizando o dia', () => {
    papel.role = 'member';
    estado.participants = [{ id: 'p1', user_id: 'u1' }];
    const texto = render(doClube({ created_by: 'outra-pessoa', manage_mode: 'participants' }));
    expect(texto).toBe('');
  });

  it('⭐ gestor da ARENA configura; quem não gere aquela arena, não', () => {
    arenasGeridas.lista = [{ id: 'arena1' }];
    abrir(daArena({ created_by: 'outra-pessoa' }));
    expect(seletorFormato()).toBeTruthy();

    arenasGeridas.lista = [{ id: 'outra-arena' }];
    expect(render(daArena({ created_by: 'outra-pessoa' }))).toBe('');
  });

  it('sem dia de jogo, não renderiza nada', () => {
    expect(render(null)).toBe('');
  });
});
