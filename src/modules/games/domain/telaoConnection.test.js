import { describe, it, expect } from 'vitest';
import { telaoConnectionState, telaoStaleLabel, TELAO_STALE_MS } from './telaoConnection.js';

const AGORA = 1_700_000_000_000;
const estado = (over = {}) => telaoConnectionState({ now: AGORA, ...over });

describe('🐞 falha de atualização NÃO apaga o telão', () => {
  it('⭐ com dado em mãos, uma falha recente mantém o painel', () => {
    const r = estado({ isError: true, hasData: true, dataUpdatedAt: AGORA - 10_000 });
    expect(r.showBoard).toBe(true);
    expect(r.mode).toBe('ok');
  });

  it('⭐ sem dado nenhum, a tela de erro é legítima', () => {
    const r = estado({ isError: true, hasData: false });
    expect(r.showBoard).toBe(false);
    expect(r.mode).toBe('empty');
  });

  it('⭐ sem erro e sem dado também é vazio — o telão não inventa painel', () => {
    expect(estado({ isError: false, hasData: false }).mode).toBe('empty');
  });

  it('tudo certo: painel, sem aviso', () => {
    const r = estado({ hasData: true, dataUpdatedAt: AGORA - 3_000 });
    expect(r).toMatchObject({ mode: 'ok', showBoard: true, label: null });
  });
});

describe('⭐ o telão diz quando o dado está velho', () => {
  it('falha que JÁ DUROU vira aviso, e o painel continua', () => {
    const r = estado({ isError: true, hasData: true, dataUpdatedAt: AGORA - 5 * 60_000 });
    expect(r.mode).toBe('stale');
    expect(r.showBoard).toBe(true);
    expect(r.label).toBe('Sem conexão — mostrando o estado de há 5 minutos');
  });

  it('⭐ não pisca a cada ciclo: dentro da tolerância não avisa', () => {
    // O telão atualiza a cada 15 s; avisar aos 20 s ensinaria a ignorar o aviso.
    const r = estado({ isError: true, hasData: true, dataUpdatedAt: AGORA - 20_000 });
    expect(r.mode).toBe('ok');
    expect(r.label).toBeNull();
  });

  it('exatamente na tolerância já avisa', () => {
    expect(estado({ isError: true, hasData: true, dataUpdatedAt: AGORA - TELAO_STALE_MS }).mode)
      .toBe('stale');
  });

  it('⭐ dado muito antigo avisa mesmo SEM erro marcado — a aba pode ter ficado suspensa', () => {
    const r = estado({ isError: false, hasData: true, dataUpdatedAt: AGORA - 10 * 60_000 });
    expect(r.mode).toBe('stale');
  });

  it('sem `dataUpdatedAt` não inventa idade', () => {
    const r = estado({ isError: true, hasData: true, dataUpdatedAt: 0 });
    expect(r.staleMs).toBe(0);
    expect(r.mode).toBe('ok');
  });
});

describe('telaoStaleLabel — em português de quadra', () => {
  it('segundos, minutos e horas, com singular certo', () => {
    expect(telaoStaleLabel(1_000)).toBe('há 1 segundo');
    expect(telaoStaleLabel(45_000)).toBe('há 45 segundos');
    expect(telaoStaleLabel(60_000 * 1.6)).toBe('há 1 minuto');
    expect(telaoStaleLabel(60_000 * 7)).toBe('há 7 minutos');
    expect(telaoStaleLabel(3_600_000)).toBe('há 1 hora');
    expect(telaoStaleLabel(3_600_000 * 3)).toBe('há 3 horas');
  });

  it('nunca devolve tempo negativo (relógio do aparelho pode andar para trás)', () => {
    expect(telaoStaleLabel(-5_000)).toBe('há 0 segundos');
  });
});
