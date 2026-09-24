/**
 * Guarda: o deploy das Cloud Functions só mexe nas funções DESTE repositório.
 *
 * O incidente (2026-09-24): o projeto Firebase é compartilhado com outro
 * aplicativo, e os dois usavam o codebase "default". O passo de deploy rodava
 * `firebase deploy --only functions --force`, que trata toda função do
 * projeto ausente do código daqui como "removida" — e a apaga. Um deploy do
 * PickleRush apagou ~40 funções do outro app; dias antes, o deploy do outro
 * app tinha apagado todas as funções do PickleRush (ranking automático, push,
 * fila de espera ficaram fora do ar sem ninguém perceber).
 *
 * O conserto é publicar por NOME (`--only functions:a,functions:b`). Este
 * teste lê o workflow e o código e reprova quem voltar ao deploy amplo.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

const WORKFLOW = readFileSync('.github/workflows/deploy-firebase.yml', 'utf8');
const INDEX = readFileSync('functions/index.js', 'utf8');

/** As linhas de comando do workflow, sem os comentários. */
const comandos = WORKFLOW.split('\n').filter((l) => !l.trim().startsWith('#'));

describe('deploy das Cloud Functions', () => {
  it('⭐ nunca publica "todas as funções do projeto"', () => {
    const amplos = comandos.filter((l) => /firebase deploy[^\n]*--only\s+["']?functions["']?(\s|$)/.test(l));
    expect(amplos, `deploy amplo encontrado:\n${amplos.join('\n')}`).toEqual([]);
  });

  it('⭐ o deploy de funções usa a lista por nome', () => {
    const deploy = comandos.find((l) => /firebase deploy/.test(l) && /\$FUNCS/.test(l));
    expect(deploy, 'o passo de Functions deve publicar "$FUNCS"').toBeTruthy();
  });

  it('⭐ lista vazia não publica nada (`--only` vazio seria "tudo")', () => {
    expect(WORKFLOW).toMatch(/if \[ -z "\$FUNCS" \]; then[\s\S]{0,200}exit 0/);
  });

  it('a extração do workflow acha TODAS as funções exportadas', () => {
    // Mesma expressão do workflow. Uma exportação escrita de outro jeito
    // (`exports['x']`, `module.exports = {…}`) ficaria fora do deploy, e é
    // melhor o teste avisar do que a função sumir em silêncio.
    const pelaExtracao = [...INDEX.matchAll(/^exports\.([A-Za-z0-9_]+)/gm)].map((m) => m[1]);
    expect(pelaExtracao.length).toBeGreaterThan(0);
    expect(INDEX).not.toMatch(/exports\[/);
    expect(INDEX).not.toMatch(/module\.exports\s*=/);
    expect(new Set(pelaExtracao).size).toBe(pelaExtracao.length);
  });
});
