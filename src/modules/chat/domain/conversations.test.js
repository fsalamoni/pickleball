import { describe, it, expect } from 'vitest';
import {
  toMember,
  dedupeMembers,
  directConversationId,
  conversationTypeFor,
  conversationTitle,
  directCounterpart,
  lastMessagePreview,
} from './conversations.js';
import { CONVERSATION_TYPE } from './constants.js';

describe('chat/conversations domain', () => {
  describe('toMember', () => {
    it('normalizes a user-like object', () => {
      expect(toMember({ uid: 'a', platform_name: 'Ana', photoURL: 'p' })).toEqual({
        uid: 'a',
        name: 'Ana',
        photo_url: 'p',
      });
    });
    it('accepts id/user_id as uid', () => {
      expect(toMember({ id: 'x', name: 'X' }).uid).toBe('x');
      expect(toMember({ user_id: 'y', name: 'Y' }).uid).toBe('y');
    });
    it('returns null without an id', () => {
      expect(toMember({ name: 'No id' })).toBeNull();
      expect(toMember(null)).toBeNull();
    });
    it('falls back to a default name', () => {
      expect(toMember({ uid: 'a' }).name).toBe('Atleta');
    });
  });

  describe('dedupeMembers', () => {
    it('removes duplicates and invalid entries', () => {
      const result = dedupeMembers([
        { uid: 'a', name: 'A' },
        { uid: 'a', name: 'A dup' },
        { name: 'invalid' },
        { uid: 'b', name: 'B' },
      ]);
      expect(result.map((m) => m.uid)).toEqual(['a', 'b']);
    });
  });

  describe('directConversationId', () => {
    it('is deterministic regardless of argument order', () => {
      expect(directConversationId('u1', 'u2')).toBe(directConversationId('u2', 'u1'));
    });
    it('produces the expected format', () => {
      expect(directConversationId('b', 'a')).toBe('dm_a__b');
    });
    it('returns null with a missing id', () => {
      expect(directConversationId('a', '')).toBeNull();
      expect(directConversationId('', 'b')).toBeNull();
    });
  });

  describe('conversationTypeFor', () => {
    it('is direct for two members', () => {
      expect(conversationTypeFor(['a', 'b'])).toBe(CONVERSATION_TYPE.DIRECT);
    });
    it('is group for three or more', () => {
      expect(conversationTypeFor(['a', 'b', 'c'])).toBe(CONVERSATION_TYPE.GROUP);
    });
  });

  describe('conversationTitle', () => {
    it('uses the other member name for direct chats', () => {
      const conv = {
        type: CONVERSATION_TYPE.DIRECT,
        members: [
          { uid: 'me', name: 'Eu' },
          { uid: 'other', name: 'Bruno Costa' },
        ],
      };
      expect(conversationTitle(conv, 'me')).toBe('Bruno Costa');
    });
    it('prefers a saved group title', () => {
      const conv = {
        type: CONVERSATION_TYPE.GROUP,
        title: 'Treino de quinta',
        members: [{ uid: 'me', name: 'Eu' }, { uid: 'a', name: 'A' }, { uid: 'b', name: 'B' }],
      };
      expect(conversationTitle(conv, 'me')).toBe('Treino de quinta');
    });
    it('builds a group title from first names when none is saved', () => {
      const conv = {
        type: CONVERSATION_TYPE.GROUP,
        members: [
          { uid: 'me', name: 'Eu' },
          { uid: 'a', name: 'Ana Lima' },
          { uid: 'b', name: 'Bruno Costa' },
        ],
      };
      expect(conversationTitle(conv, 'me')).toBe('Ana, Bruno');
    });
    it('summarizes large groups with a +N suffix', () => {
      const conv = {
        type: CONVERSATION_TYPE.GROUP,
        members: [
          { uid: 'me', name: 'Eu' },
          { uid: 'a', name: 'Ana' },
          { uid: 'b', name: 'Bruno' },
          { uid: 'c', name: 'Carla' },
          { uid: 'd', name: 'Diego' },
        ],
      };
      expect(conversationTitle(conv, 'me')).toBe('Ana, Bruno, Carla +1');
    });
  });

  describe('directCounterpart', () => {
    it('returns the other member of a direct chat', () => {
      const conv = {
        type: CONVERSATION_TYPE.DIRECT,
        members: [{ uid: 'me', name: 'Eu' }, { uid: 'other', name: 'Outro' }],
      };
      expect(directCounterpart(conv, 'me').uid).toBe('other');
    });
    it('returns null for groups', () => {
      const conv = { type: CONVERSATION_TYPE.GROUP, members: [] };
      expect(directCounterpart(conv, 'me')).toBeNull();
    });
  });

  describe('lastMessagePreview', () => {
    it('shows the text when present', () => {
      expect(lastMessagePreview({ last_message: { text: 'Oi' } })).toBe('Oi');
    });
    it('indicates an attachment when there is no text', () => {
      expect(lastMessagePreview({ last_message: { has_attachments: true } })).toBe('📎 Anexo');
    });
    it('handles a brand-new conversation', () => {
      expect(lastMessagePreview({})).toBe('Conversa iniciada');
    });
  });
});
