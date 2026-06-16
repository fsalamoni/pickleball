import { describe, it, expect } from 'vitest';
import {
  validatePollDraft,
  buildPoll,
  isPollClosed,
  tallyVotes,
  toggleOption,
} from './forumPoll.js';

describe('clubs/forumPoll domain', () => {
  describe('validatePollDraft', () => {
    it('treats a missing draft as valid (poll is optional)', () => {
      expect(validatePollDraft(null)).toEqual({ valid: true, error: null });
    });
    it('requires a question', () => {
      expect(validatePollDraft({ question: '  ', options: ['a', 'b'] }).valid).toBe(false);
    });
    it('requires at least two options', () => {
      expect(validatePollDraft({ question: 'Q', options: ['só uma'] }).valid).toBe(false);
    });
    it('rejects duplicate options', () => {
      expect(validatePollDraft({ question: 'Q', options: ['A', 'a'] }).valid).toBe(false);
    });
    it('accepts a valid draft', () => {
      expect(validatePollDraft({ question: 'Q', options: ['A', 'B'] }).valid).toBe(true);
    });
  });

  describe('buildPoll', () => {
    it('builds a poll with unique option ids', () => {
      const poll = buildPoll({ question: 'Melhor horário?', options: ['Manhã', 'Noite'], multiple: true });
      expect(poll.question).toBe('Melhor horário?');
      expect(poll.options).toHaveLength(2);
      expect(poll.options[0].id).not.toBe(poll.options[1].id);
      expect(poll.multiple).toBe(true);
      expect(poll.closes_at_ms).toBeNull();
    });
    it('parses a closing date', () => {
      const poll = buildPoll({ question: 'Q', options: ['A', 'B'], closesAt: '2030-01-01T00:00' });
      expect(poll.closes_at_ms).toBe(new Date('2030-01-01T00:00').getTime());
    });
    it('throws on an invalid draft', () => {
      expect(() => buildPoll({ question: '', options: ['A', 'B'] })).toThrow();
    });
    it('returns null without a draft', () => {
      expect(buildPoll(null)).toBeNull();
    });
  });

  describe('isPollClosed', () => {
    it('is open when there is no closing date', () => {
      expect(isPollClosed({ closes_at_ms: null })).toBe(false);
    });
    it('is closed after the closing time', () => {
      expect(isPollClosed({ closes_at_ms: 1000 }, 2000)).toBe(true);
      expect(isPollClosed({ closes_at_ms: 5000 }, 2000)).toBe(false);
    });
  });

  describe('tallyVotes', () => {
    const poll = { options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] };
    it('counts votes and computes percentages', () => {
      const votes = [
        { user_id: 'u1', option_ids: ['a'] },
        { user_id: 'u2', option_ids: ['a'] },
        { user_id: 'u3', option_ids: ['b'] },
      ];
      const { results, totalVotes, totalVoters } = tallyVotes(poll, votes);
      expect(totalVotes).toBe(3);
      expect(totalVoters).toBe(3);
      expect(results.find((r) => r.id === 'a').count).toBe(2);
      expect(results.find((r) => r.id === 'a').percentage).toBe(67);
      expect(results.find((r) => r.id === 'b').percentage).toBe(33);
    });
    it('counts multiple selections per voter', () => {
      const votes = [{ user_id: 'u1', option_ids: ['a', 'b'] }];
      const { totalVotes, totalVoters } = tallyVotes(poll, votes);
      expect(totalVotes).toBe(2);
      expect(totalVoters).toBe(1);
    });
    it('ignores unknown option ids', () => {
      const votes = [{ user_id: 'u1', option_ids: ['ghost'] }];
      const { totalVotes } = tallyVotes(poll, votes);
      expect(totalVotes).toBe(0);
    });
    it('handles empty input', () => {
      const { results, totalVotes } = tallyVotes(poll, []);
      expect(totalVotes).toBe(0);
      expect(results.every((r) => r.percentage === 0)).toBe(true);
    });
  });

  describe('toggleOption', () => {
    it('replaces selection in single mode', () => {
      expect(toggleOption(['a'], 'b', false)).toEqual(['b']);
    });
    it('clears when re-clicking the same option in single mode', () => {
      expect(toggleOption(['a'], 'a', false)).toEqual([]);
    });
    it('adds and removes in multiple mode', () => {
      expect(toggleOption(['a'], 'b', true).sort()).toEqual(['a', 'b']);
      expect(toggleOption(['a', 'b'], 'a', true)).toEqual(['b']);
    });
  });
});
