// Orçamento do pacote inicial (gzip): o que o navegador baixa até a primeira
// tela. Medido em 2026-10-10: ≈428 kB. O teto só desce; quem passar dele
// precisa dividir o que acrescentou (lazy) ou tirar algo do caminho crítico.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

const TETO_KB = Number(process.env.BUNDLE_BUDGET_KB || 440);
const dist = path.resolve('dist');
const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
const iniciais = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);

let total = 0;
for (const rel of iniciais) {
  const kb = gzipSync(readFileSync(path.join(dist, rel))).length / 1024;
  total += kb;
  console.log(`${kb.toFixed(1).padStart(7)} kB  ${rel}`);
}
console.log(`${total.toFixed(1).padStart(7)} kB  TOTAL inicial (teto ${TETO_KB} kB)`);
if (total > TETO_KB) {
  console.error(`✖ pacote inicial acima do orçamento: ${total.toFixed(1)} kB > ${TETO_KB} kB`);
  process.exit(1);
}
