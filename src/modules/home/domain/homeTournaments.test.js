import { describe, it, expect } from 'vitest';
import {
  proximidade, prazoTexto, periodoTexto, localTexto,
  openTournamentsForMe, myCurrentTournaments, managedTournamentsForHome, organizerHint,
  lastTournamentResult, colocacaoTexto,
} from './homeTournaments.js';
import { TOURNAMENT_PHASE } from './freshness.js';

const HOJE = '2026-09-26';
const perfil = { city: 'Porto Alegre', state: 'RS' };

describe('proximidade e textos', () => {
  it('minha cidade (ignorando acento e caixa) > meu estado > longe', () => {
    expect(proximidade({ city: 'porto alegre', state: 'rs' }, perfil)).toBe(2);
    expect(proximidade({ city: 'Canoas', state: 'RS' }, perfil)).toBe(1);
    expect(proximidade({ city: 'Curitiba', state: 'PR' }, perfil)).toBe(0);
    expect(proximidade({ city: 'Porto Alegre', state: 'RS' }, {})).toBe(0);
  });

  it('prazo e período por extenso curto, com o relativo quando está perto', () => {
    expect(prazoTexto({ registration_deadline: '2026-10-01' }, HOJE)).toBe('Inscrições até Qui, 01/10 (em 5 dias)');
    expect(prazoTexto({ registration_deadline: HOJE }, HOJE)).toBe('Inscrições encerram hoje');
    expect(prazoTexto({}, HOJE)).toBeNull();
    expect(periodoTexto({ starts_at: '2026-10-03', ends_at: '2026-10-04' }, HOJE)).toBe('Sáb, 03/10 – Dom, 04/10');
    expect(periodoTexto({ starts_at: '2026-10-03', ends_at: '2026-10-03' }, HOJE)).toBe('Sáb, 03/10');
    expect(localTexto({ city: 'Porto Alegre', state: 'rs' })).toBe('Porto Alegre / RS');
    expect(localTexto({})).toBeNull();
  });
});

describe('openTournamentsForMe', () => {
  const lista = [
    { id: 'longe', name: 'Longe', status: 'registrations_open', city: 'Curitiba', state: 'PR', registration_deadline: '2026-09-27' },
    { id: 'estado', name: 'Estado', status: 'registrations_open', city: 'Canoas', state: 'RS', registration_deadline: '2026-10-10' },
    { id: 'cidade2', name: 'Cidade 2', status: 'registrations_open', city: 'Porto Alegre', state: 'RS', registration_deadline: '2026-10-20' },
    { id: 'cidade1', name: 'Cidade 1', status: 'registrations_open', city: 'Porto Alegre', state: 'RS', registration_deadline: '2026-10-02' },
    { id: 'vencido', status: 'registrations_open', registration_deadline: '2026-09-01' },
    { id: 'encerrado', status: 'finished' },
    { id: 'arquivado', status: 'registrations_open', archived: true },
  ];

  it('⭐ só inscrição aberta de verdade — encerrado, arquivado e prazo vencido ficam de fora', () => {
    const ids = openTournamentsForMe(lista, { hoje: HOJE, perfil }).map((x) => x.tournament.id);
    expect(ids).not.toContain('vencido');
    expect(ids).not.toContain('encerrado');
    expect(ids).not.toContain('arquivado');
  });

  it('perto de mim primeiro; entre iguais, o prazo que vence antes', () => {
    const ids = openTournamentsForMe(lista, { hoje: HOJE, perfil }).map((x) => x.tournament.id);
    expect(ids).toEqual(['cidade1', 'cidade2', 'estado', 'longe']);
  });

  it('marca onde já estou inscrito', () => {
    const r = openTournamentsForMe(lista, { hoje: HOJE, perfil, inscritos: new Set(['estado']) });
    expect(r.find((x) => x.tournament.id === 'estado').inscrito).toBe(true);
  });
});

describe('meus torneios (atleta e organizador)', () => {
  const meus = [
    { id: 'a', my_role: 'player', status: 'in_progress', ends_at: '2026-09-27' },
    { id: 'b', my_role: 'player', status: 'finished' },
    { id: 'c', my_role: 'player', status: 'registrations_closed', starts_at: '2026-10-05' },
    { id: 'd', my_role: 'owner', status: 'draft' },
    { id: 'e', my_role: 'admin', status: 'in_progress', ends_at: '2026-09-10' },
    { id: 'f', my_role: 'owner', status: 'finished' },
    { id: 'g', my_role: 'owner', status: 'registrations_open', registration_deadline: '2026-10-01' },
  ];

  it('inscrito: só o que ainda vale, o que está rolando primeiro', () => {
    expect(myCurrentTournaments(meus, HOJE).map((x) => x.tournament.id)).toEqual(['a', 'c']);
  });

  it('organizador: o que pede trabalho — inclusive o esquecido sem encerrar', () => {
    const r = managedTournamentsForHome(meus, HOJE);
    expect(r.map((x) => x.tournament.id)).toEqual(['e', 'g', 'd']);
    expect(r[0].phase).toBe(TOURNAMENT_PHASE.STALE);
    expect(organizerHint(TOURNAMENT_PHASE.STALE)).toMatch(/encerre/);
    expect(organizerHint(TOURNAMENT_PHASE.DRAFT)).toMatch(/Rascunho/);
  });
});

describe('lastTournamentResult', () => {
  const grupo = (t, entries) => ({ tournamentId: t.id, tournament: t, entries });
  const entrada = (modalidade, position, total, extra = {}) => ({
    modality: { name: modalidade },
    partnerName: extra.partner || null,
    ranking: { started: true, position, total, wins: 3, losses: 1, played: 4 },
  });

  it('pega o torneio mais recente que JÁ COMEÇOU e tem classificação', () => {
    const historico = [
      grupo({ id: 'futuro', name: 'Futuro', status: 'registrations_open', starts_at: '2026-10-10' }, [entrada('A', 1, 8)]),
      grupo({ id: 'cancelado', name: 'Cancelado', status: 'cancelled', starts_at: '2026-09-20' }, [entrada('A', 1, 8)]),
      grupo({ id: 'semjogo', name: 'Sem jogo', status: 'in_progress', starts_at: '2026-09-25' }, [{ modality: { name: 'X' }, ranking: null }]),
      grupo({ id: 'ok', name: 'Open POA', status: 'finished', starts_at: '2026-09-12', ends_at: '2026-09-13' }, [
        entrada('Duplas Mistas', 5, 10), entrada('Duplas Masculinas', 2, 12, { partner: 'Rui' }),
      ]),
    ];
    const r = lastTournamentResult(historico, HOJE);
    expect(r.tournamentId).toBe('ok');
    expect(r.encerrado).toBe(true);
    expect(r.best).toMatchObject({ modality: 'Duplas Masculinas', position: 2, partnerName: 'Rui' });
    expect(r.podio).toBe(true);
    expect(colocacaoTexto(r.best)).toBe('2º de 12');
  });

  it('sem nada disputado, null (e a seção some)', () => {
    expect(lastTournamentResult([], HOJE)).toBeNull();
    expect(lastTournamentResult(undefined, HOJE)).toBeNull();
  });
});
