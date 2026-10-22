import { describe, it, expect } from 'vitest';
import { bankImportPayload, decodeBankFile, parseBankCsv, parseBankDate, parseBankStatement, parseOfx, parseSignedCents, reviewBankRows } from './bankStatement.js';

const OFX = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><ACCTID>12345-6</BANKACCTFROM>
<BANKTRANLIST>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260402120000[-3:BRT]<TRNAMT>5000.00<FITID>A1<NAME>LOJA X<MEMO>PIX RECEBIDO PATROCINIO</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260403<TRNAMT>-39.90<FITID>A2<MEMO>TARIFA</STMTTRN>
<STMTTRN><TRNTYPE>OTHER<DTPOSTED>20260403<TRNAMT>0.00<FITID>A3<MEMO>SALDO DO DIA</STMTTRN>
<STMTTRN><DTPOSTED>xx<TRNAMT>1</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe('extrato bancário: valores e datas', () => {
  it('entende o valor com sinal nos jeitos que os bancos escrevem', () => {
    expect(parseSignedCents('-1.234,56')).toBe(-123456);
    expect(parseSignedCents('1.234,56')).toBe(123456);
    expect(parseSignedCents('(150,00)')).toBe(-15000);
    expect(parseSignedCents('150,00 D')).toBe(-15000);
    expect(parseSignedCents('150,00 C')).toBe(15000);
    expect(parseSignedCents('R$ 9,90')).toBe(990);
    expect(parseSignedCents('-150.00')).toBe(-15000);
    expect(parseSignedCents('150,00-')).toBe(-15000);
    expect(parseSignedCents('+20')).toBe(2000);
    expect(parseSignedCents('abc')).toBeNaN();
    expect(parseSignedCents('')).toBeNaN();
  });

  it('entende as datas do OFX e das planilhas, e recusa a que não existe', () => {
    expect(parseBankDate('20260402120000[-3:BRT]')).toBe('2026-04-02');
    expect(parseBankDate('02/04/2026')).toBe('2026-04-02');
    expect(parseBankDate('2/4/26')).toBe('2026-04-02');
    expect(parseBankDate('02-04-2026')).toBe('2026-04-02');
    expect(parseBankDate('2026-04-02')).toBe('2026-04-02');
    expect(parseBankDate('31/02/2026')).toBe('');
  });
});

describe('extrato bancário: OFX', () => {
  it('um movimento por STMTTRN, crédito = receita, débito = despesa, saldo e valor zero fora', () => {
    const r = parseOfx(OFX);
    expect(r.skipped).toBe(1);
    expect(r.errors).toHaveLength(1);
    expect(r.rows).toEqual([
      { line: 1, kind: 'income', category: 'other_income', date: '2026-04-02', amount_cents: 500000, description: 'PIX RECEBIDO PATROCINIO', counterparty: 'LOJA X', bank_ref: 'ofx:12345-6:A1' },
      { line: 2, kind: 'expense', category: 'other_expense', date: '2026-04-03', amount_cents: 3990, description: 'TARIFA', counterparty: '', bank_ref: 'ofx:12345-6:A2' },
    ]);
    expect(parseBankStatement(OFX).rows).toHaveLength(2);
  });

  it('arquivo sem movimento diz isso', () => {
    expect(parseOfx('<OFX></OFX>').errors).toHaveLength(1);
  });
});

describe('extrato bancário: planilha', () => {
  it('acha o cabeçalho depois das linhas da conta, coluna de valor com sinal, saldo fora, repetição vira outro movimento', () => {
    const csv = [
      'Extrato conta corrente;Agência 1;Conta 2',
      '',
      'Data;Histórico;Documento;Valor',
      '01/04/2026;SALDO ANTERIOR;;1.000,00',
      '02/04/2026;PIX RECEBIDO;123;5.000,00',
      '03/04/2026;TARIFA;;-39,90',
      '03/04/2026;TARIFA;;-39,90',
      '04/04/2026;OK;;abc',
    ].join('\n');
    const r = parseBankCsv(csv);
    expect(r.skipped).toBe(1);
    expect(r.errors).toEqual(['Linha 8: data ou valor não entendidos.']);
    expect(r.rows.map((x) => [x.line, x.kind, x.amount_cents, x.bank_ref])).toEqual([
      [5, 'income', 500000, 'csv:doc:123|2026-04-02|500000'],
      [6, 'expense', 3990, 'csv:2026-04-03|-3990|tarifa|1'],
      [7, 'expense', 3990, 'csv:2026-04-03|-3990|tarifa|2'],
    ]);
  });

  it('colunas separadas de crédito e débito, vírgula como separador, descrição curta ganha texto', () => {
    const csv = 'data,descricao,credito,debito,favorecido\n2026-04-05,"Aluguel, sede",,"1.500,00",Imobiliária\n2026-04-06,TX,200,,';
    const r = parseBankCsv(csv);
    expect(r.rows).toMatchObject([
      { kind: 'expense', amount_cents: 150000, description: 'Aluguel, sede', counterparty: 'Imobiliária' },
      { kind: 'income', amount_cents: 20000, description: 'Movimento do extrato' },
    ]);
  });

  it('arquivo em Windows-1252 (o comum dos bancos) não vira texto quebrado', () => {
    const latin = new Uint8Array([0x48, 0x69, 0x73, 0x74, 0xf3, 0x72, 0x69, 0x63, 0x6f]); // "Histórico"
    expect(decodeBankFile(latin)).toBe('Histórico');
    expect(decodeBankFile(new TextEncoder().encode('Crédito'))).toBe('Crédito');
  });

  it('sem data e valor no cabeçalho, explica o que falta', () => {
    expect(parseBankCsv('nome;email\nAna;a@b.c').errors[0]).toMatch(/cabeçalho/);
  });
});

describe('extrato bancário: conferência e envio', () => {
  const rows = parseOfx(OFX).rows;

  it('marca o já lançado, o período fechado e o futuro; só o pronto vem marcado', () => {
    const futuro = { ...rows[1], bank_ref: 'ofx:x:F', date: '2027-01-01' };
    const r = reviewBankRows([...rows, futuro], {
      ledger: [{ bank_ref: 'ofx:12345-6:A1' }, { id: 'manual' }],
      hoje: '2026-12-01',
      closedPeriod: (d) => (d === '2026-04-03' ? '2026-Q2' : null),
    });
    expect(r.map((x) => [x.problem, x.selected])).toEqual([['duplicate', false], ['closed', false], ['invalid', false]]);
    expect(reviewBankRows(rows, { hoje: '2026-12-01' }).every((x) => x.selected)).toBe(true);
  });

  it('o mesmo movimento duas vezes no arquivo: vale o primeiro', () => {
    const r = reviewBankRows([rows[0], { ...rows[0] }], { hoje: '2026-12-01' });
    expect(r.map((x) => x.problem)).toEqual(['', 'duplicate']);
  });

  it('o envio leva só os marcados, nos campos do lançamento', () => {
    const r = reviewBankRows(rows, { hoje: '2026-12-01' });
    r[1].selected = false;
    expect(bankImportPayload(r)).toEqual([
      { kind: 'income', category: 'other_income', date: '2026-04-02', amount_cents: 500000, description: 'PIX RECEBIDO PATROCINIO', counterparty: 'LOJA X', bank_ref: 'ofx:12345-6:A1' },
    ]);
  });
});
