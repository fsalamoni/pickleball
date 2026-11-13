import { describe, it, expect } from 'vitest';
import { describeFunctionsHealth, CONFERENCIA_VELHA_MS } from './functionsHealth';

const AGORA = Date.UTC(2026, 9, 23, 15, 0, 0);
const ts = (ms) => ({ toMillis: () => ms });

describe('describeFunctionsHealth', () => {
  it('sem documento não afirma nada', () => {
    expect(describeFunctionsHealth(null, AGORA)).toEqual({ estado: 'sem_registro', conferencia: null, deploy: null });
  });

  it('tudo publicado e conferido há pouco está ok', () => {
    const r = describeFunctionsHealth({
      check: { at: ts(AGORA - 10 * 60 * 1000), expected: 91, published: 91, missing: [], unlabeled: [] },
      deploy: { at: ts(AGORA - 3600e3), ok: true, last_ok_at: ts(AGORA - 3600e3), commit: 'abc' },
    }, AGORA);
    expect(r.estado).toBe('ok');
    expect(r.conferencia).toMatchObject({ esperadas: 91, publicadas: 91, faltando: [], velha: false });
    expect(r.deploy).toMatchObject({ ok: true, erro: null, commit: 'abc' });
  });

  it('função faltando pede atenção', () => {
    const r = describeFunctionsHealth({ check: { at: ts(AGORA), expected: 91, published: 90, missing: ['federationNational'] } }, AGORA);
    expect(r.estado).toBe('atencao');
    expect(r.conferencia.faltando).toEqual(['federationNational']);
  });

  it('o último deploy que falhou pede atenção e guarda quando deu certo antes', () => {
    const r = describeFunctionsHealth({
      check: { at: ts(AGORA), expected: 91, published: 91 },
      deploy: { at: ts(AGORA), ok: false, error: 'Error: Changing from an HTTPS function', last_ok_at: ts(AGORA - 86400e3) },
    }, AGORA);
    expect(r.estado).toBe('atencao');
    expect(r.deploy).toMatchObject({ ok: false, erro: 'Error: Changing from an HTTPS function', ultimoOkMs: AGORA - 86400e3 });
  });

  it('deploy que saiu em parte diz quais funções ficaram, e o erro vem sem os códigos de cor', () => {
    const r = describeFunctionsHealth({
      deploy: { at: ts(AGORA), ok: false, error: '\u001b[33m⚠  functions:\u001b[39m Request to x had HTTP Error: 429', failed: ['tournamentScheduleWorker', 7] },
    }, AGORA);
    expect(r.estado).toBe('atencao');
    expect(r.deploy.falhas).toEqual(['tournamentScheduleWorker']);
    expect(r.deploy.erro).toBe('⚠  functions: Request to x had HTTP Error: 429');
    // Registro antigo (sem `failed`) e deploy bom: lista vazia.
    expect(describeFunctionsHealth({ deploy: { at: ts(AGORA), ok: false, error: 'x' } }, AGORA).deploy.falhas).toEqual([]);
    expect(describeFunctionsHealth({ deploy: { at: ts(AGORA), ok: true, failed: ['a'] } }, AGORA).deploy.falhas).toEqual([]);
  });

  it('função antiga que sobra no ar é dita, sem virar alarme', () => {
    const r = describeFunctionsHealth({ check: { at: ts(AGORA), expected: 131, published: 131, extra: ['velhaUm', 'velhaDois'] } }, AGORA);
    expect(r.conferencia.sobrando).toEqual(['velhaUm', 'velhaDois']);
    expect(r.estado).toBe('ok');
    expect(describeFunctionsHealth({ check: { at: ts(AGORA), expected: 1, published: 1 } }, AGORA).conferencia.sobrando).toEqual([]);
  });

  it('conferência velha quer dizer que a vigilância parou', () => {
    const r = describeFunctionsHealth({ check: { at: ts(AGORA - CONFERENCIA_VELHA_MS - 1), expected: 1, published: 1 } }, AGORA);
    expect(r.conferencia.velha).toBe(true);
    expect(r.estado).toBe('atencao');
  });

  it('lista que não é de textos vira vazia', () => {
    const r = describeFunctionsHealth({ check: { at: AGORA, missing: 'x', unlabeled: [1, 'a'] } }, AGORA);
    expect(r.conferencia.faltando).toEqual([]);
    expect(r.conferencia.semRotulo).toEqual(['a']);
  });
});
