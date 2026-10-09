import { describe, it, expect } from 'vitest';
import { QUESTION_STATUS, normalizeQuestion, statusAfterMessage, sortQuestions } from './question.js';

describe('normalizeQuestion', () => {
  const base = { coach_uid: 'prof', coach_name: 'Ana', subject: 'Dink alto', text: 'Como evito?' };

  it('válida, com item opcional', () => {
    const r = normalizeQuestion({ ...base, item_id: 'i1', item_title: 'Dink' });
    expect(r.valid).toBe(true);
    expect(r.value).toEqual({ coach_uid: 'prof', coach_name: 'Ana', subject: 'Dink alto', item_id: 'i1', item_title: 'Dink', text: 'Como evito?' });
    expect(normalizeQuestion(base).value.item_id).toBeNull();
  });

  it('erros na ordem: professor, assunto, texto', () => {
    expect(normalizeQuestion({ ...base, coach_uid: '' }).error).toBe('Escolha o professor.');
    expect(normalizeQuestion({ ...base, subject: ' a ' }).error).toBe('Escreva o assunto.');
    expect(normalizeQuestion({ ...base, text: '' }).error).toBe('Escreva a sua dúvida.');
    expect(normalizeQuestion({ ...base, text: '' }).valid).toBe(false);
  });

  it('corta assunto e texto', () => {
    const r = normalizeQuestion({ ...base, subject: 's'.repeat(300), text: 't'.repeat(3000) });
    expect(r.value.subject).toHaveLength(120);
    expect(r.value.text).toHaveLength(2000);
  });
});

describe('statusAfterMessage', () => {
  it('resposta do professor ⇒ respondida; do aluno ⇒ aberta', () => {
    expect(statusAfterMessage('professor')).toBe(QUESTION_STATUS.RESPONDIDA);
    expect(statusAfterMessage('aluno')).toBe(QUESTION_STATUS.ABERTA);
  });
});

describe('sortQuestions', () => {
  const ts = (s) => ({ seconds: s });
  const list = [
    { id: 'enc', status: 'encerrada', updated_at: ts(9) },
    { id: 'resp', status: 'respondida', updated_at: ts(5) },
    { id: 'aberta_velha', status: 'aberta', updated_at: ts(1) },
    { id: 'aberta_nova', status: 'aberta', updated_at: ts(3) },
  ];

  it('professor vê primeiro as abertas (a quem ele deve resposta)', () => {
    expect(sortQuestions(list, { viewerIsCoach: true }).map((q) => q.id)).toEqual(['aberta_nova', 'aberta_velha', 'resp', 'enc']);
  });

  it('aluno vê primeiro as respondidas; encerradas por último', () => {
    expect(sortQuestions(list).map((q) => q.id)).toEqual(['resp', 'aberta_nova', 'aberta_velha', 'enc']);
  });
});
