import { describe, it, expect } from 'vitest';
import {
  adminItemCounts, filterAdminItems, openReportsByItem, reviewQueue, sortAdminItems, sortReports,
} from './adminTrainingView';

const t = (s) => ({ seconds: s });
const itens = [
  { id: 'a', title: 'Dink cruzado', kind: 'drill', author_role: 'plataforma', author_name: 'PickleRush', visibility: 'publico', review: 'aprovado', seed_slug: 'dink-cruzado', featured: true, created_at: t(10) },
  { id: 'b', title: 'Terceira bola', kind: 'jogada', author_role: 'atleta', author_name: 'Bia Souza', visibility: 'publico', review: 'pendente', created_at: t(30) },
  { id: 'c', title: 'Saque profundo', kind: 'fundamento', author_role: 'professor', author_name: 'Beto', visibility: 'publico', review: 'pendente', created_at: t(20), updated_at: t(25) },
  { id: 'd', title: 'Agilidade', kind: 'fisico', author_role: 'atleta', author_name: 'Caio', visibility: 'privado', review: 'nao_se_aplica', hidden: true, ai_assisted: true, created_at: t(5) },
];

describe('filterAdminItems', () => {
  it('busca sem acento no título, autor, id e slug, com todos os termos', () => {
    expect(filterAdminItems(itens, { q: 'souza' }).map((x) => x.id)).toEqual(['b']);
    expect(filterAdminItems(itens, { q: 'DINK-CRUZADO' }).map((x) => x.id)).toEqual(['a']);
    expect(filterAdminItems(itens, { q: 'saque beto' }).map((x) => x.id)).toEqual(['c']);
    expect(filterAdminItems(itens, { q: 'saque bia' })).toEqual([]);
  });

  it('filtra por tipo, papel, visibilidade, revisão e estado', () => {
    expect(filterAdminItems(itens, { role: 'atleta' }).map((x) => x.id)).toEqual(['b', 'd']);
    expect(filterAdminItems(itens, { review: 'pendente', kind: 'fundamento' }).map((x) => x.id)).toEqual(['c']);
    expect(filterAdminItems(itens, { visibility: 'privado' }).map((x) => x.id)).toEqual(['d']);
    expect(filterAdminItems(itens, { estado: 'ocultos' }).map((x) => x.id)).toEqual(['d']);
    expect(filterAdminItems(itens, { estado: 'semente' }).map((x) => x.id)).toEqual(['a']);
    expect(filterAdminItems(itens, { estado: 'ia' }).map((x) => x.id)).toEqual(['d']);
    expect(filterAdminItems(itens, {}).length).toBe(4);
  });
});

it('ordena os itens pelos mais recentes', () => {
  expect(sortAdminItems(itens).map((x) => x.id)).toEqual(['b', 'c', 'a', 'd']);
});

it('a fila de revisão é só dos públicos pendentes, quem espera há mais tempo primeiro', () => {
  expect(reviewQueue(itens).map((x) => x.id)).toEqual(['c', 'b']);
  expect(reviewQueue([{ ...itens[1], legacy: true }])).toEqual([]);
});

it('conta por tipo, papel e estado', () => {
  const c = adminItemCounts(itens);
  expect(c.total).toBe(4);
  expect(c.byKind.drill).toBe(1);
  expect(c.byRole).toEqual({ plataforma: 1, professor: 1, atleta: 2 });
  expect([c.pendentes, c.ocultos, c.destaques, c.semente]).toEqual([2, 1, 1, 1]);
});

it('denúncias: abertas primeiro (mais antigas na frente); decididas, as mais novas', () => {
  const r = [
    { id: '1', status: 'resolvida', created_at: t(1), resolved_at: t(50) },
    { id: '2', status: 'aberta', created_at: t(40), item_id: 'a' },
    { id: '3', status: 'aberta', created_at: t(20), item_id: 'a' },
    { id: '4', status: 'descartada', created_at: t(60) },
    { id: '5', status: 'aberta', created_at: t(30), item_id: 'b' },
  ];
  const { abertas, outras } = sortReports(r);
  expect(abertas.map((x) => x.id)).toEqual(['3', '5', '2']);
  expect(outras.map((x) => x.id)).toEqual(['4', '1']);
  expect(Object.fromEntries(openReportsByItem(r))).toEqual({ a: 2, b: 1 });
});
