import { describe, it, expect } from 'vitest';
import {
  ITEM_LIMITS, normalizeLevel, blankItem, normalizeItemInput, itemQuality, itemMetaLine, fitsLevel,
  filterItems, normalizeText, sortLibrary, sortRecent, fromCoachContent, linkedItemIds,
} from './trainingItem.js';

const ok = (over = {}) => ({
  kind: 'drill', title: 'Dink cruzado', summary: 'Dez dinks cruzados sem errar.', steps: ['Posicione-se'], ...over,
});

describe('normalizeItemInput — obrigatórios', () => {
  it('item mínimo válido', () => {
    const r = normalizeItemInput(ok());
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual({});
    expect(r.value.kind).toBe('drill');
  });

  it('mapa de erros: tipo, nome e resumo', () => {
    const r = normalizeItemInput({ kind: 'nada', title: 'ab', summary: 'curto' });
    expect(r.valid).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['kind', 'summary', 'title']);
    expect(r.value.kind).toBe('drill'); // padrão para a tela continuar
  });

  it('drill e físico exigem passo a passo; fundamento e jogada não', () => {
    expect(normalizeItemInput(ok({ steps: [] })).errors.steps).toBeTruthy();
    expect(normalizeItemInput(ok({ kind: 'fisico', steps: ['  '] })).errors.steps).toBeTruthy();
    expect(normalizeItemInput(ok({ kind: 'fundamento', steps: [] })).valid).toBe(true);
    expect(normalizeItemInput(ok({ kind: 'jogada', steps: [] })).valid).toBe(true);
  });

  it('treino exige ao menos um bloco válido', () => {
    expect(normalizeItemInput(ok({ kind: 'treino', blocks: [] })).errors.blocks).toBeTruthy();
    expect(normalizeItemInput(ok({ kind: 'treino', blocks: [{ type: 'raro', title: 'X' }] })).errors.blocks).toBeTruthy();
    const r = normalizeItemInput(ok({
      kind: 'treino',
      blocks: [{ type: 'aquecimento', title: 'Solta', duration_min: 999, item_id: 'abc', notes: 'n' }],
    }));
    expect(r.valid).toBe(true);
    expect(r.value.blocks[0]).toEqual({ type: 'aquecimento', title: 'Solta', duration_min: 240, item_id: 'abc', notes: 'n' });
  });

  it('estudo de regra exige a edição; leitura não', () => {
    expect(normalizeItemInput(ok({ kind: 'estudo', study_type: 'regra' })).errors.rules_edition).toBeTruthy();
    expect(normalizeItemInput(ok({ kind: 'estudo', study_type: 'regra', rules_edition: 'USA Pickleball 2026' })).valid).toBe(true);
    const r = normalizeItemInput(ok({ kind: 'estudo' }));
    expect(r.valid).toBe(true);
    expect(r.value.study_type).toBe('leitura');
  });

  it('link só https', () => {
    expect(normalizeItemInput(ok({ link: 'http://exemplo.com' })).errors.link).toBeTruthy();
    expect(normalizeItemInput(ok({ link: 'javascript:alert(1)' })).errors.link).toBeTruthy();
    const r = normalizeItemInput(ok({ link: 'https://usapickleball.org/regras' }));
    expect(r.valid).toBe(true);
    expect(r.value.link).toBe('https://usapickleball.org/regras');
    expect(normalizeItemInput(ok({ link: '' })).value.link).toBe('');
  });
});

describe('normalizeItemInput — limites e normalização', () => {
  it('corta os textos e as listas nos limites', () => {
    const r = normalizeItemInput(ok({
      title: 't'.repeat(300),
      summary: 's'.repeat(400),
      steps: Array.from({ length: 30 }, () => 'p'.repeat(500)),
      cues: Array.from({ length: 20 }, () => 'c'),
      roles: Array.from({ length: 9 }, () => 'r'.repeat(50)),
    }));
    expect(r.value.title).toHaveLength(ITEM_LIMITS.title);
    expect(r.value.summary).toHaveLength(ITEM_LIMITS.summary);
    expect(r.value.steps).toHaveLength(ITEM_LIMITS.steps);
    expect(r.value.steps[0]).toHaveLength(ITEM_LIMITS.step);
    expect(r.value.cues).toHaveLength(ITEM_LIMITS.cues);
    expect(r.value.roles).toHaveLength(ITEM_LIMITS.roles);
    expect(r.value.roles[0]).toHaveLength(ITEM_LIMITS.role);
  });

  it('nível e jogadores: limites, vírgula decimal e troca quando invertidos', () => {
    const r = normalizeItemInput(ok({ level_min: '5,0', level_max: 1, players_min: 9, players_max: 2 }));
    expect([r.value.level_min, r.value.level_max]).toEqual([2, 5]);
    expect([r.value.players_min, r.value.players_max]).toEqual([2, 8]);
    expect(normalizeLevel('')).toBeNull();
    expect(normalizeLevel('3,46')).toBe(3.5);
    expect(normalizeLevel(9)).toBe(8);
  });

  it('habilidades válidas, sem repetir, até 6; enums filtrados', () => {
    const r = normalizeItemInput(ok({
      skills: ['kitchen', 'kitchen', 'inventada', 'net.reset', 'serve', 'mental', 'rules', 'doubles', 'physical'],
      place: ['quadra', 'lua', 'quadra'],
      equipment: ['bolas', 'foguete'],
      intensity: 14,
      duration_min: -5,
      motor: { abilities: ['ritmo', 'voar'] },
    }));
    expect(r.value.skills).toEqual(['kitchen', 'net.reset', 'serve', 'mental', 'rules', 'doubles']);
    expect(r.value.place).toEqual(['quadra']);
    expect(r.value.equipment).toEqual(['bolas']);
    expect(r.value.intensity).toBe(10);
    expect(r.value.duration_min).toBe(0);
    expect(r.value.motor.abilities).toEqual(['ritmo']);
  });

  it('campos de físico e estudo só no tipo deles', () => {
    const fis = normalizeItemInput(ok({ kind: 'fisico', sets: 30, reps: '30 s', rest_sec: 900 })).value;
    expect([fis.sets, fis.reps, fis.rest_sec]).toEqual([20, '30 s', 600]);
    const dr = normalizeItemInput(ok({ sets: 3, reps: '12', questions: ['por quê?'] })).value;
    expect([dr.sets, dr.reps, dr.questions]).toEqual([null, '', []]);
  });

  it('posicionamento, erros comuns e meta', () => {
    const v = normalizeItemInput(ok({
      positioning: [{ type: 'errado', text: 'Pé na cozinha' }, { type: 'x', text: 'ok' }, { text: '' }],
      common_errors: [{ error: 'Pulso solto', fix: 'Firme' }, { error: '', fix: 'sem erro' }],
      metric: { type: 'invalida', target: '10' },
    })).value;
    expect(v.positioning).toEqual([{ type: 'errado', text: 'Pé na cozinha' }, { type: 'certo', text: 'ok' }]);
    expect(v.common_errors).toEqual([{ error: 'Pulso solto', fix: 'Firme' }]);
    expect(v.metric).toEqual({ type: '', target: '' });
  });

  it('o item em branco do editor normaliza sem quebrar', () => {
    expect(blankItem('treino').kind).toBe('treino');
    expect(blankItem('nada').kind).toBe('drill');
    const r = normalizeItemInput(blankItem('estudo'));
    expect(r.valid).toBe(false);
    expect(r.errors.title).toBeTruthy();
  });
});

describe('itemQuality', () => {
  it('drill completo tira nota máxima; vazio aponta o que falta', () => {
    const full = {
      kind: 'drill', objective: 'o', skills: ['kitchen'], level_min: 3, steps: ['a', 'b'], cues: ['c'],
      common_errors: [{ error: 'e' }], diagrams: [{}], setup: 's', success_criteria: 'x', variations: { easier: 'e' },
    };
    const q = itemQuality(full);
    expect(q.score).toBe(q.total);
    expect(q.missing).toEqual([]);
    const empty = itemQuality({ kind: 'drill' });
    expect(empty.score).toBe(0);
    expect(empty.missing).toContain('Montagem');
  });

  it('treino pede 3 blocos e duração; estudo pede link e perguntas', () => {
    expect(itemQuality({ kind: 'treino', blocks: [{}, {}] }).missing).toContain('Pelo menos 3 blocos');
    expect(itemQuality({ kind: 'estudo', link: 'https://x.com', questions: ['q'] }).missing).not.toContain('Link ou mídia');
  });
});

describe('itemMetaLine', () => {
  it('duração, jogadores e nível', () => {
    expect(itemMetaLine({ duration_min: 15, players_min: 2, players_max: 4, level_min: 3, level_max: 4.5 }))
      .toBe('15 min · 2–4 jogadores · nível 3,0–4,5');
    expect(itemMetaLine({ players_min: 1, level_min: 3.5 })).toBe('1 jogador · nível 3,5+');
    expect(itemMetaLine({})).toBe('');
  });
});

describe('fitsLevel', () => {
  const it3a4 = { level_min: 3, level_max: 4 };

  it('nível desconhecido nunca esconde', () => {
    expect(fitsLevel(it3a4, null)).toBe(true);
    expect(fitsLevel(it3a4, undefined)).toBe(true);
    expect(fitsLevel(it3a4, '3')).toBe(true);
  });

  it('folga de 0,25 nas pontas', () => {
    expect(fitsLevel(it3a4, 2.8)).toBe(true);
    expect(fitsLevel(it3a4, 2.7)).toBe(false);
    expect(fitsLevel(it3a4, 4.25)).toBe(true);
    expect(fitsLevel(it3a4, 4.3)).toBe(false);
    expect(fitsLevel({}, 7)).toBe(true);
  });
});

describe('filterItems', () => {
  const items = [
    { id: 'a', kind: 'drill', title: 'Dink cruzado', summary: 'Jogo curto', skills: ['kitchen.dink_cruzado'], players_min: 2, players_max: 4, place: ['quadra'], duration_min: 15, author_role: 'plataforma', level_min: 2.5, level_max: 4 },
    { id: 'b', kind: 'fisico', title: 'Agachamento', summary: 'Pernas', skills: ['physical'], place: [], duration_min: 30, author_role: 'professor', author_name: 'Zé Ação' },
    { id: 'c', kind: 'drill', title: 'Reset na transição', summary: 'Bola baixa', skills: ['net.reset'], players_min: 4, place: ['quadra'], duration_min: 45, author_role: 'atleta', cues: ['joelho flexionado'] },
  ];
  const ids = (f) => filterItems(items, f).map((x) => x.id);

  it('sem filtro devolve tudo', () => expect(ids({})).toEqual(['a', 'b', 'c']));
  it('por tipo e origem', () => {
    expect(ids({ kind: 'drill' })).toEqual(['a', 'c']);
    expect(ids({ origin: 'professor' })).toEqual(['b']);
  });
  it('habilidade: área inclui sub-habilidades e vice-versa', () => {
    expect(ids({ skill: 'kitchen' })).toEqual(['a']);
    expect(ids({ skill: 'physical.core' })).toEqual(['b']);
    expect(ids({ skill: 'net.reset' })).toEqual(['c']);
  });
  it('nível, jogadores, local e duração', () => {
    expect(ids({ level: 5 })).toEqual(['b', 'c']);
    expect(ids({ players: 3 })).toEqual(['a', 'b']);
    expect(ids({ place: 'casa' })).toEqual(['b']); // sem local declarado serve em qualquer lugar
    expect(ids({ maxMinutes: 30 })).toEqual(['a', 'b']);
  });
  it('texto sem acento, em vários termos, também no autor e nas dicas', () => {
    expect(ids({ text: 'ACAO' })).toEqual(['b']);
    expect(ids({ text: 'joelho reset' })).toEqual(['c']);
    expect(ids({ text: 'dink pernas' })).toEqual([]);
  });
  it('normalizeText tira acento e caixa', () => {
    expect(normalizeText('  Ação Rápida ')).toBe('acao rapida');
  });
});

describe('sortLibrary / sortRecent', () => {
  const ts = (s) => ({ seconds: s });
  const rich = { kind: 'fundamento', objective: 'o', skills: ['net'], level_min: 3, steps: ['a', 'b'], cues: ['c'], common_errors: [{}], diagrams: [{}], positioning: [{}], when_to_use: 'w' };

  it('destaques › qualidade › mais recente', () => {
    const list = [
      { id: 'pobre_novo', kind: 'fundamento', updated_at: ts(300) },
      { id: 'rico_velho', ...rich, updated_at: ts(100) },
      { id: 'destaque', kind: 'fundamento', featured: true, created_at: ts(1) },
      { id: 'rico_novo', ...rich, updated_at: { toMillis: () => 200000 } },
    ];
    expect(sortLibrary(list).map((x) => x.id)).toEqual(['destaque', 'rico_novo', 'rico_velho', 'pobre_novo']);
  });

  it('qualidade parecida (≤ 0,15) desempata pela data', () => {
    const a = { id: 'a', kind: 'drill', objective: 'x', updated_at: 1000 };
    const b = { id: 'b', kind: 'drill', updated_at: 2000 };
    expect(sortLibrary([a, b]).map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('sortRecent não altera a lista original', () => {
    const list = [{ id: 'x', created_at: ts(1) }, { id: 'y', created_at: ts(2) }];
    expect(sortRecent(list).map((x) => x.id)).toEqual(['y', 'x']);
    expect(list[0].id).toBe('x');
  });
});

describe('fromCoachContent', () => {
  it('adapta o conteúdo antigo do professor, só leitura', () => {
    const it2 = fromCoachContent({
      id: 'k1', category: 'tatica', title: 'Stacking', body: 'Como trocar de lado.', coach_id: 'prof',
      visibility: 'students', video_url: 'https://youtu.be/dQw4w9WgXcQ',
    }, 'Ana');
    expect(it2).toMatchObject({
      id: 'cc_k1', legacy: true, legacy_id: 'k1', kind: 'jogada', title: 'Stacking', summary: 'Como trocar de lado.',
      author_uid: 'prof', author_role: 'professor', author_name: 'Ana', visibility: 'alunos', review: 'aprovado', hidden: false,
    });
    expect(it2.media).toHaveLength(1);
    expect(it2.media[0].provider).toBe('youtube');
  });

  it('categoria desconhecida vira estudo; público; vídeo inválido some', () => {
    const it2 = fromCoachContent({ id: 'k2', category: 'x', video_url: 'javascript:1', visibility: 'public' });
    expect(it2.kind).toBe('estudo');
    expect(it2.visibility).toBe('publico');
    expect(it2.media).toEqual([]);
  });
});

describe('linkedItemIds', () => {
  it('ids dos blocos, sem repetir nem vazios', () => {
    expect(linkedItemIds({ blocks: [{ item_id: 'a' }, { item_id: null }, { item_id: 'a' }, { item_id: 'b' }] })).toEqual(['a', 'b']);
    expect(linkedItemIds({})).toEqual([]);
  });
});
