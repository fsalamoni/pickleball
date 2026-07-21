import { describe, it, expect } from 'vitest';
import {
  DEVICE_KIND, normalizeDeviceInput, calculateDynamicPrice,
  aggregateNetworkStats, forecastDemand,
} from './arenaV3Advanced.js';

describe('normalizeDeviceInput', () => {
  it('aceita device válido', () => {
    const r = normalizeDeviceInput({ name: 'Sensor 1', kind: 'lighting' });
    expect(r.valid).toBe(true);
    expect(r.value.kind).toBe('lighting');
  });
  it('rejeita sem nome', () => {
    expect(normalizeDeviceInput({}).valid).toBe(false);
  });
  it('default qr_kiosk', () => {
    const r = normalizeDeviceInput({ name: 'X' });
    expect(r.value.kind).toBe('qr_kiosk');
  });
});

describe('calculateDynamicPrice', () => {
  it('preço base sem modificadores', () => {
    expect(calculateDynamicPrice({ basePrice: 100, hour: 12, isWeekend: false, occupancyPct: 20 })).toBe(100);
  });
  it('horário de pico +30%', () => {
    expect(calculateDynamicPrice({ basePrice: 100, hour: 19, isWeekend: false, occupancyPct: 20 })).toBe(130);
  });
  it('fim de semana +20%', () => {
    expect(calculateDynamicPrice({ basePrice: 100, hour: 12, isWeekend: true, occupancyPct: 20 })).toBe(120);
  });
  it('alta ocupação +25%', () => {
    expect(calculateDynamicPrice({ basePrice: 100, hour: 12, isWeekend: false, occupancyPct: 90 })).toBe(125);
  });
  it('combinado: pico + fds + alta ocupação = 100 * 1.75 = 175', () => {
    expect(calculateDynamicPrice({ basePrice: 100, hour: 19, isWeekend: true, occupancyPct: 90 })).toBe(175);
  });
});

describe('aggregateNetworkStats', () => {
  it('agrega stats', () => {
    const r = aggregateNetworkStats([
      { revenue: 1000, bookings_count: 50, occupancy_pct: 70 },
      { revenue: 2000, bookings_count: 30, occupancy_pct: 80 },
    ]);
    expect(r.total).toBe(2);
    expect(r.totalRevenue).toBe(3000);
    expect(r.totalBookings).toBe(80);
    expect(r.avgOccupancy).toBe(75);
  });
  it('zeros para vazio', () => {
    expect(aggregateNetworkStats([])).toEqual({ total: 0, totalRevenue: 0, totalBookings: 0, avgOccupancy: 0 });
  });
});

describe('forecastDemand', () => {
  it('previsão básica', () => {
    const hist = [10, 20, 30];
    // Pesos: 1, 2, 3 → soma=6, weighted=10+40+90=140, avg=140/6=23.33
    // daysAhead=7: 23.33 * 7 = 163
    expect(forecastDemand(hist, 7)).toBe(163);
  });
  it('0 para vazio', () => {
    expect(forecastDemand([])).toBe(0);
  });
});
