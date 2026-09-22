import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const auth = { user: { uid: 'dono' }, userProfile: {} };
const mutacoes = {
  remover: vi.fn(async () => ({})),
};
const semMutacao = { mutate: vi.fn(), mutateAsync: vi.fn(async () => ({})), isPending: false };

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/modules/athletes/hooks/useAthletes', () => ({ useAthletes: () => ({ data: [] }) }));
vi.mock('@/modules/games/hooks/useGameDays', () => ({
  useAddGameDayParticipant: () => semMutacao,
  useRemoveGameDayParticipant: () => ({ ...semMutacao, mutateAsync: mutacoes.remover }),
  useSetPlayParticipantSkip: () => semMutacao,
  useSetPlayParticipantPartner: () => semMutacao,
}));

const { PlayParticipantsSection } = await import('./AthletePlayOrganizer.jsx');
const { computePlayOrder } = await import('@/modules/games/domain/gamePlay.js');

const P = (id, name, extra = {}) => ({
  id,
  user_id: id === 'p4' ? null : id,
  name,
  photo_url: null,
  source: 'invited',
  available_since: 1000,
  available_tie: 0,
  skip_remaining: 0,
  ...extra,
});

let container, root;

beforeEach(() => {
  window.localStorage.clear();
  document.body.innerHTML = '';
  mutacoes.remover.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.body.innerHTML = '';
});

function click(el) {
  act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

async function renderSection() {
  const participants = [
    P('p1', 'Flavio', { user_id: 'dono', source: 'owner', play_level: 'Intermediário (USAP 3.0)', play_gender: 'male' }),
    P('p2', 'Ana', { available_since: 1001 }),
    P('p3', 'Bia', { available_since: 1002 }),
    P('p4', 'Convidado', { source: 'guest', available_since: 1003 }),
  ];
  const view = computePlayOrder({ participants, games: [] });

  await act(async () => {
    root.render(
      <PlayParticipantsSection
        gameDay={{ id: 'gd1' }}
        participants={participants}
        view={view}
        isLoading={false}
        isOwner
        canManage
        me={auth.user}
      />,
    );
  });

  if (!container.textContent.includes('Flavio')) {
    const cabecalho = [...container.querySelectorAll('button')]
      .find((b) => b.textContent.includes('Participantes'));
    if (cabecalho) click(cabecalho);
  }
}

describe('PlayParticipantsSection', () => {
  it('mostra a lixeira também para o participante organizador e permite removê-lo', async () => {
    await renderSection();

    const botoesRemover = [...container.querySelectorAll('button')]
      .filter((b) => b.title === 'Remover');
    expect(botoesRemover).toHaveLength(4);

    click(botoesRemover[0]);
    expect(mutacoes.remover).toHaveBeenCalledWith('p1');
  });
});
