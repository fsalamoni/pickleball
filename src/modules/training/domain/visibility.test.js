import { describe, it, expect } from 'vitest';
import {
  VISIBILITY, REVIEW, AUTHOR_ROLE, PLATFORM_AUTHOR, visibilityOptionsFor, authorRoleFor, isAutoApproved, isVerifiedProfessor,
  reviewFor, publishNotice, isPubliclyListed, canSeeItem, canEditItem, isAuthor, authorBadge, itemStatusLabel,
} from './visibility.js';

const { PUBLICO, PRIVADO, ALUNOS } = VISIBILITY;
const { PROFESSOR, ATLETA, PLATAFORMA } = AUTHOR_ROLE;

describe('isAutoApproved (espelho de trainingAutoApproved na regra)', () => {
  it('padrões: professor e atleta passam por revisão', () => {
    expect(isAutoApproved(PROFESSOR)).toBe(false);
    expect(isAutoApproved(PROFESSOR, {}, { uid: 'p1' })).toBe(false);
    expect(isAutoApproved(ATLETA)).toBe(false);
  });

  it('as configurações desligam a revisão de cada papel', () => {
    expect(isAutoApproved(PROFESSOR, { public_review_professor: false })).toBe(true);
    expect(isAutoApproved(PROFESSOR, { public_review_professor: true })).toBe(false);
    expect(isAutoApproved(ATLETA, { public_review_atleta: false })).toBe(true);
    expect(isAutoApproved(ATLETA, { public_review_atleta: true })).toBe(false);
  });

  it('professor verificado pelo admin publica direto; a lista não vale para atleta', () => {
    const s = { public_review_professor: true, verified_professors: ['p1'] };
    expect(isAutoApproved(PROFESSOR, s, { uid: 'p1' })).toBe(true);
    expect(isAutoApproved(PROFESSOR, s, { uid: 'p2' })).toBe(false);
    expect(isAutoApproved(PROFESSOR, s)).toBe(false);
    expect(isAutoApproved(ATLETA, s, { uid: 'p1' })).toBe(false);
    expect(isVerifiedProfessor('p1', s)).toBe(true);
    expect(isVerifiedProfessor('p1', { verified_professors: 'p1' })).toBe(false);
    expect(isVerifiedProfessor(null, s)).toBe(false);
  });

  it('admin e plataforma sempre publicam direto', () => {
    expect(isAutoApproved(ATLETA, { public_review_atleta: true }, { isAdmin: true })).toBe(true);
    expect(isAutoApproved(PROFESSOR, { public_review_professor: true }, { isAdmin: true })).toBe(true);
    expect(isAutoApproved(PLATAFORMA)).toBe(true);
  });
});

describe('reviewFor', () => {
  it('não público ⇒ nao_se_aplica, para qualquer papel', () => {
    expect(reviewFor({ visibility: PRIVADO, role: ATLETA })).toBe(REVIEW.NAO_SE_APLICA);
    expect(reviewFor({ visibility: ALUNOS, role: PROFESSOR })).toBe(REVIEW.NAO_SE_APLICA);
    expect(reviewFor({ visibility: PRIVADO, role: ATLETA, isAdmin: true, adminReview: REVIEW.APROVADO }))
      .toBe(REVIEW.NAO_SE_APLICA);
  });

  it('público: professor não verificado e atleta pendentes; verificado aprovado direto', () => {
    expect(reviewFor({ visibility: PUBLICO, role: PROFESSOR })).toBe(REVIEW.PENDENTE);
    expect(reviewFor({ visibility: PUBLICO, role: ATLETA })).toBe(REVIEW.PENDENTE);
    const settings = { verified_professors: ['p1'] };
    expect(reviewFor({ visibility: PUBLICO, role: PROFESSOR, settings, uid: 'p1' })).toBe(REVIEW.APROVADO);
    expect(reviewFor({ visibility: PUBLICO, role: PROFESSOR, settings, uid: 'p2' })).toBe(REVIEW.PENDENTE);
  });

  it('item aprovado em que só o compartilhamento mudou continua aprovado', () => {
    expect(reviewFor({
      visibility: PUBLICO, role: ATLETA, previousReview: REVIEW.APROVADO, onlySharingChanged: true,
    })).toBe(REVIEW.APROVADO);
  });

  it('editar o conteúdo de um item aprovado de atleta devolve para a fila', () => {
    expect(reviewFor({
      visibility: PUBLICO, role: ATLETA, previousReview: REVIEW.APROVADO, onlySharingChanged: false,
    })).toBe(REVIEW.PENDENTE);
  });

  it('item recusado não volta a aprovado por mudar só o compartilhamento', () => {
    expect(reviewFor({
      visibility: PUBLICO, role: ATLETA, previousReview: REVIEW.RECUSADO, onlySharingChanged: true,
    })).toBe(REVIEW.PENDENTE);
  });

  it('o admin decide (adminReview), mas só com um valor conhecido', () => {
    expect(reviewFor({ visibility: PUBLICO, role: ATLETA, isAdmin: true, adminReview: REVIEW.RECUSADO }))
      .toBe(REVIEW.RECUSADO);
    expect(reviewFor({ visibility: PUBLICO, role: ATLETA, isAdmin: true, adminReview: 'qualquer' }))
      .toBe(REVIEW.APROVADO);
    // adminReview de quem não é admin é ignorado
    expect(reviewFor({ visibility: PUBLICO, role: ATLETA, adminReview: REVIEW.APROVADO })).toBe(REVIEW.PENDENTE);
  });
});

describe('canSeeItem (espelho da leitura de training_items)', () => {
  const base = { author_uid: 'autor', visibility: PRIVADO, review: REVIEW.NAO_SE_APLICA, hidden: false, shared_uids: [] };

  it('sem uid ninguém vê', () => {
    expect(canSeeItem({ ...base, visibility: PUBLICO, review: REVIEW.APROVADO }, {})).toBe(false);
  });

  it('o autor e o admin veem tudo, inclusive oculto', () => {
    expect(canSeeItem({ ...base, hidden: true }, { uid: 'autor' })).toBe(true);
    expect(canSeeItem({ ...base, hidden: true }, { uid: 'adm', isAdmin: true })).toBe(true);
  });

  it('público aprovado e não oculto: qualquer conta', () => {
    const it2 = { ...base, visibility: PUBLICO, review: REVIEW.APROVADO };
    expect(canSeeItem(it2, { uid: 'outro' })).toBe(true);
    expect(canSeeItem({ ...it2, review: REVIEW.PENDENTE }, { uid: 'outro' })).toBe(false);
    expect(canSeeItem({ ...it2, hidden: true }, { uid: 'outro' })).toBe(false);
  });

  it('alunos: só quem tem o autor como professor ativo', () => {
    const it2 = { ...base, visibility: ALUNOS };
    expect(canSeeItem(it2, { uid: 'aluno', activeCoachIds: ['autor'] })).toBe(true);
    expect(canSeeItem(it2, { uid: 'aluno', activeCoachIds: ['outro_prof'] })).toBe(false);
    expect(canSeeItem({ ...it2, hidden: true }, { uid: 'aluno', activeCoachIds: ['autor'] })).toBe(false);
  });

  it('privado: só quem está em shared_uids (e não oculto)', () => {
    const it2 = { ...base, shared_uids: ['amigo'] };
    expect(canSeeItem(it2, { uid: 'amigo' })).toBe(true);
    expect(canSeeItem(it2, { uid: 'estranho' })).toBe(false);
    expect(canSeeItem({ ...it2, hidden: true }, { uid: 'amigo' })).toBe(false);
  });
});

describe('papéis, edição e selos', () => {
  it('visibilityOptionsFor: "alunos" só para professor', () => {
    expect(visibilityOptionsFor(PROFESSOR)).toContain(ALUNOS);
    expect(visibilityOptionsFor(ATLETA)).not.toContain(ALUNOS);
    expect(visibilityOptionsFor(PLATAFORMA)).not.toContain(ALUNOS);
  });

  it('authorRoleFor: plataforma só para admin que pediu; senão professor/atleta', () => {
    expect(authorRoleFor({ asPlatform: true, isAdmin: true })).toBe(PLATAFORMA);
    expect(authorRoleFor({ asPlatform: true, isAdmin: false })).toBe(ATLETA);
    expect(authorRoleFor({ isAdmin: true, isCoach: true })).toBe(PROFESSOR);
    expect(authorRoleFor()).toBe(ATLETA);
  });

  it('canEditItem / isAuthor', () => {
    expect(canEditItem({ author_uid: 'a' }, { uid: 'a' })).toBe(true);
    expect(canEditItem({ author_uid: PLATFORM_AUTHOR }, { uid: 'adm', isAdmin: true })).toBe(true);
    expect(canEditItem({ author_uid: 'a' }, { uid: 'b' })).toBe(false);
    expect(canEditItem({ author_uid: 'a' }, {})).toBe(false);
    expect(isAuthor({ author_uid: 'a' }, 'a')).toBe(true);
    expect(isAuthor({ author_uid: undefined }, undefined)).toBe(false);
  });

  it('authorBadge por papel', () => {
    expect(authorBadge({ author_role: PLATAFORMA, author_name: 'X' }).label).toBe('Equipe PickleRush');
    expect(authorBadge({ author_role: PROFESSOR, author_name: 'Ana' }).label).toBe('Professor Ana');
    expect(authorBadge({ author_role: ATLETA, author_name: ' Bia ' }).label).toBe('Bia');
    expect(authorBadge({ author_role: ATLETA, author_name: '' }).name).toBe('Atleta');
  });

  it('itemStatusLabel', () => {
    expect(itemStatusLabel({ hidden: true, visibility: PUBLICO, review: REVIEW.APROVADO })).toBe('Oculto pela equipe');
    expect(itemStatusLabel({ visibility: PUBLICO, review: REVIEW.PENDENTE })).toBe('Em revisão');
    expect(itemStatusLabel({ visibility: PUBLICO, review: REVIEW.APROVADO })).toBe('Publicado');
    expect(itemStatusLabel({ visibility: PUBLICO, review: REVIEW.RECUSADO })).toBe('Não aprovado');
    expect(itemStatusLabel({ visibility: ALUNOS })).toBe('Meus alunos');
    expect(itemStatusLabel({})).toBe('Só eu');
  });

  it('isPubliclyListed exige público + aprovado + não oculto', () => {
    expect(isPubliclyListed({ visibility: PUBLICO, review: REVIEW.APROVADO })).toBe(true);
    expect(isPubliclyListed({ visibility: PUBLICO, review: REVIEW.APROVADO, hidden: true })).toBe(false);
    expect(isPubliclyListed({ visibility: PRIVADO, review: REVIEW.APROVADO })).toBe(false);
  });
});

describe('publishNotice', () => {
  it('não público: nada a dizer', () => {
    expect(publishNotice({ visibility: PRIVADO, role: ATLETA })).toBe('');
  });

  it('publicado direto, revisão nova ou revisão de nova versão', () => {
    expect(publishNotice({ visibility: PUBLICO, role: PROFESSOR })).toMatch(/revisa antes de publicar/);
    expect(publishNotice({ visibility: PUBLICO, role: PROFESSOR, settings: { verified_professors: ['p1'] }, uid: 'p1' }))
      .toMatch(/assim que você salvar/);
    expect(publishNotice({ visibility: PUBLICO, role: ATLETA })).toMatch(/revisa antes de publicar/);
    expect(publishNotice({ visibility: PUBLICO, role: ATLETA, wasApproved: true })).toMatch(/nova versão/);
    expect(publishNotice({ visibility: PUBLICO, role: ATLETA, isAdmin: true })).toMatch(/assim que você salvar/);
  });
});
