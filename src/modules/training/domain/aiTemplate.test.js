import { describe, it, expect } from 'vitest';
import {
  AI_EXAMPLE, buildAiPrompt, cueWarnings, itemJsonTemplate, MAX_IMPORT_ITEMS, parseItemsJson, positioningWarnings,
} from './aiTemplate.js';
import { normalizeItemInput } from './trainingItem.js';

describe('aiTemplate', () => {
  it('o exemplo do pedido passa na validação e não gera aviso', () => {
    const r = normalizeItemInput(AI_EXAMPLE);
    expect(r.valid).toBe(true);
    expect(r.value.practice_mode).toBe('bloco');
    expect(cueWarnings(AI_EXAMPLE.cues)).toEqual([]);
  });

  it('o pedido leva o tipo, o modelo, o exemplo e os dados da pessoa', () => {
    const p = buildAiPrompt({ kind: 'fisico', skills: ['physical.agilidade'], level: 3.5, players: 1, minutes: 20, notes: 'joelho sensível' });
    expect(p).toMatch(/"fisico"/);
    expect(p).toMatch(/"sets"/);
    expect(p).toMatch(/nível 3,5/);
    expect(p).toMatch(/20 minutos/);
    expect(p).toMatch(/Observações: joelho sensível/);
    expect(p).toMatch(/PROIBIDO/);
    expect(p).not.toMatch(/\n\n\n/);
  });

  it('o modelo de cada tipo só traz os campos do tipo', () => {
    expect(itemJsonTemplate('estudo')).toHaveProperty('rules_edition');
    expect(itemJsonTemplate('estudo')).not.toHaveProperty('steps');
    expect(itemJsonTemplate('treino').blocks).toHaveLength(1);
    expect(itemJsonTemplate('qualquer').kind).toBe('drill');
  });

  it('lê JSON com cerca de código e texto em volta', () => {
    const r = parseItemsJson(`Aqui está:\n\`\`\`json\n${JSON.stringify(AI_EXAMPLE)}\n\`\`\`\nBom treino!`);
    expect(r.ok).toBe(true);
    expect(r.items).toHaveLength(1);
    expect(r.items[0].valid).toBe(true);
  });

  it('lê lista e { items }', () => {
    expect(parseItemsJson(JSON.stringify([AI_EXAMPLE, AI_EXAMPLE])).items).toHaveLength(2);
    expect(parseItemsJson(JSON.stringify({ items: [AI_EXAMPLE] })).items).toHaveLength(1);
  });

  it('da IA, descarta mídia e link inventados', () => {
    const inventado = { ...AI_EXAMPLE, media: [{ type: 'video', source: 'url', url: 'https://www.youtube.com/watch?v=abcdefghijk' }], link: 'https://exemplo.com' };
    const r = parseItemsJson(JSON.stringify(inventado), { fromAi: true });
    expect(r.items[0].value.media).toEqual([]);
    expect(r.items[0].value.link).toBe('');
    // na importação do admin, a mídia fica
    expect(parseItemsJson(JSON.stringify(inventado)).items[0].value.media).toHaveLength(1);
  });

  it('JSON quebrado, vazio ou grande demais vira erro legível', () => {
    expect(parseItemsJson('{ quebrado').ok).toBe(false);
    expect(parseItemsJson('[]').error).toMatch(/nenhum item/);
    expect(parseItemsJson(JSON.stringify(Array.from({ length: MAX_IMPORT_ITEMS + 1 }, () => AI_EXAMPLE))).error).toMatch(/no máximo/);
  });

  it('item inválido vem com os erros por campo', () => {
    const r = parseItemsJson(JSON.stringify({ kind: 'drill', title: 'x' }));
    expect(r.items[0].valid).toBe(false);
    expect(r.items[0].errors.title).toBeTruthy();
  });

  it('avisa dica longa, dica sobre o corpo e dica negativa', () => {
    const w = cueWarnings(['Gire o punho para fechar a face da raquete agora mesmo', 'Não deixe a bola subir']);
    expect(w.some((x) => /palavras/.test(x))).toBe(true);
    expect(w.some((x) => /punho/.test(x))).toBe(true);
    expect(w.some((x) => /negação/.test(x))).toBe(true);
  });

  it('avisa "errado" sem o "certo" ao lado', () => {
    expect(positioningWarnings([{ type: 'errado', text: 'x' }])).toHaveLength(1);
    expect(positioningWarnings([{ type: 'certo', text: 'x' }, { type: 'errado', text: 'y' }])).toHaveLength(0);
  });
});
