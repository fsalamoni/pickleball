import { describe, it, expect } from 'vitest';
import { canNotifyNews, newsSummaryLine, scheduleInputValue, sortNews, validateNewsInput, visibleNews } from './news.js';

describe('validateNewsInput', () => {
  it('exige título e texto; normaliza estado e público', () => {
    const r = validateNewsInput({ title: 'Ab', body: 'curto' });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['body', 'title']);
    const ok = validateNewsInput({ title: 'Assembleia geral', body: 'Dia 20 de novembro, às 19h, na sede.', status: 'published', audience: 'members', pinned: true, link: '/torneios' });
    expect(ok.ok).toBe(true);
    expect(ok.value).toMatchObject({ status: 'published', audience: 'members', pinned: true, link: '/torneios' });
    expect(validateNewsInput({ title: 'Título bom', body: 'Texto suficiente aqui.', status: 'x', audience: 'y' }).value).toMatchObject({ status: 'draft', audience: 'public' });
  });
  it('recusa link e imagem que não são https nem caminho do app', () => {
    const r = validateNewsInput({ title: 'Título bom', body: 'Texto suficiente aqui.', link: 'javascript:alert(1)', image_url: 'http://x/y.png' });
    expect(r.errors).toHaveProperty('link');
    expect(r.errors).toHaveProperty('image_url');
  });
});

describe('notícia agendada', () => {
  const base = { title: 'Assembleia geral', body: 'Convocação para a assembleia.', status: 'scheduled' };
  const NOW = new Date('2026-10-22T10:00').getTime();
  it('exige data e hora no futuro, até um ano; guarda o instante e o aviso', () => {
    expect(validateNewsInput(base, { now: NOW }).errors).toHaveProperty('publish_at');
    expect(validateNewsInput({ ...base, publish_at: '2026-10-22T09:00' }, { now: NOW }).errors).toHaveProperty('publish_at');
    expect(validateNewsInput({ ...base, publish_at: '2028-01-01T09:00' }, { now: NOW }).errors).toHaveProperty('publish_at');
    const r = validateNewsInput({ ...base, publish_at: '2026-10-23T19:30', notify_on_publish: true, published_at: '2026-10-01' }, { now: NOW });
    expect(r.ok).toBe(true);
    expect(r.value).toMatchObject({ status: 'scheduled', publish_at_ms: new Date('2026-10-23T19:30').getTime(), notify_on_publish: true, published_at: '' });
    expect(scheduleInputValue(r.value.publish_at_ms)).toBe('2026-10-23T19:30');
    expect(scheduleInputValue(null)).toBe('');
  });
  it('fora do agendamento, não leva hora nem aviso; agendada não é visível nem avisável', () => {
    const r = validateNewsInput({ ...base, status: 'draft', publish_at: '2026-10-23T19:30', notify_on_publish: true }, { now: NOW });
    expect(r.value).toMatchObject({ publish_at_ms: null, notify_on_publish: false });
    const ag = { ...base, audience: 'public', publish_at_ms: NOW + 3600000, notify_on_publish: true };
    expect(visibleNews([ag])).toEqual([]);
    expect(canNotifyNews(ag)).toBe(false);
    expect(newsSummaryLine(ag)).toMatch(/publica em .+ · avisa os filiados ao publicar/);
  });
});

describe('sortNews / visibleNews', () => {
  const lista = [
    { id: 'a', status: 'published', audience: 'public', published_at: '2026-10-01' },
    { id: 'b', status: 'published', audience: 'members', published_at: '2026-10-10' },
    { id: 'c', status: 'published', audience: 'public', published_at: '2026-09-01', pinned: true },
    { id: 'd', status: 'draft', audience: 'public', published_at: '2026-10-18' },
    { id: 'e', status: 'archived', audience: 'public', published_at: '2026-10-17' },
  ];
  it('fixada primeiro, depois a mais nova', () => {
    expect(sortNews(lista).map((n) => n.id)).toEqual(['c', 'd', 'e', 'b', 'a']);
  });
  it('o público vê só as públicas publicadas; o filiado ativo vê também as "só filiados"', () => {
    expect(visibleNews(lista).map((n) => n.id)).toEqual(['c', 'a']);
    expect(visibleNews(lista, { memberOf: true }).map((n) => n.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('canNotifyNews / newsSummaryLine', () => {
  it('só publicada e ainda não avisada', () => {
    expect(canNotifyNews({ status: 'published' })).toBe(true);
    expect(canNotifyNews({ status: 'published', notified_at: 1 })).toBe(false);
    expect(canNotifyNews({ status: 'draft' })).toBe(false);
  });
  it('a linha diz fixada e quantos receberam', () => {
    expect(newsSummaryLine({ pinned: true, notified_at: 1, notified_count: 12 })).toBe('Fixada · avisada a 12');
    expect(newsSummaryLine({})).toBe('');
  });
});
