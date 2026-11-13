/**
 * A estante: o pódio de fora ligado a um torneio daqui ("É este") não aparece
 * como Declarado enquanto os torneios da plataforma não foram conferidos; o
 * vazio da aba "Fora" leva a registrar; e "Ver todos" na estante de OUTRA
 * pessoa abre ali mesmo, sem levar à estante de quem olha.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';

const estado = { flag: true, trofeus: {}, fora: {}, meus: {} };
const ok = (data) => ({ isPending: false, isSuccess: true, isError: false, data, refetch: vi.fn() });
const falhou = () => ({ isPending: false, isSuccess: false, isError: true, data: undefined, refetch: vi.fn() });

vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'eu' } }) }));
vi.mock('@/core/lib/FeatureFlagsContext', () => ({ useFeatureFlag: () => estado.flag }));
vi.mock('@/modules/career/hooks/useCareer', () => ({ useCareerEvents: () => estado.fora }));
vi.mock('@/modules/tournament/hooks/useTournament', () => ({ useMyTournaments: () => estado.meus }));
vi.mock('@/modules/trophies/hooks/useTrophies', () => ({ useTrophies: () => estado.trofeus }));
vi.mock('./CongratulateButton', () => ({ default: () => null }));
// O domínio de verdade decide o selo; aqui basta o que a estante faz com a resposta.
vi.mock('@/modules/career/domain/timeline.js', async (orig) => ({
  ...(await orig()),
  careerTrophies: (events, { myTournaments } = {}) => (events || []).filter((e) => !(myTournaments && e.platformTournamentId)),
}));

const { default: TrophyShelf, ABA_FORA } = await import('./TrophyShelf');

const trofeu = (id, extra = {}) => ({
  id, kind: 'fora', position: 1, placeLabel: 'Campeão', title: `Open ${id}`, subtitle: 'Mista', date: 0, people: [], declared: true, ...extra,
});

let root; let el;
afterEach(() => { act(() => root?.unmount()); el?.remove(); });
function render(props) {
  el = document.createElement('div'); document.body.appendChild(el);
  root = createRoot(el);
  act(() => root.render(<MemoryRouter><TrophyShelf uid="eu" mine abaInicial={ABA_FORA} {...props} /></MemoryRouter>));
  return el;
}

describe('TrophyShelf', () => {
  it('⭐ torneios da plataforma falharam: o pódio ligado fica de fora e a falha é dita', () => {
    Object.assign(estado, { trofeus: ok({ torneios: [], ligas: [] }), fora: ok([trofeu('a'), trofeu('b', { platformTournamentId: 't1' })]), meus: falhou() });
    const out = render();
    expect(out.textContent).toContain('Open a');
    expect(out.textContent).not.toContain('Open b');
    expect(out.textContent).toContain('Não deu para conferir os torneios da plataforma');
  });

  it('só o ligado e a conferência falhou: não afirma "estante vazia"', () => {
    Object.assign(estado, { trofeus: ok({ torneios: [], ligas: [] }), fora: ok([trofeu('b', { platformTournamentId: 't1' })]), meus: falhou() });
    const out = render();
    expect(out.textContent).not.toContain('estante ainda está vazia');
    expect(out.textContent).not.toContain('ainda não registrou');
    expect(out.textContent).toContain('Não deu para conferir');
  });

  it('enquanto os torneios da plataforma carregam, a estante espera', () => {
    Object.assign(estado, { trofeus: ok({ torneios: [], ligas: [] }), fora: ok([trofeu('b', { platformTournamentId: 't1' })]), meus: { isPending: true } });
    expect(render().textContent).not.toContain('Open b');
  });

  it('vazio com a Carreira ligada: oferece registrar um torneio de fora', () => {
    Object.assign(estado, { trofeus: ok({ torneios: [], ligas: [] }), fora: ok([]), meus: ok([]) });
    const link = render().querySelector('a[href="/carreira?registrar=1"]');
    expect(link?.textContent).toContain('Registrar torneio de fora');
  });

  it('⭐ "Ver todos" na estante de outra pessoa abre no lugar (não leva à minha)', () => {
    const torneios = [1, 2, 3, 4, 5, 6].map((n) => trofeu(`t${n}`, { kind: 'torneio', declared: false }));
    Object.assign(estado, { trofeus: ok({ torneios, ligas: [] }), fora: ok([]), meus: ok([]) });
    const out = render({ uid: 'outra', mine: false, compacto: true });
    expect(out.querySelector('a[href="/perfil?secao=trofeus"]')).toBeNull();
    expect(out.querySelectorAll('li').length).toBe(4);
    const botao = out.querySelector('button[aria-expanded="false"]');
    expect(botao.textContent).toContain('Ver todos os 6');
    act(() => botao.click());
    expect(out.querySelectorAll('li').length).toBe(6);
    expect(out.querySelector('button[aria-expanded="true"]')).not.toBeNull();
  });
});

describe('TrophyShelf — ligas', () => {
  const daLiga = trofeu('liga', { kind: 'liga', declared: false, title: 'Liga de Outono', subtitle: 'Ouro', leagueId: 'l1', divisionId: 'd1', link: '/ligas/l1' });

  it('⭐ o pódio de liga tem aba própria, soma nas medalhas e leva à liga', () => {
    Object.assign(estado, { trofeus: ok({ torneios: [trofeu('t1', { kind: 'torneio', declared: false })], ligas: [daLiga] }), fora: ok([]), meus: ok([]) });
    const out = render({ abaInicial: 'liga' });
    const aba = [...out.querySelectorAll('[role="tab"]')].find((b) => b.textContent.includes('Ligas (1)'));
    expect(aba?.getAttribute('aria-selected')).toBe('true');
    expect(out.textContent).toContain('Liga de Outono');
    expect(out.textContent).not.toContain('Open t1');
    expect(out.querySelector('a[href="/ligas/l1"]')?.textContent).toContain('Ver a liga');
    // Ouro do torneio + ouro da liga.
    expect(out.querySelector('[aria-label="Medalhas por metal"]').textContent).toContain('2');
  });

  it('sem pódio de liga a aba não existe; ligas que não carregaram são ditas', () => {
    Object.assign(estado, { trofeus: ok({ torneios: [trofeu('t1', { kind: 'torneio', declared: false })], ligas: [] }), fora: ok([]), meus: ok([]) });
    expect(render({ abaInicial: 'liga' }).textContent).not.toContain('Ligas (');
    act(() => root.unmount());
    Object.assign(estado, { trofeus: ok({ torneios: [], ligas: undefined }), fora: ok([]), meus: ok([]) });
    const out = render({ abaInicial: 'torneio' });
    expect(out.textContent).toContain('Ficou de fora: as ligas');
    expect(out.textContent).not.toContain('estante ainda está vazia');
  });
});
