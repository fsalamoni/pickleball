/**
 * A camada da vitrine: explica por que o plano em andamento ainda não abre, e
 * não diz "Só você vê" do torneio que foi mandado ao professor.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/core/lib/FirebaseAuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' }, userProfile: { birth_date: '1990-01-01' } }) }));
vi.mock('@/modules/career/hooks/useCareer', () => ({
  useCareerPublic: () => ({ isSuccess: true, isPending: false, isError: false, data: [] }),
  useCareerPartnerAction: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

import CareerShowcaseLayer from './CareerShowcaseLayer';

let raiz;
const montar = (event, dirty = false) => {
  const el = document.createElement('div');
  document.body.appendChild(el);
  raiz = createRoot(el);
  act(() => { raiz.render(<CareerShowcaseLayer event={event} saved dirty={dirty} />); });
  return el;
};
afterEach(() => { act(() => raiz?.unmount()); document.body.innerHTML = ''; });

const jogado = { id: 'u1_a', status: 'played', start_date: '2025-05-10', entries: [{ format: 'doubles', placement: 'champion' }], photos: [] };

describe('CareerShowcaseLayer', () => {
  it('plano em andamento (já começou, sem resultado salvo): diz o que falta', () => {
    const el = montar({ ...jogado, status: 'planned', start_date: '2020-01-01' });
    expect(el.textContent).toContain('ainda está em andamento');
  });

  it('🔴 mandado ao professor: o selo não diz "Só você vê"', () => {
    expect(montar(jogado).textContent).toContain('Só você vê');
    act(() => raiz.unmount());
    const el = montar({ ...jogado, shared_coach_id: 'prof1' });
    expect(el.textContent).toContain('Só você e o seu professor veem');
  });

  it('com alteração não salva o botão de publicar fica travado e a tela diz por quê', () => {
    const el = montar(jogado, true);
    expect([...el.querySelectorAll('button')].find((b) => b.textContent.includes('Mostrar no meu perfil público')).disabled).toBe(true);
    expect(el.textContent).toContain('Salve a ficha antes');
  });
});
