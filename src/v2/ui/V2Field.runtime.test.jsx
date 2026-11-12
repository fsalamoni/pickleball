/**
 * `V2Field`: a mensagem de erro tem id e o campo é ligado a ela
 * (`aria-describedby`), sem mudar nada para quem não passa `htmlFor` nem erro.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { V2Field } from './primitives.jsx';

describe('V2Field', () => {
  it('com erro, liga o campo de id igual ao htmlFor à mensagem', () => {
    const html = renderToStaticMarkup(<V2Field label="Nome" htmlFor="nome" error="Diga o nome"><input id="nome" /></V2Field>);
    expect(html).toContain('<p id="nome-erro"');
    expect(html).toContain('aria-describedby="nome-erro"');
    expect(html).toContain('aria-invalid="true"');
  });
  it('sem erro, ou com outro filho, não toca no campo', () => {
    expect(renderToStaticMarkup(<V2Field label="Nome" htmlFor="nome" hint="Dica"><input id="nome" /></V2Field>)).not.toContain('aria-');
    const html = renderToStaticMarkup(<V2Field htmlFor="nome" error="Erro"><input id="outro" aria-describedby="x" /></V2Field>);
    expect(html).toContain('aria-describedby="x"');
    expect(html).not.toContain('aria-invalid');
  });
});
