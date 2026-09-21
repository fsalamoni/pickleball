/**
 * ⭐ AS CONFIGURAÇÕES DO DIA DE JOGO SÃO AS MESMAS EM TODA ORIGEM.
 *
 * O defeito que este arquivo prende: o dia de jogo nasce em três lugares e era
 * CONFIGURADO em três lugares diferentes. O do clube só oferecia o formato (e
 * as quadras apenas nos formatos quadra a quadra), então quem organizava pelo
 * clube não tinha como dizer **quem pode conduzir as partidas** e, num
 * Americano — o formato padrão de uma data de clube —, não achava o número de
 * quadras em lugar nenhum.
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

const estado = { games: [], falhouJogos: false };
const gravado = { patches: [] };
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useGameDayGames: () => ({ data: estado.games, isError: estado.falhouJogos }),
  useUpdateGameDay: () => ({
    mutateAsync: vi.fn(async (args) => { gravado.patches.push(args); return {}; }),
    isPending: false,
  }),
}));

const { default: GameDaySettingsCard } = await import('./GameDaySettingsCard.jsx');

const DIA_BASE = {
  id: 'gd1', title: 'Rachão', format: 'americano', play_courts: 1, created_by: 'u1',
};
const doAtleta = (extra = {}) => ({ ...DIA_BASE, ...extra });
const doClube = (extra = {}) => ({ ...DIA_BASE, club_id: 'clube1', ...extra });
const daArena = (extra = {}) => ({ ...DIA_BASE, arena_id: 'arena1', play_courts: 3, ...extra });

const AS_TRES_ORIGENS = [
  ['atleta', doAtleta],
  ['clube', doClube],
  ['arena', daArena],
];

let container;
let root;

function render(gameDay, participants = null) {
  act(() => {
    root.render(
      <MemoryRouter><GameDaySettingsCard gameDay={gameDay} participants={participants} /></MemoryRouter>,
    );
  });
  return container.textContent;
}

const seletorFormato = () => container.querySelector('#gds-fmt-gd1');
const campoQuadras = () => container.querySelector('#gds-qd-gd1');
const botoesDeModo = () => Array.from(container.querySelectorAll('button[aria-pressed]'));

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  estado.games = [];
  estado.falhouJogos = false;
  gravado.patches = [];
  papel.role = 'admin';
  arenasGeridas.lista = [{ id: 'arena1' }];
  flags.americanoLive = false;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('⭐ as três configurações chegam às TRÊS origens', () => {
  AS_TRES_ORIGENS.forEach(([nome, monta]) => {
    it(`⭐ ${nome}: formato, quadras e quem organiza estão na tela`, () => {
      const texto = render(monta());
      expect(seletorFormato(), `${nome} ficou sem o formato`).toBeTruthy();
      expect(texto, `${nome} ficou sem as quadras`).toContain('Quadras disponíveis');
      expect(texto, `${nome} ficou sem "quem organiza"`).toContain('Quem pode organizar as partidas');
    });
  });

  it('⭐ o clube também escolhe QUEM ORGANIZA — era o que faltava', () => {
    render(doClube({ manage_mode: 'participants' }));
    const botoes = botoesDeModo();
    expect(botoes.length).toBe(2);
    act(() => { botoes.find((b) => b.getAttribute('aria-pressed') === 'false').click(); });
    expect(gravado.patches.at(-1).patch).toEqual({ manage_mode: 'owner_only' });
  });

  it('⭐ e o número de quadras vale também nos formatos de GRADE', () => {
    // Era o buraco relatado: num Americano (o padrão de uma data de clube) o
    // campo não existia em configuração nenhuma.
    render(doClube({ format: 'americano' }));
    expect(campoQuadras()).toBeTruthy();
    const campo = campoQuadras();
    campo.value = '3';
    act(() => { campo.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); });
    expect(gravado.patches.at(-1).patch).toEqual({ play_courts: 3 });
  });
});

describe('⭐ trocar o formato: só enquanto não houver partidas', () => {
  it('⭐ sem partidas, é editável', () => {
    render(doClube());
    expect(seletorFormato().disabled).toBe(false);
  });

  it('⭐ com partidas, trava e EXPLICA em vez de só desabilitar', () => {
    estado.games = [{ id: 'g1', round: 1 }];
    const texto = render(doClube());
    expect(seletorFormato().disabled).toBe(true);
    expect(texto).toContain('já tem partidas');
  });

  it('⭐ consulta de jogos FALHANDO também trava — estado desconhecido não libera comando', () => {
    // Sem esta trava, uma queda de rede faria a tela concluir "nenhum jogo" e
    // liberar a troca de formato num dia com rodada já disputada.
    estado.falhouJogos = true;
    const texto = render(doClube());
    expect(seletorFormato().disabled).toBe(true);
    expect(texto).toContain('não carregou');
  });

  it('⭐ o Americano aprimorado só aparece com a flag ligada', () => {
    render(doClube());
    const valores = Array.from(seletorFormato().querySelectorAll('option')).map((o) => o.value);
    expect(valores).not.toContain('americano_live');
    expect(valores).toContain('americano');
    expect(valores).toContain('play');
  });

  it('o formato GRAVADO aparece mesmo com a flag desligada (senão o seletor mentiria)', () => {
    render(doClube({ format: 'americano_live' }));
    const valores = Array.from(seletorFormato().querySelectorAll('option')).map((o) => o.value);
    expect(valores).toContain('americano_live');
  });

  it('⭐ trocar o formato leva as quadras junto, para o dia nunca ficar sem contagem', () => {
    render(doClube({ play_courts: 2 }));
    const sel = seletorFormato();
    sel.value = 'play';
    act(() => { sel.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(gravado.patches.at(-1).patch).toEqual({ format: 'play', play_courts: 2 });
  });
});

describe('⭐ na ARENA as quadras vêm do calendário, não de um número solto', () => {
  it('⭐ o campo é de leitura e diz onde se muda', () => {
    const texto = render(daArena());
    expect(campoQuadras(), 'a arena ganhou um campo livre de quadras').toBeNull();
    expect(texto).toContain('3 quadras');
    expect(texto).toContain('calendário da arena');
  });

  it('⭐ mas formato e quem organiza continuam editáveis', () => {
    render(daArena());
    expect(seletorFormato()).toBeTruthy();
    expect(botoesDeModo().length).toBe(2);
  });
});

describe('⭐ quem vê o cartão', () => {
  it('⭐ ADMINISTRADOR do clube configura mesmo sem ter agendado a data', () => {
    papel.role = 'admin';
    render(doClube({ created_by: 'outra-pessoa' }));
    expect(seletorFormato()).toBeTruthy();
  });

  it('⭐ membro COMUM do clube NÃO configura, nem organizando o dia', () => {
    papel.role = 'member';
    const texto = render(
      doClube({ created_by: 'outra-pessoa', manage_mode: 'participants' }),
      [{ id: 'p1', user_id: 'u1' }],
    );
    expect(seletorFormato()).toBeNull();
    expect(texto).toBe('');
  });

  it('⭐ gestor da ARENA configura; quem não gere aquela arena, não', () => {
    arenasGeridas.lista = [{ id: 'arena1' }];
    render(daArena({ created_by: 'outra-pessoa' }));
    expect(seletorFormato()).toBeTruthy();

    arenasGeridas.lista = [{ id: 'outra-arena' }];
    render(daArena({ created_by: 'outra-pessoa' }));
    expect(seletorFormato()).toBeNull();
  });

  it('sem dia de jogo, não renderiza nada', () => {
    expect(render(null)).toBe('');
  });
});
