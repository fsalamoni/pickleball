import { describe, expect, it } from 'vitest';
import {
  announcementRecipients,
  buildAnnouncementWhatsAppText,
  validateAnnouncement,
} from './announcements.js';
import { REGISTRATION_STATUS } from './constants.js';

describe('announcementRecipients', () => {
  const regs = [
    { modality_id: 'm1', status: REGISTRATION_STATUS.CONFIRMED, user_id: 'a', player_a_user_id: 'a', player_b_user_id: 'b' },
    { modality_id: 'm1', status: REGISTRATION_STATUS.PENDING_PAYMENT, user_id: 'c', player_a_user_id: 'c', player_b_user_id: null },
    { modality_id: 'm2', status: REGISTRATION_STATUS.CONFIRMED, user_id: 'd', player_a_user_id: 'd', player_b_user_id: null },
    { modality_id: 'm2', status: REGISTRATION_STATUS.CANCELLED, user_id: 'x', player_a_user_id: 'x', player_b_user_id: null },
    { modality_id: 'm2', status: REGISTRATION_STATUS.CONFIRMED, is_placeholder: true, user_id: 'p' },
  ];

  it('deduplica uids e inclui jogador B vinculado', () => {
    expect(announcementRecipients(regs).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('filtra por modalidade quando informada', () => {
    expect(announcementRecipients(regs, { modalityId: 'm1' }).sort()).toEqual(['a', 'b', 'c']);
    expect(announcementRecipients(regs, { modalityId: 'm2' })).toEqual(['d']);
  });

  it('exclui canceladas e fictícias', () => {
    const out = announcementRecipients(regs);
    expect(out).not.toContain('x');
    expect(out).not.toContain('p');
  });

  it('lista vazia → sem destinatários', () => {
    expect(announcementRecipients([])).toEqual([]);
  });
});

describe('validateAnnouncement', () => {
  it('exige título e mensagem', () => {
    expect(validateAnnouncement({}).isValid).toBe(false);
    expect(validateAnnouncement({ title: 'Oi', message: ' ' }).isValid).toBe(false);
    expect(validateAnnouncement({ title: 'Oi', message: 'Corpo' }).isValid).toBe(true);
  });
});

describe('buildAnnouncementWhatsAppText', () => {
  it('monta o texto com título em negrito e nome do torneio', () => {
    const text = buildAnnouncementWhatsAppText({
      tournamentName: 'Copa X',
      title: 'Atenção',
      message: 'Jogos atrasados em 30 min.',
    });
    expect(text).toBe('*Atenção — Copa X*\n\nJogos atrasados em 30 min.');
  });

  it('funciona sem nome do torneio', () => {
    expect(buildAnnouncementWhatsAppText({ title: 'A', message: 'B' })).toBe('*A*\n\nB');
  });
});
