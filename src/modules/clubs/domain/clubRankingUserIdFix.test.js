/**
 * Testes do fix de user_id no materializado (Wave C.6).
 *
 * REGRESSÃO: o `GameDayOrganizer` salva `side_a`/`side_b` como objetos
 * `{ id, name }`, onde `id` é o **doc_id de `event_participants`**, NÃO
 * o `user_id` do atleta. A Cloud Function `sideToUids` (antes do fix)
 * retornava `p.id` (doc_id), o que fazia o materializado agregar
 * estatísticas por chaves erradas — e o badge "0 atletas do clube"
 * mesmo com 16 membros.
 *
 * O fix: `sideToUids` agora aceita um mapa `participantById` e
 * resolve `p.id → user_id` quando o game está no schema legado.
 * Convidados sem `user_id` são pulados silenciosamente.
 *
 * Schema novo (com `user_id` direto no game) também funciona sem
 * precisar do mapa.
 */

import { describe, it, expect } from 'vitest';

// Cópia fiel da implementação server-side para teste isolado.
function sideToUids(side, participantById) {
  if (!Array.isArray(side)) return [];
  return side
    .map((p) => {
      if (p == null) return null;
      if (typeof p === 'string') return p;
      if (p.user_id) return p.user_id;
      if (p.id && participantById) {
        const ep = participantById.get(p.id);
        if (ep && ep.user_id) return ep.user_id;
      }
      return null;
    })
    .filter(Boolean);
}

function normalizeClubGame(g, participantById) {
  if (!g) return null;
  const points_a = Number(g.score_a) || 0;
  const points_b = Number(g.score_b) || 0;
  const a = sideToUids(g.side_a, participantById);
  const b = sideToUids(g.side_b, participantById);
  if (a.length === 0 || b.length === 0) return null;
  if (a.length > 2 || b.length > 2) return null;
  if (a.length !== b.length) return null;
  if (points_a === points_b) return null;
  return {
    source: 'club_event_game',
    side_a: a,
    side_b: b,
    winner: points_a > points_b ? 'a' : 'b',
    points_a,
    points_b,
  };
}

function applyToIndividual(bucket, match) {
  const a = match.side_a;
  const b = match.side_b;
  if (a.length === 0 || b.length === 0) return;
  if (match.winner !== 'a' && match.winner !== 'b') return;
  const aWon = match.winner === 'a';
  const bump = (uid, isWinner, pointsFor, pointsAgainst) => {
    const row = bucket.get(uid) || { user_id: uid, games: 0, wins: 0, losses: 0, points_for: 0, points_against: 0 };
    row.user_id = uid;
    row.games += 1;
    row.points_for += pointsFor;
    row.points_against += pointsAgainst;
    if (isWinner) row.wins += 1; else row.losses += 1;
    bucket.set(uid, row);
  };
  a.forEach((uid) => bump(uid, aWon, match.points_a, match.points_b));
  b.forEach((uid) => bump(uid, !aWon, match.points_b, match.points_a));
}

const buildParticipantsMap = (arr) => new Map(arr.map((p) => [p.id, p]));

describe('Wave C.6 — fix do user_id no materializado', () => {
  const participants = [
    { id: 'EP_fsa', user_id: 'UID_fsa', name: 'Fsa' },
    { id: 'EP_joao', user_id: 'UID_joao', name: 'João' },
    { id: 'EP_maria', user_id: 'UID_maria', name: 'Maria' },
    { id: 'EP_pedro', user_id: 'UID_pedro', name: 'Pedro' },
    { id: 'EP_convidado', user_id: null, name: 'Convidado Estranho' },
  ];
  const participantById = buildParticipantsMap(participants);

  const gameLegado = {
    id: 'game_1',
    side_a: [
      { id: 'EP_fsa', name: 'Fsa' },
      { id: 'EP_joao', name: 'João' },
    ],
    side_b: [
      { id: 'EP_maria', name: 'Maria' },
      { id: 'EP_pedro', name: 'Pedro' },
    ],
    score_a: 11,
    score_b: 5,
  };

  describe('sideToUids (server-side)', () => {
    it('resolve p.id → user_id via participantById (schema legado)', () => {
      const a = sideToUids(gameLegado.side_a, participantById);
      expect(a).toEqual(['UID_fsa', 'UID_joao']);
    });

    it('pula convidados sem user_id (silenciosamente)', () => {
      const sideWithGuest = [{ id: 'EP_maria', name: 'Maria' }, { id: 'EP_convidado', name: 'Convidado' }];
      const result = sideToUids(sideWithGuest, participantById);
      expect(result).toEqual(['UID_maria']); // convidado pulado
    });

    it('aceita schema novo (com user_id direto) sem precisar do mapa', () => {
      const sideNew = [{ id: 'X', user_id: 'UID_X', name: 'X' }];
      const result = sideToUids(sideNew, null);
      expect(result).toEqual(['UID_X']);
    });

    it('aceita array de strings (uids diretos)', () => {
      const result = sideToUids(['UID_a', 'UID_b'], null);
      expect(result).toEqual(['UID_a', 'UID_b']);
    });

    it('retorna [] se side não é array', () => {
      expect(sideToUids(null, participantById)).toEqual([]);
      expect(sideToUids(undefined, participantById)).toEqual([]);
    });
  });

  describe('normalizeClubGame (pipeline completo)', () => {
    it('normaliza jogo do schema legado COM participantById → popula', () => {
      const n = normalizeClubGame(gameLegado, participantById);
      expect(n).not.toBeNull();
      expect(n.side_a).toEqual(['UID_fsa', 'UID_joao']);
      expect(n.side_b).toEqual(['UID_maria', 'UID_pedro']);
      expect(n.winner).toBe('a');
    });

    it('REGRESSÃO: sem participantById, retorna null (materializado vazio)', () => {
      const n = normalizeClubGame(gameLegado, null);
      expect(n).toBeNull();
    });

    it('ignora jogo sem vencedor decidido (empate)', () => {
      const gameTie = { ...gameLegado, score_a: 11, score_b: 11 };
      const n = normalizeClubGame(gameTie, participantById);
      expect(n).toBeNull();
    });
  });

  describe('pipeline completo (applyToIndividual + sideToUids)', () => {
    it('materializado popula com user_ids reais para o cenário do Pickleholics', () => {
      const matches = [];
      const n = normalizeClubGame(gameLegado, participantById);
      if (n) matches.push(n);

      const ib = new Map();
      matches.forEach((m) => applyToIndividual(ib, m));

      // 4 atletas (não 5 — convidado sem user_id é pulado).
      expect(ib.size).toBe(4);
      expect(ib.has('UID_fsa')).toBe(true);
      expect(ib.has('UID_joao')).toBe(true);
      expect(ib.has('UID_maria')).toBe(true);
      expect(ib.has('UID_pedro')).toBe(true);
      // Nenhum doc_id de event_participant vaza para o materializado.
      expect(ib.has('EP_fsa')).toBe(false);
      expect(ib.has('EP_joao')).toBe(false);
      expect(ib.has('EP_maria')).toBe(false);
      expect(ib.has('EP_pedro')).toBe(false);

      // Vencedores (Fsa, João) ganham stats de vitória.
      expect(ib.get('UID_fsa').wins).toBe(1);
      expect(ib.get('UID_fsa').points_for).toBe(11);
      expect(ib.get('UID_fsa').points_against).toBe(5);
      // Perdedores (Maria, Pedro) ganham stats de derrota.
      expect(ib.get('UID_maria').losses).toBe(1);
      expect(ib.get('UID_maria').points_for).toBe(5);
      expect(ib.get('UID_maria').points_against).toBe(11);
    });

    it('REGRESSÃO: pipeline sem participantById → materializado vazio', () => {
      const matches = [];
      const n = normalizeClubGame(gameLegado, null);
      if (n) matches.push(n);

      const ib = new Map();
      matches.forEach((m) => applyToIndividual(ib, m));

      // Era assim antes do fix: 0 atletas no materializado.
      expect(ib.size).toBe(0);
    });
  });
});
