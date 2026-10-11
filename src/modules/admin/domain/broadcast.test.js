import { describe, it, expect } from 'vitest';
import { validateBroadcast } from './broadcast.js';

describe('validateBroadcast', () => {
  const ok = { title: 'Manutenção', message: 'A plataforma fica fora do ar hoje às 23h.', link: '/ajuda', recipients: 3 };
  it('aceita o aviso completo', () => { expect(validateBroadcast(ok).isValid).toBe(true); });
  it('recusa público vazio, link externo e textos curtos', () => {
    expect(validateBroadcast({ ...ok, recipients: 0 }).errors.recipients).toBeTruthy();
    expect(validateBroadcast({ ...ok, link: 'https://x.com' }).errors.link).toBeTruthy();
    expect(validateBroadcast({ ...ok, link: '/ajuda#secao' }).errors.link).toBeTruthy();
    expect(validateBroadcast({ ...ok, message: 'curta' }).errors.message).toBeTruthy();
    expect(validateBroadcast({ ...ok, title: '' }).errors.title).toBeTruthy();
  });
});
