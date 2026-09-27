/**
 * O cupom no PEDIDO DE AULA (Onda CG, revisão).
 *
 * O que protege:
 *  1. ⭐ os cupons do professor aparecem para TOCAR — só os de aula, no ar,
 *     visíveis a esta pessoa e ainda não usados por ela;
 *  2. ⭐ o valor com o desconto é estimado ("de R$ 100 por R$ 90");
 *  3. ⭐ "só para os meus alunos": quem SABIDAMENTE não é aluno é recusado com
 *     o motivo; enquanto não se sabe, não recusa (a confirmação confere);
 *  4. ⭐ o uso que voltou (aula desfeita) não vira "você já usou".
 */
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const estado = { publicos: [], alunoDe: [], carregando: false, minhasAulas: [], banco: {} };
const q = (v) => ({ data: v, isLoading: false, isError: false, isSuccess: true, refetch: vi.fn() });

vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'ana' } }) }));
vi.mock('@/modules/promo/hooks/usePromo', () => ({
  useCoachPublicPromos: () => q({ coupons: estado.publicos, campaigns: [] }),
  usePromoViewer: () => ({
    uid: 'ana', coachIdsDoAluno: new Set(estado.alunoDe), falhou: false, carregando: estado.carregando, recarregar: vi.fn(),
  }),
}));
vi.mock('@/modules/promo/services/promoService', () => ({
  findCoachCouponByCode: vi.fn(async (_coach, code) => estado.banco[code] || null),
}));
vi.mock('@/modules/coaches/hooks/useLessons', () => ({ useStudentLessons: () => q(estado.minhasAulas) }));

const { default: LessonCouponField } = await import('./LessonCouponField.jsx');

const cupom = (code, over = {}) => ({
  id: code.toLowerCase(), code, issuer_type: 'coach', issuer_id: 'prof', type: 'percent', value: 10,
  active: true, show_public: true, used_count: 0, used_by: [], ...over,
});
const slot = { date: '2026-10-07', start: '18:00', end: '19:00' };

function Harness({ initialCode = '' }) {
  const [valor, setValor] = useState(null);
  return (
    <>
      <LessonCouponField coachId="prof" hourlyRate={100} slot={slot} value={valor} onChange={setValor} initialCode={initialCode} />
      <output data-pedido>{valor ? `${valor.code}:${valor.status}` : ''}</output>
    </>
  );
}

let container, root;
beforeEach(() => {
  estado.publicos = [];
  estado.alunoDe = [];
  estado.carregando = false;
  estado.minhasAulas = [];
  estado.banco = {};
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = async (el) => { await act(async () => { root.render(el); }); };
const botao = (t) => [...container.querySelectorAll('button')].find((b) => b.textContent.includes(t));
const texto = () => container.textContent;
const pedido = () => container.querySelector('[data-pedido]').textContent;
const digitar = async (valor) => {
  const input = container.querySelector('#aula-cupom');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => {
    setter.call(input, valor);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { botao('Aplicar').click(); });
};

describe('⭐ cupons para tocar', () => {
  it('só os de aula, visíveis a esta pessoa e não usados por ela', async () => {
    estado.publicos = [
      cupom('AULA10'),
      cupom('CLINICA', { kind: 'clinic', benefit: 'Clínica grátis' }),
      cupom('ALUNOS', { visibility: 'alunos', value: 20 }),
      cupom('USADO', { used_by: ['ana'], value: 30 }),
    ];
    await render(<Harness />);
    const chips = [...container.querySelectorAll('button')].map((b) => b.textContent);
    expect(chips.some((t) => t.includes('10%'))).toBe(true);
    expect(chips.some((t) => t.includes('Clínica'))).toBe(false);
    expect(chips.some((t) => t.includes('20%'))).toBe(false);
    expect(chips.some((t) => t.includes('30%'))).toBe(false);
  });

  it('⭐ tocar confere, põe o cupom PENDENTE no pedido e estima o valor', async () => {
    estado.publicos = [cupom('AULA10')];
    estado.banco = { AULA10: cupom('AULA10') };
    await render(<Harness />);
    await act(async () => { botao('10%').click(); });
    expect(pedido()).toBe('AULA10:pending');
    expect(texto()).toMatch(/estimativa: R\$\s100,00 por R\$\s90,00/);
    expect(texto()).toContain('Entra quando o professor confirmar');
    // Com o cupom escolhido, as sugestões saem da frente.
    expect(botao('10%')).toBeUndefined();
  });
});

describe('⭐ só para os meus alunos', () => {
  it('quem não é aluno: recusado com o motivo', async () => {
    estado.banco = { ALUNOS: cupom('ALUNOS', { visibility: 'alunos' }) };
    await render(<Harness />);
    await digitar('ALUNOS');
    expect(texto()).toContain('só para quem já é aluno');
    expect(pedido()).toBe('');
  });

  it('o aluno: aceito', async () => {
    estado.alunoDe = ['prof'];
    estado.banco = { ALUNOS: cupom('ALUNOS', { visibility: 'alunos' }) };
    await render(<Harness />);
    await digitar('ALUNOS');
    expect(pedido()).toBe('ALUNOS:pending');
  });

  it('ainda sem saber se é aluno: não recusa (a confirmação confere)', async () => {
    estado.carregando = true;
    estado.banco = { ALUNOS: cupom('ALUNOS', { visibility: 'alunos' }) };
    await render(<Harness />);
    await digitar('ALUNOS');
    expect(pedido()).toBe('ALUNOS:pending');
  });
});

describe('⭐ o uso que voltou', () => {
  it('aula desfeita com o cupom contado: não diz "você já usou"', async () => {
    estado.banco = { AULA10: cupom('AULA10', { used_by: ['ana'] }) };
    estado.minhasAulas = [{ id: 'l1', status: 'cancelled', coupon: { coupon_id: 'aula10', code: 'AULA10', status: 'applied' } }];
    await render(<Harness />);
    await digitar('AULA10');
    expect(texto()).not.toContain('já usou');
    expect(pedido()).toBe('AULA10:pending');
  });

  it('usado numa aula que aconteceu: "você já usou"', async () => {
    estado.banco = { AULA10: cupom('AULA10', { used_by: ['ana'] }) };
    estado.minhasAulas = [{ id: 'l1', status: 'completed', coupon: { coupon_id: 'aula10', code: 'AULA10', status: 'applied' } }];
    await render(<Harness />);
    await digitar('AULA10');
    expect(texto()).toContain('Você já usou este cupom.');
    expect(pedido()).toBe('');
  });

  it('veio de "Usar ao pedir a aula": confere sozinho', async () => {
    estado.banco = { AULA10: cupom('AULA10') };
    await render(<Harness initialCode="AULA10" />);
    expect(pedido()).toBe('AULA10:pending');
  });
});
