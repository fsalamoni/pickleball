import { describe, it, expect } from 'vitest';
import { relatorioDeErro, rotaSemIds } from './errorReport';

describe('rotaSemIds', () => {
  it('troca ids de documento e uids por :id, e deixa as palavras', () => {
    expect(rotaSemIds('/torneios/aB3dE5gH7jK9mN1pQ3sT/gerir')).toBe('/torneios/:id/gerir');
    expect(rotaSemIds('/atletas/Kx7CC0NVgogh8cCF4wIRmpOvo7r2')).toBe('/atletas/:id');
    expect(rotaSemIds('/configuracoes')).toBe('/configuracoes');
  });
});

describe('relatorioDeErro', () => {
  it('monta o corpo com mensagem, pilha, rota sem ids e versão', () => {
    const erro = new TypeError('x is undefined');
    const r = relatorioDeErro(erro, { fonte: 'V2RouteBoundary:arena', rota: '/arenas/aB3dE5gH7jK9mN1pQ3sT', versao: 'abc', uid: 'u1' });
    expect(r).toMatchObject({ mensagem: 'x is undefined', nome: 'TypeError', fonte: 'V2RouteBoundary:arena', fatal: false, rota: '/arenas/:id', versao: 'abc', uid: 'u1' });
    expect(r.pilha).toContain('TypeError');
  });

  it('promessa rejeitada com texto também vira relatório (sem pilha)', () => {
    expect(relatorioDeErro('falhou o envio', { fonte: 'promessa' })).toMatchObject({ mensagem: 'falhou o envio', nome: 'Error', pilha: '' });
  });

  it('⭐ ruído do navegador e de extensões não é enviado', () => {
    expect(relatorioDeErro(new Error('Script error.'))).toBeNull();
    expect(relatorioDeErro(new Error('ResizeObserver loop completed with undelivered notifications.'))).toBeNull();
    const ext = new Error('boom');
    ext.stack = 'Error: boom\n    at x (chrome-extension://abc/content.js:1:1)';
    expect(relatorioDeErro(ext)).toBeNull();
    expect(relatorioDeErro(undefined)).toBeNull();
    expect(relatorioDeErro(new Error(''))).toBeNull();
  });
});
