import { describe, it, expect } from 'vitest';
import { csvField, csvRow, buildRegistrationsCsv, registrationsCsvFilename } from './registrations_csv.js';

describe('csvField', () => {
  it('não escapa texto simples', () => {
    expect(csvField('João')).toBe('João');
  });
  it('escapa quando há separador, aspas ou quebra', () => {
    expect(csvField('a;b')).toBe('"a;b"');
    expect(csvField('diz "oi"')).toBe('"diz ""oi"""');
    expect(csvField('l1\nl2')).toBe('"l1\nl2"');
  });
  it('trata null como vazio', () => {
    expect(csvField(null)).toBe('');
  });
});

describe('csvRow', () => {
  it('junta campos com ponto-e-vírgula', () => {
    expect(csvRow(['a', 'b', 'c'])).toBe('a;b;c');
  });
});

describe('buildRegistrationsCsv', () => {
  const modalities = [{ id: 'm1', name: 'Duplas Masculino' }];
  const regs = [
    {
      modality_id: 'm1', label: 'Ana / Bia',
      player_a_name: 'Ana', player_a_email: 'ana@x.com', player_a_level: '3.5',
      player_b_name: 'Bia', player_b_email: 'bia@x.com', player_b_level: '3.0',
      status: 'confirmed', is_provisional: false, payment_status: 'paid',
    },
  ];
  const statusLabels = { confirmed: 'Confirmada' };
  const paymentLabels = { paid: 'Pago' };

  it('inclui BOM e cabeçalho', () => {
    const csv = buildRegistrationsCsv(regs, { modalities, statusLabels, paymentLabels });
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv).toContain('Modalidade;Inscrição;Jogador A');
  });

  it('mapeia modalidade, status e pagamento por rótulo', () => {
    const csv = buildRegistrationsCsv(regs, { modalities, statusLabels, paymentLabels });
    const lines = csv.replace(/^﻿/, '').split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Duplas Masculino');
    expect(lines[1]).toContain('Ana / Bia');
    expect(lines[1]).toContain('Confirmada');
    expect(lines[1]).toContain('Pago');
  });

  it('marca provisória e lida com campos ausentes', () => {
    const csv = buildRegistrationsCsv([
      { modality_id: 'm1', player_a_name: 'Caio', status: 'waitlist', is_provisional: true },
    ], { modalities, statusLabels: { waitlist: 'Lista de espera' } });
    const line = csv.replace(/^﻿/, '').split('\r\n')[1];
    expect(line).toContain('Caio');
    expect(line).toContain('Lista de espera');
    expect(line.endsWith('Sim;')).toBe(true); // provisória=Sim, pagamento vazio
  });

  it('lista vazia gera só o cabeçalho', () => {
    const csv = buildRegistrationsCsv([], { modalities });
    expect(csv.replace(/^﻿/, '').split('\r\n')).toHaveLength(1);
  });
});

describe('registrationsCsvFilename', () => {
  it('normaliza o nome do torneio', () => {
    expect(registrationsCsvFilename('Copa de Verão 2026')).toBe('inscricoes-copa-de-verao-2026.csv');
  });
  it('cai em torneio quando vazio', () => {
    expect(registrationsCsvFilename('')).toBe('inscricoes-torneio.csv');
  });
});
