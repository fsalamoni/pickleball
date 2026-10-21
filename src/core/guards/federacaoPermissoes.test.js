/**
 * ⭐ Guarda: o mapa papel → permissões da equipe da federação é UM, e vive em
 * dois lugares — `STAFF_ROLE_PERMISSIONS` (cliente e servidor importam) e
 * `fedRolePerms()` no `firestore.rules` (a regra não importa JS). Divergência
 * não dá erro: a tela oferece um botão e a regra recusa com "permissão
 * negada". Este teste lê a regra como texto e compara papel a papel.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { STAFF_ROLE, STAFF_ROLE_PERMISSIONS } from '@/modules/federations/domain/constants';

const regras = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');

/** Lê `fedRolePerms(role)` da regra: `role == 'x' ? [...]` → { x: [...] }. */
function permissoesDaRegra() {
  const ini = regras.indexOf('function fedRolePerms(role)');
  expect(ini, 'fedRolePerms existe na regra').toBeGreaterThan(0);
  const corpo = regras.slice(ini, regras.indexOf('}', ini));
  const mapa = {};
  // "role == 'president' || role == 'director'\n ? ['admin', …]" e "(role == 'secretary' ? ['members']"
  const re = /((?:role == '[a-z_]+'(?:\s*\|\|\s*)?)+)\s*\?\s*\[([^\]]*)\]/g;
  let m;
  while ((m = re.exec(corpo))) {
    const papeis = [...m[1].matchAll(/role == '([a-z_]+)'/g)].map((x) => x[1]);
    const perms = [...m[2].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]).sort();
    papeis.forEach((p) => { mapa[p] = perms; });
  }
  return mapa;
}

describe('federação: papel → permissões igual no cliente e na regra', () => {
  it('cada papel dá as mesmas permissões nos dois lados', () => {
    const regra = permissoesDaRegra();
    for (const papel of Object.values(STAFF_ROLE)) {
      expect(regra[papel], `papel ${papel} existe na regra`).toBeDefined();
      expect([...STAFF_ROLE_PERMISSIONS[papel]].sort(), papel).toEqual(regra[papel]);
    }
    expect(Object.keys(regra).sort()).toEqual(Object.values(STAFF_ROLE).sort());
  });
});
