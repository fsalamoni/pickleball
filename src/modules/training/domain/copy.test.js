import { describe, it, expect } from 'vitest';
import { buildCopyInput, canCopyItem, derivedFromFor, isOpenToCopy } from './copy.js';

const pub = { id: 'p1', title: 'Dink cruzado', author_uid: 'prof', author_name: 'Ana', visibility: 'publico', review: 'aprovado', hidden: false };
const alunos = { id: 'a1', title: 'Só alunos', author_uid: 'prof', author_name: 'Ana', visibility: 'alunos', review: 'nao_se_aplica', hidden: false };

describe('copy', () => {
  it('cópia de item público ou próprio não trava', () => {
    expect(derivedFromFor(pub, 'eu').locked).toBe(false);
    expect(derivedFromFor({ ...alunos, author_uid: 'eu' }, 'eu').locked).toBe(false);
  });

  it('cópia de item só para alunos trava (não pode virar público)', () => {
    expect(derivedFromFor(alunos, 'eu')).toEqual({ id: 'a1', title: 'Só alunos', author_name: 'Ana', locked: true });
  });

  it('cópia de uma cópia travada continua travada, mesmo sendo minha', () => {
    const minhaTravada = { id: 'c1', author_uid: 'eu', visibility: 'privado', derived_from: { id: 'a1', locked: true } };
    expect(isOpenToCopy(minhaTravada, 'eu')).toBe(false);
    expect(derivedFromFor(minhaTravada, 'eu').locked).toBe(true);
  });

  it('item oculto não está aberto mesmo sendo público', () => {
    expect(isOpenToCopy({ ...pub, hidden: true }, 'eu')).toBe(false);
  });

  it('conteúdo antigo não é copiável', () => {
    expect(canCopyItem({ id: 'cc_1', legacy: true }, { uid: 'eu' }).ok).toBe(false);
    expect(canCopyItem(pub, { uid: null }).ok).toBe(false);
    expect(canCopyItem(pub, { uid: 'eu' }).ok).toBe(true);
  });

  it('o formulário da cópia leva só o conteúdo, privado, sem caminho de upload', () => {
    const src = {
      ...pub, kind: 'drill', summary: 'Resumo longo o bastante', featured: true, shared_uids: ['x'], review_note: 'n',
      media: [{ type: 'image', source: 'upload', url: 'https://x/y.webp', path: 'treino/prof/y.webp' }],
    };
    const c = buildCopyInput(src);
    expect(c.title).toBe('Cópia de Dink cruzado');
    expect(c.visibility).toBe('privado');
    expect(c.kind).toBe('drill');
    expect(c.media[0]).toMatchObject({ url: 'https://x/y.webp', path: null });
    for (const k of ['id', 'author_uid', 'featured', 'shared_uids', 'review', 'review_note']) expect(c).not.toHaveProperty(k);
  });
});
