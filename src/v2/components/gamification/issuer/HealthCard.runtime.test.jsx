import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import HealthCard from './HealthCard.jsx';
import { computeArenaHealth, arenaSuggestions } from '@/modules/progression/domain/supplyHealth';

let container; let root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (node) => act(async () => { root.render(<MemoryRouter>{node}</MemoryRouter>); });

describe('HealthCard', () => {
  it('mostra o total, a faixa e UMA linha por dimensão, com o número que a motivou', async () => {
    const m = { bookings7: 12, bookingsPrev7: 8, noShowRate: 4, pendingOver24h: 0, rating: 4.7, reviewsCount: 20, repeatRate: 60, eventsLast30: 4 };
    await render(<HealthCard health={computeArenaHealth(m)} suggestions={arenaSuggestions(m)} />);
    expect(container.querySelectorAll('[data-dim]').length).toBe(5);
    expect(container.textContent).toContain('12 reservas esta semana, 8 na anterior');
    expect(container.textContent).toContain('Nota 4.7 em 20 avaliações');
    expect(container.textContent).toMatch(/Excelente|Muito bom/);
  });

  it('o que não dá para medir diz "ainda sem dados" — nunca zero — e a confiança é dita', async () => {
    await render(<HealthCard health={computeArenaHealth({ bookings7: 3, bookingsPrev7: 3 })} />);
    expect(container.textContent).toContain('ainda sem dados');
    expect(container.textContent).toContain('Medido em 1 de 5 dimensões');
    expect(container.textContent).toContain('pouco movimento para medir');
  });

  it('sem nenhuma dimensão medida: o total é "—" e a faixa, "Ainda sem dados"', async () => {
    await render(<HealthCard health={computeArenaHealth({})} />);
    expect(container.querySelector('[data-testid="health-card"]').textContent).toContain('—');
    expect(container.textContent).toContain('Ainda sem dados');
  });

  it('fonte que falhou é avisada (as dimensões dependentes ficaram de fora)', async () => {
    await render(<HealthCard health={computeArenaHealth({ bookings7: 1 })} unknown={['avaliações']} />);
    expect(container.querySelector('[role="alert"]').textContent).toContain('avaliações');
  });

  it('sugestões carregam o número e levam à aba que resolve', async () => {
    const m = { pendingOver24h: 3, eventsLast30: 0 };
    await render(<HealthCard health={computeArenaHealth(m)} suggestions={arenaSuggestions(m)} basePath="/arenas/a1/gerir" />);
    expect(container.textContent).toContain('3 pedidos de reserva estão sem resposta');
    const links = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('/arenas/a1/gerir?aba=reservas');
  });
});
