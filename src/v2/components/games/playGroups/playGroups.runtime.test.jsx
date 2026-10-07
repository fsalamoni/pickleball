/**
 * A interface dos GRUPOS do Play (flag `play_groups`).
 *
 * O domínio e o serviço têm os próprios testes; aqui se protege o que a PESSOA
 * vê e faz: o convite do cartão, a edição inline, a política, a pausa, a
 * distribuição com prévia, o seletor de grupo de cada participante, o nível e o
 * sexo do convidado avulso, o grupo da próxima partida na quadra livre e a fila
 * de cada grupo.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const auth = { user: { uid: 'dono' }, userProfile: {} };
const mut = {
  salvarGrupos: vi.fn(async () => ({})),
  distribuir: vi.fn(async (a) => ({ updated: a.length })),
  moverGrupo: vi.fn(async () => ({ moved: ['x'] })),
  adicionar: vi.fn(async () => ({})),
  criarProximo: vi.fn(async () => ({ court: 1, kind: 'doubles', groupId: 'b' })),
  rodada: vi.fn(async () => ({ created: [], courts: [] })),
};
const semMutacao = { mutate: vi.fn(), mutateAsync: vi.fn(async () => ({})), isPending: false };
const toast = { success: vi.fn(), error: vi.fn() };
// O que a visão do jogador lê do dia (trocado por teste).
const dia = { participants: [], games: [], ctx: null };

vi.mock('sonner', () => ({ toast: { success: (...a) => toast.success(...a), error: (...a) => toast.error(...a) } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => false }));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({ useAthletes: () => ({ data: [] }) }));
vi.mock('@/modules/games/hooks/usePlayGroupMutations', () => ({
  useSetPlayGroups: () => ({ ...semMutacao, mutateAsync: mut.salvarGrupos }),
  useAssignPlayGroups: () => ({ ...semMutacao, mutateAsync: mut.distribuir }),
  useSetPlayParticipantGroup: () => ({ ...semMutacao, mutateAsync: mut.moverGrupo }),
}));
vi.mock('@/modules/games/hooks/usePlayGroups', () => ({ usePlayGroupsContext: () => dia.ctx }));
vi.mock('@/modules/games/hooks/useGameDayJoin', () => ({ useJoinPanelApplies: () => false }));
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useGameDayParticipants: () => ({ data: dia.participants, isLoading: false }),
  useGameDayGames: () => ({ data: dia.games, isLoading: false }),
  useJoinPublicGameDay: () => semMutacao,
  useLeaveGameDay: () => semMutacao,
  useAddGameDayParticipant: () => ({ ...semMutacao, mutateAsync: mut.adicionar }),
  useRemoveGameDayParticipant: () => semMutacao,
  useCreateNextPlayGame: () => ({ ...semMutacao, mutateAsync: mut.criarProximo }),
  useCreatePlayRound: () => ({ ...semMutacao, mutateAsync: mut.rodada }),
  useCreateManualPlayGame: () => semMutacao,
  useFinishPlayGame: () => semMutacao,
  useCancelPlayGame: () => semMutacao,
  useNoShowSwapPlayGame: () => semMutacao,
  useSetPlayParticipantSkip: () => semMutacao,
  useSetPlayParticipantPartner: () => semMutacao,
}));

const { default: PlayGroupsCard } = await import('./PlayGroupsCard.jsx');
const { PlayParticipantsSection, PlayCourtsSection, PlayOrderSection } = await import('../AthletePlayOrganizer.jsx');
const { normalizePlayGroupsConfig } = await import('@/modules/games/domain/playGroups.js');
const { makeGroupsDrawer, buildGroupedPlayView } = await import('@/modules/games/domain/playGroupsDraw.js');
const { computePlayOrder } = await import('@/modules/games/domain/gamePlay.js');
const { default: AthletePlayParticipant } = await import('../AthletePlayParticipant.jsx');

let container, root;

beforeEach(() => {
  window.localStorage.clear();
  document.body.innerHTML = '';
  Object.values(mut).forEach((m) => m.mockClear());
  toast.success.mockClear();
  toast.error.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

const click = (el) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const botao = (trecho) => [...document.body.querySelectorAll('button')].find((b) => b.textContent.includes(trecho));
const porRotulo = (rotulo) => document.body.querySelector(`[aria-label="${rotulo}"]`);
function escolher(select, valor) {
  act(() => {
    select.value = valor;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
function digitar(input, texto) {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  act(() => { set.call(input, texto); input.dispatchEvent(new Event('input', { bubbles: true })); });
}

/* ------------------------------- montagem ---------------------------------- */

const GRUPOS = [
  { id: 'a', name: 'Alfa', color: 'rose', level_min: 2, level_max: 3.5 },
  { id: 'b', name: 'Beta', color: 'sky', level_min: 3.5, level_max: 8, formation: 'mixed', strict: true },
];
const P = (id, name, extra = {}) => ({
  id, name, user_id: id, photo_url: null, source: 'invited',
  available_since: 1000, available_tie: 0, skip_remaining: 0, ...extra,
});

function contexto(participants, { grupos = GRUPOS, policy = 'queue', games = [], ativo = true, courtGroups } = {}) {
  const config = normalizePlayGroupsConfig({ play_groups: grupos, play_groups_policy: policy });
  const ctx = {
    flag: true, configuravel: true, ativo: ativo && config.groups.length > 0,
    config: ativo ? config : { groups: [], policy: 'queue' }, participants,
  };
  ctx.drawer = ctx.ativo ? makeGroupsDrawer(config, { games, participants, courtGroups }) : null;
  const view = ctx.ativo
    ? buildGroupedPlayView({ participants, games, courts: 2, drawer: ctx.drawer })
    : computePlayOrder({ participants, games });
  return { grupos: ctx, view };
}

const quatro = (g, nivel) => ['1', '2', '3', '4'].map((n, i) => P(`${g}${n}`, `${g.toUpperCase()}${n}`, {
  play_group_id: g, level_value: nivel, available_since: 1000 + i, play_gender: i % 2 ? 'female' : 'male',
}));

async function renderCard(props, ctxArgs = {}) {
  const participants = props.participants || [];
  const { grupos, view } = contexto(participants, ctxArgs);
  await act(async () => {
    root.render(
      <PlayGroupsCard
        gameDay={{ id: 'gd1', format: 'play' }}
        participants={participants}
        view={view}
        grupos={grupos}
        podeConfigurar
        canManage
        courts={2}
        {...props}
      />,
    );
  });
}

/* ----------------------------------- cartão -------------------------------- */

describe('cartão Grupos', () => {
  it('flag desligada (ou dia que não é Play): não renderiza nada', async () => {
    const { view } = contexto([]);
    await act(async () => {
      root.render(
        <PlayGroupsCard
          gameDay={{ id: 'gd1' }} participants={[]} view={view} podeConfigurar canManage courts={1}
          grupos={{ configuravel: false, ativo: false, config: { groups: [], policy: 'queue' } }}
        />,
      );
    });
    expect(container.textContent).toBe('');
  });

  it('sem grupos: convida, e quem só OPERA o dia não vê nada', async () => {
    await renderCard({ podeConfigurar: false }, { grupos: [] });
    expect(container.textContent).toBe('');
  });

  it('⭐ sem grupos, quem configura escolhe um atalho e os grupos nascem num toque', async () => {
    await renderCard({}, { grupos: [] });
    expect(container.textContent).toContain('Divida o Play em grupos');
    ['Por nível', 'Por tipo de dupla', 'Em branco'].forEach((t) => expect(container.textContent).toContain(t));
    await click(botao('Usar este'));
    expect(mut.salvarGrupos).toHaveBeenCalledTimes(1);
    const { groups, policy } = mut.salvarGrupos.mock.calls[0][0];
    expect(groups.map((g) => g.name)).toEqual(['Iniciante', 'Intermediário', 'Avançado']);
    expect(policy).toBe('queue');
  });

  it('criar do zero abre o editor inline, sem modal', async () => {
    await renderCard({}, { grupos: [] });
    await click(botao('Criar um grupo'));
    expect(container.querySelector('form[aria-label="Novo grupo"]')).toBeTruthy();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('com grupos: cada um mostra nome, regras e o MOTIVO de jogar ou não', async () => {
    const gente = [
      ...quatro('a', 3),
      // Beta exige mista, mas só há homens esperando
      ...['1', '2', '3', '4'].map((n, i) => P(`h${n}`, `H${n}`, { play_group_id: 'b', level_value: 5, play_gender: 'male', available_since: 2000 + i })),
    ];
    await renderCard({ participants: gente });
    expect(container.textContent).toContain('Alfa');
    expect(container.textContent).toContain('Beta');
    expect(container.textContent).toContain('Pronto para a próxima quadra livre.');
    expect(container.textContent).toMatch(/Faltam 2 mulheres para duplas mistas/);
    expect(container.textContent).toContain('Duplas mistas');
    expect(container.textContent).toContain('Exige essas regras');
  });

  it('mostra quem está sem grupo e como ele joga', async () => {
    await renderCard({ participants: [...quatro('a', 3), P('u1', 'Solto')] });
    expect(container.textContent).toContain('Sem grupo');
    expect(container.textContent).toMatch(/Jogam entre si, em qualquer quadra livre/);
  });

  it('⭐ pausar um grupo grava a pausa e mantém o resto', async () => {
    await renderCard({ participants: quatro('a', 3) });
    await click(porRotulo('Pausar o grupo Alfa'));
    const { groups } = mut.salvarGrupos.mock.calls[0][0];
    expect(groups.find((g) => g.id === 'a').paused).toBe(true);
    expect(groups.find((g) => g.id === 'b').paused).toBe(false);
  });

  it('a política muda na hora, com os grupos intactos', async () => {
    await renderCard({ participants: quatro('a', 3) });
    const radio = [...container.querySelectorAll('input[type="radio"][name="politica-grupos"]')]
      .find((r) => r.closest('label').textContent.includes('Revezar'));
    await click(radio);
    expect(mut.salvarGrupos.mock.calls[0][0].policy).toBe('rotate');
    expect(mut.salvarGrupos.mock.calls[0][0].groups).toHaveLength(2);
  });

  it('subir e descer mudam a ordem da lista', async () => {
    await renderCard({ participants: quatro('a', 3) });
    await click(porRotulo('Descer Alfa na lista'));
    expect(mut.salvarGrupos.mock.calls[0][0].groups.map((g) => g.id)).toEqual(['b', 'a']);
  });

  it('com prioridade ou revezamento, cada grupo mostra a sua posição', async () => {
    await renderCard({ participants: quatro('a', 3) }, { policy: 'priority' });
    expect(container.textContent).toContain('1º');
    expect(container.textContent).toContain('2º');
  });

  it('⭐ editar abre o editor INLINE; salvar manda o grupo normalizado', async () => {
    await renderCard({ participants: quatro('a', 3) });
    await click(porRotulo('Editar o grupo Alfa'));
    const form = container.querySelector('form[aria-label="Editar o grupo Alfa"]');
    expect(form).toBeTruthy();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    digitar(form.querySelector('#grupo-nome'), '  Alfa Plus ');
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    const { groups } = mut.salvarGrupos.mock.calls[0][0];
    expect(groups.find((g) => g.id === 'a').name).toBe('Alfa Plus');
  });

  it('nome repetido é recusado na própria tela, sem gravar', async () => {
    await renderCard({ participants: quatro('a', 3) });
    await click(porRotulo('Editar o grupo Alfa'));
    const form = container.querySelector('form[aria-label="Editar o grupo Alfa"]');
    digitar(form.querySelector('#grupo-nome'), 'beta');
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(container.textContent).toContain('Já existe um grupo com esse nome.');
    expect(mut.salvarGrupos).not.toHaveBeenCalled();
  });

  it('só dá para exigir as regras quando há regra', async () => {
    await renderCard({ participants: quatro('a', 3) });
    await click(porRotulo('Editar o grupo Alfa'));
    expect(container.textContent).toContain('Escolha uma formação ou um limite de nível para poder exigir.');
  });

  it('marcar quadras restringe o grupo a elas', async () => {
    await renderCard({ participants: quatro('a', 3) });
    await click(porRotulo('Editar o grupo Alfa'));
    const q2 = [...container.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Quadra 2');
    await click(q2);
    const form = container.querySelector('form[aria-label="Editar o grupo Alfa"]');
    await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    expect(mut.salvarGrupos.mock.calls[0][0].groups.find((g) => g.id === 'a').courts).toEqual([2]);
  });

  it('remover pede confirmação e deixa as outras partidas em paz', async () => {
    await renderCard({ participants: quatro('a', 3) });
    await click(porRotulo('Remover o grupo Alfa'));
    expect(mut.salvarGrupos).not.toHaveBeenCalled();
    await click(botao('Remover grupo'));
    expect(mut.salvarGrupos.mock.calls[0][0].groups.map((g) => g.id)).toEqual(['b']);
  });

  it('⭐ distribuir por nível mostra a PRÉVIA e só grava ao aplicar', async () => {
    const gente = [
      P('n1', 'Novata', { level_value: 2.5 }),
      P('n2', 'Forte', { level_value: 6 }),
      P('n3', 'Sem nível'),
    ];
    await renderCard({ participants: gente });
    await click(botao('Distribuir por nível'));
    expect(container.textContent).toContain('nada é gravado até você confirmar');
    expect(mut.distribuir).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/1 pessoa não deu para classificar/);
    expect(container.textContent).toContain('Sem nível');
    await click(botao('Aplicar a 2 pessoas'));
    expect(mut.distribuir).toHaveBeenCalledWith([
      { pid: 'n1', groupId: 'a' }, { pid: 'n2', groupId: 'b' },
    ]);
  });

  it('quem não deu para classificar pode ir para um grupo escolhido', async () => {
    await renderCard({ participants: [P('n3', 'Sem nível')] });
    await click(botao('Distribuir por nível'));
    escolher(porRotulo('Grupo para quem não deu para classificar'), 'a');
    await click(botao('Aplicar a 1 pessoa'));
    expect(mut.distribuir).toHaveBeenCalledWith([{ pid: 'n3', groupId: 'a' }]);
  });

  it('quem só conduz o dia move gente, mas não edita os grupos', async () => {
    await renderCard({ participants: quatro('a', 3), podeConfigurar: false });
    expect(porRotulo('Editar o grupo Alfa')).toBeNull();
    expect(porRotulo('Pausar o grupo Alfa')).toBeNull();
    expect(botao('Novo grupo')).toBeUndefined();
    expect(botao('Distribuir por nível')).toBeTruthy();
    expect(container.textContent).toContain('Só quem criou o dia cria, edita e pausa os grupos');
  });

  it('avisa quadra que nenhum grupo pode usar', async () => {
    await renderCard(
      { participants: [...quatro('a', 3), ...quatro('b', 5)] },
      { grupos: [{ id: 'a', name: 'Alfa', courts: [1] }, { id: 'b', name: 'Beta', courts: [1] }] },
    );
    expect(container.textContent).toMatch(/quadra 2 não está liberada para nenhum grupo/);
  });
});

/* ------------------------------ participantes ------------------------------ */

async function renderParticipantes({ participants, grupos, canManage = true }) {
  const { grupos: ctx, view } = grupos
    ? contexto(participants, grupos)
    : { grupos: null, view: computePlayOrder({ participants, games: [] }) };
  await act(async () => {
    root.render(
      <PlayParticipantsSection
        gameDay={{ id: 'gd1' }}
        participants={participants}
        view={view}
        isLoading={false}
        isOwner={canManage}
        canManage={canManage}
        me={auth.user}
        grupos={ctx}
      />,
    );
  });
}

describe('participantes com grupos', () => {
  const gente = [
    P('p1', 'Ana', { play_group_id: 'a', level_value: 3, play_gender: 'female' }),
    P('p2', 'Beto', { play_group_id: 'a', level_value: 6, play_gender: 'male' }), // nível fora do grupo
    P('p3', 'Caio'),
  ];

  it('⭐ cada linha tem o seletor de grupo, e trocar move a pessoa', async () => {
    await renderParticipantes({ participants: gente, grupos: {} });
    const seletor = porRotulo('Grupo de Ana');
    expect(seletor).toBeTruthy();
    expect(seletor.value).toBe('a');
    escolher(seletor, 'b');
    await act(async () => {});
    expect(mut.moverGrupo).toHaveBeenCalledWith({ pid: 'p1', groupId: 'b' });
  });

  it('"sem grupo" é uma opção', async () => {
    await renderParticipantes({ participants: gente, grupos: {} });
    escolher(porRotulo('Grupo de Ana'), '__none__');
    await act(async () => {});
    expect(mut.moverGrupo).toHaveBeenCalledWith({ pid: 'p1', groupId: null });
  });

  it('avisa, sem barrar, quem está fora do perfil do grupo', async () => {
    await renderParticipantes({ participants: gente, grupos: {} });
    expect(container.textContent).toContain('nível fora do grupo');
  });

  it('⭐ o convidado avulso ganha nível, sexo e grupo — e vai tudo na entrada', async () => {
    await renderParticipantes({ participants: gente, grupos: {} });
    digitar(container.querySelector('input[placeholder^="Adicionar convidado"]'), 'Zeca');
    escolher(porRotulo('Nível do convidado'), '3.5');
    escolher(porRotulo('Sexo do convidado'), 'male');
    escolher(porRotulo('Grupo do convidado'), 'b');
    await act(async () => {
      container.querySelector('button[aria-label="Incluir convidado"]').closest('form')
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(mut.adicionar).toHaveBeenCalledWith({
      name: 'Zeca', source: 'guest', play_level: 3.5, play_gender: 'male', play_group_id: 'b',
    });
  });

  it('por padrão o grupo do convidado é automático: o campo nem vai', async () => {
    await renderParticipantes({ participants: gente, grupos: {} });
    digitar(container.querySelector('input[placeholder^="Adicionar convidado"]'), 'Zeca');
    await act(async () => {
      container.querySelector('button[aria-label="Incluir convidado"]').closest('form')
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(mut.adicionar).toHaveBeenCalledWith({ name: 'Zeca', source: 'guest' });
  });

  it('SEM a flag, nada disso existe: nem seletor de grupo, nem nível do convidado', async () => {
    await renderParticipantes({ participants: gente, grupos: null });
    expect(porRotulo('Grupo de Ana')).toBeNull();
    expect(porRotulo('Nível do convidado')).toBeNull();
    expect(container.textContent).not.toContain('nível fora do grupo');
  });

  it('quem não conduz vê o grupo como selo, sem seletor', async () => {
    await renderParticipantes({ participants: gente, grupos: {}, canManage: false });
    expect(porRotulo('Grupo de Ana')).toBeNull();
    expect(container.textContent).toContain('Alfa');
  });

  it('aviso de dupla vinculada em outro grupo', async () => {
    const duo = [
      P('x1', 'Lia', { play_group_id: 'a', partner_id: 'x2' }),
      P('x2', 'Max', { play_group_id: 'b', partner_id: 'x1' }),
    ];
    await renderParticipantes({ participants: duo, grupos: {} });
    expect(container.textContent).toContain('dupla em outro grupo');
  });
});

/* --------------------------------- quadras --------------------------------- */

async function renderQuadras({ participants, games = [], canManage = true, ...ctxArgs }) {
  const { grupos, view } = contexto(participants, { games, ...ctxArgs });
  await act(async () => {
    root.render(
      <PlayCourtsSection
        gameDay={{ id: 'gd1', play_courts: 2 }}
        participants={participants}
        games={games}
        view={view}
        canManage={canManage}
        grupos={grupos}
      />,
    );
  });
}

describe('quadras com grupos', () => {
  const doisGrupos = [...quatro('a', 3), ...quatro('b', 5).map((p, i) => ({ ...p, available_since: 3000 + i }))];

  it('⭐ a previsão é por quadra, com o grupo de cada uma', async () => {
    await renderQuadras({ participants: doisGrupos });
    expect(container.textContent).toContain('Próximos participantes (previsão)');
    const previsao = [...container.querySelectorAll('li')].filter((li) => li.textContent.includes('livre agora'));
    expect(previsao).toHaveLength(2);
    expect(previsao[0].textContent).toContain('Alfa');
    expect(previsao[1].textContent).toContain('Beta');
  });

  it('⭐ na quadra livre dá para escolher o grupo da próxima partida — e ele vai ao serviço', async () => {
    await renderQuadras({ participants: doisGrupos });
    const seletor = porRotulo('Grupo da próxima partida da quadra 1');
    expect(seletor).toBeTruthy();
    expect(seletor.value).toBe('__auto__');
    escolher(seletor, 'b');
    await click([...container.querySelectorAll('button')].find((b) => b.textContent.includes('Criar jogo')));
    await act(async () => {});
    expect(mut.criarProximo).toHaveBeenCalledWith(expect.objectContaining({ court: 1, groupId: 'b' }));
  });

  it('o grupo escolhido muda a previsão da quadra na hora', async () => {
    await renderQuadras({ participants: doisGrupos });
    escolher(porRotulo('Grupo da próxima partida da quadra 1'), 'b');
    const q1 = [...container.querySelectorAll('li')].find((li) => li.textContent.includes('Quadra 1') && li.textContent.includes('livre agora'));
    expect(q1.textContent).toContain('Beta');
  });

  it('sem escolher, o grupo NÃO vai no pedido (a quadra decide pela política)', async () => {
    await renderQuadras({ participants: doisGrupos });
    await click([...container.querySelectorAll('button')].find((b) => b.textContent.includes('Criar jogo')));
    await act(async () => {});
    expect(mut.criarProximo.mock.calls[0][0]).not.toHaveProperty('groupId');
  });

  it('⭐ com gente de sobra e nenhuma partida pronta, a tela NÃO diz "aguardando jogadores": aponta os grupos', async () => {
    const soHomens = ['1', '2', '3', '4'].map((n, i) => P(`h${n}`, `H${n}`, {
      play_group_id: 'b', level_value: 5, play_gender: 'male', available_since: 1000 + i,
    }));
    await renderQuadras({ participants: soHomens, grupos: [{ id: 'b', name: 'Mistas', formation: 'mixed', strict: true }] });
    expect(container.textContent).toContain('Nenhum grupo tem partida pronta para a quadra 1 agora');
    expect(container.textContent).not.toContain('Aguardando jogadores disponíveis');
    const criar = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Criar próximo jogo'));
    expect(criar.disabled).toBe(true);
  });

  it('a partida em quadra mostra o grupo dela', async () => {
    const jogo = {
      id: 'g1', court: 1, status: 'open', created_at_ms: 1, group_id: 'a', group_name: 'Alfa', group_color: 'rose',
      side_a: [{ id: 'a1', name: 'A1' }, { id: 'a2', name: 'A2' }], side_b: [{ id: 'a3', name: 'A3' }, { id: 'a4', name: 'A4' }],
    };
    await renderQuadras({ participants: quatro('a', 3), games: [jogo] });
    const linha = container.querySelector('tbody tr');
    expect(linha.textContent).toContain('Alfa');
  });

  it('quem só vê não tem seletor de grupo', async () => {
    await renderQuadras({ participants: doisGrupos, canManage: false });
    expect(porRotulo('Grupo da próxima partida da quadra 1')).toBeNull();
  });
});

/* ------------------------------ ordem por grupo ---------------------------- */

describe('ordem de participação por grupo', () => {
  it('⭐ uma fila por grupo, cada uma numerada a partir de 1', async () => {
    const gente = [
      ...quatro('a', 3),
      ...quatro('b', 5).map((p, i) => ({ ...p, available_since: 3000 + i })),
      P('u1', 'Solto', { available_since: 9000 }),
    ];
    const { grupos, view } = contexto(gente);
    await act(async () => { root.render(<PlayOrderSection view={view} grupos={grupos} />); });
    const filaA = container.querySelector('section[aria-label="Fila do grupo Alfa"]');
    const filaB = container.querySelector('section[aria-label="Fila do grupo Beta"]');
    const sem = container.querySelector('section[aria-label="Fila de quem está sem grupo"]');
    expect(filaA.textContent).toContain('#1');
    expect(filaA.textContent).toContain('#4');
    expect(filaB.textContent).toContain('#1'); // recomeça: é a fila DO GRUPO
    expect(sem.textContent).toContain('Solto');
    expect(container.textContent).toContain('o número é a posição dentro do grupo');
  });

  it('sem grupos, a lista única de sempre', async () => {
    const gente = quatro('a', 3);
    const view = computePlayOrder({ participants: gente, games: [] });
    await act(async () => { root.render(<PlayOrderSection view={view} />); });
    expect(container.querySelector('section[aria-label^="Fila do grupo"]')).toBeNull();
  });
});

/* ------------------------------ visão do jogador --------------------------- */

describe('visão do jogador com grupos', () => {
  const grupos = [
    { id: 'a', name: 'Alfa', color: 'rose' },
    { id: 'b', name: 'Beta', color: 'sky' },
    { id: 'c', name: 'Fechado', color: 'amber', join: 'closed' },
  ];

  async function renderJogador({ meuGrupo = 'a', ativo = true } = {}) {
    const eu = P('eu', 'Eu mesmo', { user_id: 'dono', play_group_id: meuGrupo, available_since: 1000 });
    dia.participants = [eu, P('x', 'Outro', { play_group_id: 'a', available_since: 900 })];
    dia.games = [];
    const { grupos: ctx } = contexto(dia.participants, { grupos, ativo });
    dia.ctx = { ...ctx, participants: dia.participants };
    await act(async () => { root.render(<AthletePlayParticipant gameDay={{ id: 'gd1', format: 'play', play_courts: 1 }} />); });
    if (!container.textContent.includes('Seu grupo') && !container.textContent.includes('Você está na fila')) {
      const cab = [...container.querySelectorAll('button')].find((b) => b.textContent.includes('Minha participação'));
      if (cab) await click(cab);
    }
  }

  it('⭐ mostra o grupo e a posição na fila DO GRUPO', async () => {
    await renderJogador();
    expect(container.textContent).toContain('Seu grupo:');
    expect(container.textContent).toMatch(/na fila do grupo Alfa, na posição #2/);
  });

  it('⭐ troca de grupo por conta própria — só entre os abertos (e o atual)', async () => {
    await renderJogador();
    const seletor = porRotulo('Trocar de grupo');
    const opcoes = [...seletor.querySelectorAll('option')].map((o) => o.textContent);
    expect(opcoes).toEqual(['Sem grupo', 'Alfa', 'Beta']); // "Fechado" não é oferecido
    escolher(seletor, 'b');
    await act(async () => {});
    expect(mut.moverGrupo).toHaveBeenCalledWith({ pid: 'eu', groupId: 'b', self: true });
  });

  it('quem está num grupo fechado o vê, mas não o perde por engano', async () => {
    await renderJogador({ meuGrupo: 'c' });
    const opcoes = [...porRotulo('Trocar de grupo').querySelectorAll('option')].map((o) => o.textContent);
    expect(opcoes).toContain('Fechado');
  });

  it('sem grupos ativos, a visão é a de sempre (sem "Seu grupo")', async () => {
    await renderJogador({ ativo: false });
    expect(container.textContent).not.toContain('Seu grupo:');
    expect(porRotulo('Trocar de grupo')).toBeNull();
  });
});
