import { describe, it, expect } from 'vitest';
import { buildInbox, inboxBadges, inboxTotals } from './adminInbox.js';

describe('buildInbox', () => {
  it('fonte que não carregou é desconhecida, nunca zero', () => {
    const r = buildInbox({ revisao: { ok: false }, denuncias: { ok: true, count: 0 } });
    expect(r.find((i) => i.id === 'revisao')).toMatchObject({ count: null, atencao: false });
    expect(r.find((i) => i.id === 'denuncias')).toMatchObject({ count: 0, atencao: false, detalhe: 'Nada para decidir' });
    expect(r.find((i) => i.id === 'sinais').count).toBeNull();
  });
  it('conta acima de zero pede atenção e fala no singular/plural', () => {
    const r = buildInbox({ revisao: { ok: true, count: 1 }, sinais: { ok: true, count: 3 } });
    expect(r.find((i) => i.id === 'revisao')).toMatchObject({ atencao: true, detalhe: '1 item' });
    expect(r.find((i) => i.id === 'sinais').detalhe).toBe('3 sinais');
  });
});

describe('inboxBadges / inboxTotals', () => {
  const itens = buildInbox({
    revisao: { ok: true, count: 2 }, denuncias: { ok: true, count: 0 },
    sinais: { ok: true, count: 1 }, cartas: { ok: true, count: 4 }, ranking: { ok: false },
  });
  it('soma por aba e ignora zero e desconhecido', () => {
    expect(inboxBadges(itens)).toEqual({ 'treino-revisao': 2, 'gam-integrity': 5 });
  });
  it('total e aviso de leitura incompleta', () => {
    expect(inboxTotals(itens)).toEqual({ total: 7, incompleto: true });
  });
});

describe('buildInbox — lojas do Mercado', () => {
  it('sem a fonte, a linha não aparece; com ela, conta', () => {
    expect(buildInbox({}).some((i) => i.id === 'lojas')).toBe(false);
    const l = buildInbox({ lojas: { ok: true, count: 2 } }).find((i) => i.id === 'lojas');
    expect(l).toMatchObject({ tab: 'mercado-lojas', count: 2, atencao: true });
  });
});
