import { describe, it, expect } from 'vitest';
import { canRunClubTournament, clubTournamentBlock, clubTournamentFields, groupClubTournaments, isClubTournament } from './clubTournaments';

describe('torneios do clube (domínio)', () => {
  it('os campos gravados são o id e o nome do clube, e o nome é cortado', () => {
    expect(clubTournamentFields({ id: 'c1', name: '  Clube do Vale ' })).toEqual({ club_id: 'c1', club_name: 'Clube do Vale' });
    expect(clubTournamentFields({ id: 'c1', name: 'x'.repeat(300) }).club_name).toHaveLength(120);
    expect(clubTournamentFields(null)).toEqual({});
  });

  it('é torneio do clube só com club_id preenchido', () => {
    expect(isClubTournament({ club_id: 'c1' })).toBe(true);
    expect(isClubTournament({ club_id: '' })).toBe(false);
    expect(isClubTournament({})).toBe(false);
    expect(isClubTournament(null)).toBe(false);
  });

  it('só a administração e a diretoria esportiva criam em nome do clube', () => {
    expect(canRunClubTournament(['admin'])).toBe(true);
    expect(canRunClubTournament(['sports'])).toBe(true);
    expect(canRunClubTournament(['finance', 'comms'])).toBe(false);
    expect(canRunClubTournament([])).toBe(false);
  });

  it('diz por que o torneio sai comum, e não bloqueia quem pode', () => {
    const club = { id: 'c1', name: 'Clube' };
    expect(clubTournamentBlock({ flagOn: true, club, perms: ['sports'] })).toBe('');
    expect(clubTournamentBlock({ flagOn: false, club, perms: ['admin'] })).toContain('associação');
    expect(clubTournamentBlock({ flagOn: true, club: null, perms: ['admin'] })).toContain('Clube não encontrado');
    expect(clubTournamentBlock({ flagOn: true, club, perms: ['finance'] })).toContain('diretoria esportiva');
  });

  it('separa atuais e encerrados, tira arquivados e esconde o que não é público da vitrine', () => {
    const lista = [
      { id: 'a', name: 'A', visibility: 'public', status: 'registrations_open', starts_at: '2099-01-10', ends_at: '2099-01-12' },
      { id: 'b', name: 'B', visibility: 'public', status: 'finished', starts_at: '2020-01-10', ends_at: '2020-01-12' },
      { id: 'c', name: 'C', visibility: 'private', status: 'registrations_open', starts_at: '2099-02-10', ends_at: '2099-02-12' },
      { id: 'd', name: 'D', visibility: 'public', status: 'finished', archived: true, starts_at: '2020-03-10' },
      { id: 'e', name: 'E', visibility: 'public', status: 'draft' },
    ];
    const publico = groupClubTournaments(lista, '2026-10-26', { somentePublicos: true });
    expect(publico.atuais.map((x) => x.id)).toEqual(['a']);
    expect(publico.encerrados.map((x) => x.id)).toEqual(['b']);
    expect(publico.rascunhos).toEqual([]);

    const diretoria = groupClubTournaments(lista, '2026-10-26');
    expect(diretoria.atuais.map((x) => x.id).sort()).toEqual(['a', 'c']);
    expect(diretoria.rascunhos.map((x) => x.id)).toEqual(['e']);
    expect([...diretoria.atuais, ...diretoria.encerrados, ...diretoria.rascunhos].some((x) => x.id === 'd')).toBe(false);
  });
});
