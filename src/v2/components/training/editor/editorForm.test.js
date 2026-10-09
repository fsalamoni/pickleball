import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizeItemInput } from '@/modules/training/domain/trainingItem';
import { normalizeTrainingSettings } from '@/modules/training/domain/settings';
import {
  campoVisivel, clearDraft, draftKey, fillFromAi, firstErrorKey, formFromItem, levelOptions,
  mergeEmptyFields, moveItem, orphanUploads, readDraft, saveNotice, secoesVisiveis, temConteudo, writeDraft,
} from './editorForm';

describe('formFromItem', () => {
  it('traz o conteúdo e completa o que falta, sem campos de autoria', () => {
    const f = formFromItem({
      id: 'x', author_uid: 'u', review: 'aprovado', kind: 'fundamento', title: 'Drop',
      variations: { easier: 'Tarefa: mais perto' }, motor: { phases: { execucao: 'sobe' } }, visibility: 'publico',
    });
    expect(f.id).toBeUndefined();
    expect(f.author_uid).toBeUndefined();
    expect(f.kind).toBe('fundamento');
    expect(f.variations).toEqual({ easier: 'Tarefa: mais perto', harder: '' });
    expect(f.motor).toEqual({ phases: { preparacao: '', execucao: 'sobe', finalizacao: '' }, abilities: [] });
    expect(f.steps).toEqual([]);
    expect(f.visibility).toBe('publico');
  });

  it('o formulário inteiro passa pelo normalizador do domínio (o input que vai para o serviço)', () => {
    const f = { ...formFromItem({ kind: 'drill' }), title: 'Dink cruzado', summary: 'Dois na cozinha trocando dinks.', steps: ['Troquem dinks', ''], level_min: '3.5', players_min: '2', intensity: '4' };
    const { valid, value } = normalizeItemInput(f);
    expect(valid).toBe(true);
    expect(value).toMatchObject({ steps: ['Troquem dinks'], level_min: 3.5, players_min: 2, intensity: 4 });
  });
});

describe('quais campos aparecem', () => {
  it('cada tipo vê só o que vale para ele', () => {
    const vazio = formFromItem({ kind: 'treino' });
    expect(campoVisivel('treino', 'blocks', vazio)).toBe(true);
    expect(campoVisivel('treino', 'steps', vazio)).toBe(false);
    expect(campoVisivel('drill', 'blocks', vazio)).toBe(false);
    expect(campoVisivel('estudo', 'link', vazio)).toBe(true);
    expect(campoVisivel('drill', 'title', vazio)).toBe(true);
    expect(secoesVisiveis('treino', vazio).map((s) => s.id)).toContain('blocos');
    expect(secoesVisiveis('drill', vazio).map((s) => s.id)).not.toContain('blocos');
  });

  it('⭐ nada que vai ser gravado fica escondido: campo com conteúdo aparece em qualquer tipo', () => {
    const f = { ...formFromItem({ kind: 'treino' }), cues: ['Mire o pé'] };
    expect(campoVisivel('treino', 'cues', f)).toBe(true);
  });

  it('temConteudo: zero conta, texto em branco e objeto vazio não', () => {
    expect(temConteudo(0)).toBe(true);
    expect(temConteudo('  ')).toBe(false);
    expect(temConteudo({ type: '', target: '' })).toBe(false);
    expect(temConteudo({ phases: { a: '' }, abilities: ['ritmo'] })).toBe(true);
  });
});

describe('IA', () => {
  const form = { ...formFromItem({ kind: 'drill' }), title: 'Meu título', visibility: 'publico' };
  const ia = { kind: 'fundamento', title: 'Título da IA', summary: 'Resumo da IA para o item.', cues: ['Mire'], visibility: 'privado' };

  it('só os vazios: mantém o que a pessoa escreveu, o tipo e a visibilidade', () => {
    const f = mergeEmptyFields(form, ia);
    expect(f.title).toBe('Meu título');
    expect(f.summary).toBe('Resumo da IA para o item.');
    expect(f.cues).toEqual(['Mire']);
    expect(f.kind).toBe('drill');
    expect(f.visibility).toBe('publico');
  });

  it('tudo: troca o conteúdo, mas a visibilidade continua a escolhida', () => {
    const f = fillFromAi(form, ia);
    expect(f.title).toBe('Título da IA');
    expect(f.kind).toBe('fundamento');
    expect(f.visibility).toBe('publico');
  });
});

describe('listas e erros', () => {
  it('moveItem troca com o vizinho e não sai da lista', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    const l = ['a', 'b'];
    expect(moveItem(l, 0, -1)).toBe(l);
    expect(moveItem(l, 1, 1)).toBe(l);
  });

  it('o primeiro erro segue a ordem do formulário', () => {
    expect(firstErrorKey({ steps: 'x', title: 'y' })).toBe('title');
    expect(firstErrorKey({ outro: 'z' })).toBe('outro');
    expect(firstErrorKey({})).toBeNull();
  });

  it('níveis de meio em meio ponto na régua 2,0–8,0', () => {
    const n = levelOptions();
    expect(n[0]).toBe(2);
    expect(n.at(-1)).toBe(8);
    expect(n).toHaveLength(13);
  });
});

describe('rascunho local', () => {
  afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

  it('chave por usuário e por item; a cópia tem chave própria', () => {
    expect(draftKey('u1', {})).toBe('v2:draft:u1:treino:novo');
    expect(draftKey('u1', { itemId: 'abc' })).toBe('v2:draft:u1:treino:abc');
    expect(draftKey('u1', { copiar: 'orig' })).toBe('v2:draft:u1:treino:novo-copia-orig');
    expect(draftKey(null, {})).toBeNull();
  });

  it('grava, lê e apaga', () => {
    const k = draftKey('u1', {});
    writeDraft(k, { form: { ...formFromItem({ kind: 'jogada' }), title: 'Rascunho' }, aiAssisted: true }, 123);
    const d = readDraft(k);
    expect(d).toMatchObject({ savedAt: 123, aiAssisted: true });
    expect(d.form.title).toBe('Rascunho');
    expect(d.form.kind).toBe('jogada');
    clearDraft(k);
    expect(readDraft(k)).toBeNull();
  });

  it('armazenamento bloqueado ou lixo não derrubam a tela', () => {
    const k = draftKey('u1', {});
    window.localStorage.setItem(k, '{lixo');
    expect(readDraft(k)).toBeNull();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('cheio'); });
    expect(readDraft(k)).toBeNull();
    expect(() => writeDraft(k, { form: {} })).not.toThrow();
  });
});

describe('depois de salvar', () => {
  it('⭐ apaga só os arquivos DESTA pessoa que saíram do item', () => {
    const before = [
      { source: 'upload', path: 'treino/u1/a.webp' },
      { source: 'upload', path: 'treino/u1/b.webp' },
      { source: 'url', url: 'https://x' },
      { source: 'upload', path: 'treino/outra/c.webp' },
    ];
    const after = [{ source: 'upload', path: 'treino/u1/b.webp' }];
    expect(orphanUploads({ before, sessionPaths: ['treino/u1/novo.mp4', 'treino/u1/b.webp'], after, uid: 'u1' }))
      .toEqual(['treino/u1/a.webp', 'treino/u1/novo.mp4']);
    expect(orphanUploads({ before, after: [], uid: null })).toEqual([]);
  });

  it('o aviso de publicação diz antes o que vai acontecer — e o menor sempre passa por revisão', () => {
    const settings = normalizeTrainingSettings(null);
    expect(saveNotice({ visibility: 'privado', role: 'atleta', settings })).toBe('');
    expect(saveNotice({ visibility: 'publico', role: 'atleta', settings })).toMatch(/revisa/);
    expect(saveNotice({ visibility: 'publico', role: 'professor', settings })).toMatch(/publicado/);
    expect(saveNotice({ visibility: 'publico', role: 'professor', settings, ageYears: 16 })).toMatch(/revisa/);
  });
});
