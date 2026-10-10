import { describe, it, expect } from 'vitest';
import {
  MY_LEVEL, SECTION_TITLES, buildLibrary, countByState, dayOf, groupSent, hasActiveFilters, inboxGroups, itemView,
  libraryFiltersFromParams, libraryParams, myItemState, pendingInfo, resolveLevel, sentState,
  shareAvailability, shareResultText,
} from './contentView';

const ts = (ms) => ({ toMillis: () => ms });

describe('filtros da biblioteca na URL', () => {
  it('lê o que é válido e ignora o resto', () => {
    const p = new URLSearchParams('q=dink&tipo=drill&habilidade=kitchen.dink_cruzado&nivel=3,5&jogadores=4&local=quadra&tempo=30&origem=professor&salvos=1');
    expect(libraryFiltersFromParams(p)).toEqual({
      text: 'dink', kind: 'drill', skill: 'kitchen.dink_cruzado', level: 3.5, players: 4,
      place: 'quadra', maxMinutes: 30, origin: 'professor', saved: true,
    });
    const ruim = libraryFiltersFromParams(new URLSearchParams('tipo=xx&habilidade=nada&nivel=12&local=lua&origem=x'));
    expect(ruim).toMatchObject({ kind: '', skill: '', level: null, place: '', origin: '' });
    expect(libraryFiltersFromParams(new URLSearchParams('nivel=meu')).level).toBe(MY_LEVEL);
  });

  it('ida e volta pela URL não perde nada', () => {
    const f = libraryFiltersFromParams(new URLSearchParams('q=saque&tipo=fisico&nivel=meu&tempo=45'));
    const de_novo = libraryFiltersFromParams(new URLSearchParams(Object.entries(libraryParams(f)).filter(([, v]) => v)));
    expect(de_novo).toEqual(f);
    expect(hasActiveFilters(f)).toBe(true);
    expect(hasActiveFilters(libraryFiltersFromParams(new URLSearchParams('')))).toBe(false);
  });

  it('"do meu nível" sem nível conhecido não esconde nada', () => {
    expect(resolveLevel(MY_LEVEL, 3.5)).toBe(3.5);
    expect(resolveLevel(MY_LEVEL, null)).toBeNull();
    expect(resolveLevel(4, null)).toBe(4);
  });
});

describe('buildLibrary', () => {
  const pub = [
    { id: 'a', kind: 'drill', title: 'Dink', summary: 's', author_role: 'plataforma', featured: true },
    { id: 'b', kind: 'drill', title: 'Saque', summary: 's', author_role: 'atleta', level_min: 5 },
    { id: 'c', kind: 'fisico', title: 'Agachamento', summary: 's', author_role: 'atleta' },
  ];
  const coach = [{ id: 'cc_1', kind: 'estudo', title: 'Regra', summary: 's', author_role: 'professor', legacy: true }];

  it('destaques no topo, professores depois, cada item num lugar só', () => {
    const r = buildLibrary({ publicItems: pub, coachItems: coach });
    expect(r.destaques.map((i) => i.id)).toEqual(['a']);
    expect(r.professores.map((i) => i.id)).toEqual(['cc_1']);
    expect(r.demais.map((i) => i.id).sort()).toEqual(['b', 'c']);
    expect(r.total).toBe(4);
  });

  it('filtra por nível, tipo e salvos', () => {
    expect(buildLibrary({ publicItems: pub, filters: { level: MY_LEVEL }, myLevel: 3 }).total).toBe(2);
    expect(buildLibrary({ publicItems: pub, filters: { level: MY_LEVEL }, myLevel: null }).total).toBe(3);
    expect(buildLibrary({ publicItems: pub, filters: { kind: 'fisico' } }).demais.map((i) => i.id)).toEqual(['c']);
    expect(buildLibrary({ publicItems: pub, filters: { saved: true }, favorites: ['c'] }).total).toBe(1);
  });
});

describe('Meus', () => {
  it('estado de cada item', () => {
    expect(myItemState({ visibility: 'privado' })).toBe('rascunho');
    expect(myItemState({ visibility: 'alunos' })).toBe('alunos');
    expect(myItemState({ visibility: 'publico', review: 'pendente' })).toBe('revisao');
    expect(myItemState({ visibility: 'publico', review: 'aprovado' })).toBe('aprovado');
    expect(myItemState({ visibility: 'publico', review: 'recusado' })).toBe('recusado');
    expect(myItemState({ visibility: 'publico', review: 'aprovado', hidden: true })).toBe('oculto');
    expect(countByState([{ visibility: 'privado' }, { visibility: 'privado' }]).rascunho).toBe(2);
  });

  it('limite de itens em revisão', () => {
    const itens = [{ review: 'pendente' }, { review: 'pendente' }, { review: 'aprovado' }];
    expect(pendingInfo(itens, { max_pending_per_user: 2 })).toEqual({ pendentes: 2, limite: 2, cheio: true });
    expect(pendingInfo(itens, {}).limite).toBe(5);
  });
});

describe('Recebidos e enviados', () => {
  it('do professor primeiro, indicações depois, feitos no fim', () => {
    const g = inboxGroups([
      { id: '1', kind: 'indicacao', created_at: ts(3) },
      { id: '2', kind: 'aluno', due_date: '2026-10-20', created_at: ts(1) },
      { id: '3', kind: 'aluno', done_at: ts(5), created_at: ts(2) },
    ]);
    expect(g.professor.map((s) => s.id)).toEqual(['2']);
    expect(g.indicacoes.map((s) => s.id)).toEqual(['1']);
    expect(g.feitos.map((s) => s.id)).toEqual(['3']);
  });

  it('só afirma "indisponível" com tudo carregado', () => {
    const share = { item_id: 'x' };
    expect(shareAvailability(share, { byId: { x: {} } })).toBe('ok');
    expect(shareAvailability(share, { byId: {}, isLoading: true })).toBe('desconhecido');
    expect(shareAvailability(share, { byId: {}, isError: true })).toBe('desconhecido');
    expect(shareAvailability(share, { byId: {}, incompleto: true })).toBe('desconhecido');
    expect(shareAvailability(share, { byId: {} })).toBe('indisponivel');
  });

  it('enviados agrupados por item, com quantos fizeram', () => {
    const g = groupSent([
      { item_id: 'a', item_title: 'A', created_at: ts(1), done_at: ts(9) },
      { item_id: 'b', item_title: 'B', created_at: ts(5) },
      { item_id: 'a', item_title: 'A', created_at: ts(3), read_at: ts(4) },
    ]);
    expect(g.map((x) => x.itemId)).toEqual(['b', 'a']);
    expect(g[1]).toMatchObject({ total: 2, done: 1 });
    expect(g[1].shares.map(sentState)).toEqual(['visto', 'feito']);
  });

  it('data do banco em dia local; sem instante, nada', () => {
    expect(dayOf(ts(new Date(2026, 9, 8, 15).getTime()), '2026-10-09')).toBe('Qui, 08/10');
    expect(dayOf(null)).toBe('');
  });

  it('o resultado do envio em português', () => {
    expect(shareResultText({ sent: 3, notified: 3 }, { kind: 'aluno' })).toBe('Enviado a 3 alunos.');
    expect(shareResultText({ sent: 1, notified: 1 })).toBe('Indicado a 1 pessoa.');
    expect(shareResultText({ sent: 0, skipped: 2 })).toBe('Ninguém recebeu de novo: todos já tinham este item em aberto.');
    expect(shareResultText({ sent: 2, skipped: 1, failed: 1, notified: 1 }, { kind: 'aluno' }))
      .toBe('Enviado a 2 alunos. 1 já tinha este item em aberto e não recebeu de novo. 1 envio não saiu — tente de novo. 1 pessoa não recebeu o aviso, mas o item já está em Recebidos.');
  });
});

describe('itemView', () => {
  it('item mínimo: só as seções que têm conteúdo', () => {
    const r = itemView({ kind: 'drill', title: 'Dink', summary: 'Resumo do drill', steps: ['Faça'] });
    expect(r.sections).toEqual(['passos']);
  });

  it('certo e errado juntos (texto e mídia), demonstração na galeria', () => {
    const r = itemView({
      kind: 'fundamento', title: 'Dink', summary: 'Resumo do golpe',
      positioning: [{ type: 'certo', text: 'Joelhos flexionados' }, { type: 'errado', text: 'Pernas esticadas' }],
      media: [
        { type: 'image', url: 'https://exemplo.com/a.jpg', tag: 'errado', caption: 'x' },
        { type: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', tag: 'demo' },
      ],
    });
    expect(r.sections).toEqual(['certoErrado', 'midia']);
    expect(r.certos).toHaveLength(1);
    expect(r.mediaErrado).toHaveLength(1);
    expect(r.mediaDemo).toHaveLength(1);
  });

  it('o que está fora do formato some (link sem https, mídia inválida)', () => {
    const r = itemView({ kind: 'estudo', title: 'Regra', summary: 'Resumo da regra', link: 'javascript:alert(1)', media: [{ type: 'video', url: 'https://exemplo.com/x' }] });
    expect(r.v.link).toBe('');
    expect(r.v.media).toEqual([]);
    expect(r.sections).toEqual([]);
  });

  it('conteúdo antigo do professor mostra o texto inteiro, sem repetir o resumo', () => {
    const r = itemView({ legacy: true, kind: 'estudo', title: 'Antigo', summary: 'Texto longo', body: 'Texto longo do professor' });
    expect(r.sections).toEqual(['conteudo']);
    expect(r.resumo).toBe('');
  });

  it('técnica ponto a ponto e autoavaliação entram na ordem de leitura', () => {
    const r = itemView({
      kind: 'fundamento', title: 'Dink', summary: 'Resumo do golpe', steps: ['Faça'], cues: ['Bola baixa'],
      common_errors: [{ error: 'Bola alta', fix: 'Abra a face' }],
      technique: { checkpoints: [{ part: 'pernas', text: 'Joelhos flexionados' }], self_check: ['A bola cai na cozinha'] },
    });
    expect(r.sections).toEqual(['passos', 'tecnica', 'dicas', 'erros', 'autoavaliacao']);
    for (const k of r.sections) expect(SECTION_TITLES[k]).toBeTruthy();
  });
});
