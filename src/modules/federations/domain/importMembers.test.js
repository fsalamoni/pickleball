import { describe, it, expect } from 'vitest';
import { parseMembersCsv, splitCsvLine, toISODateLoose } from './importMembers.js';

describe('CSV', () => {
  it('separa respeitando aspas', () => {
    expect(splitCsvLine('"Silva, Ana";ana@x.com;"12""3"', ';')).toEqual(['Silva, Ana', 'ana@x.com', '12"3']);
  });
  it('datas BR e ISO', () => {
    expect(toISODateLoose('31/12/2026')).toBe('2026-12-31');
    expect(toISODateLoose('2026-12-31')).toBe('2026-12-31');
    expect(toISODateLoose('dez/26')).toBe('');
  });
  it('lê o arquivo com cabeçalho em português, reporta linha ruim e repetida', () => {
    const r = parseMembersCsv('﻿Nome;E-mail;Número;Validade\nAna;ANA@x.com;FGP-001;31/12/2026\nBia;bia-sem-email;;\nAna 2;ana@x.com;;\nCaio;caio@x.com;;abc');
    expect(r.rows).toEqual([
      { line: 2, name: 'Ana', email: 'ana@x.com', member_number: 'FGP-001', valid_until: '2026-12-31' },
      { line: 5, name: 'Caio', email: 'caio@x.com', member_number: '', valid_until: '' },
    ]);
    expect(r.errors.length).toBe(3);
  });
  it('sem cabeçalho certo não lê nada', () => {
    expect(parseMembersCsv('a,b\n1,2').errors.length).toBe(1);
    expect(parseMembersCsv('').errors.length).toBe(1);
  });
});
