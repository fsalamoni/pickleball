/**
 * 📏 A LARGURA DAS TELAS É UMA DE TRÊS.
 *
 * Até 2026-10-15 as telas do V2 usavam 21 larguras de página diferentes
 * (640, 700, 760, 820, 900, 1000, 1100, 1200, 1400 px…): ao passar de uma
 * tela para outra o conteúdo pulava de lugar. Agora o contêiner centralizado
 * de uma página usa só `PAGE_WIDTH` (`src/v2/ui/primitives.jsx`):
 *  - estreita 720 px (formulários, leitura)
 *  - padrão 1000 px (a maioria)
 *  - larga 1200 px (vitrines, listas e grades)
 * Use `<V2Page largura="…">` ou a classe do nível. Cartão centralizado
 * (`max-w-md/lg/xl`, 500 px) não é página e segue livre.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { PAGE_WIDTH } from '@/v2/ui/primitives';

/** Fora do V2Layout, com o próprio desenho de tela cheia. */
const ISENTAS = {
  'V2Landing.jsx': 'página de apresentação, sem o layout do app',
  'V2Login.jsx': 'tela de entrada, sem o layout do app',
  'V2ArenaKiosk.jsx': 'totem em tela cheia',
  'V2GameDayTelao.jsx': 'telão em TV',
};
const PERMITIDAS = new Set([
  ...Object.values(PAGE_WIDTH).map((c) => c.replace('max-w-', '')),
  'md', 'lg', 'xl', '[500px]', // cartões centralizados
]);

describe('📏 largura de página', () => {
  const dir = 'src/v2/pages';
  const arquivos = readdirSync(dir).filter((f) => f.endsWith('.jsx') && !f.includes('.test.') && !ISENTAS[f]);

  it('toda página centralizada usa um dos três níveis', () => {
    const fora = [];
    for (const f of arquivos) {
      readFileSync(`${dir}/${f}`, 'utf8').split('\n').forEach((linha, i) => {
        if (!linha.includes('mx-auto')) return;
        for (const m of linha.matchAll(/max-w-(\[\d+px\]|\d?xl|md|lg)/g)) {
          if (!PERMITIDAS.has(m[1])) fora.push(`${f}:${i + 1} max-w-${m[1]}`);
        }
      });
    }
    expect(fora).toEqual([]);
  });

  it('as isenções têm motivo', () => {
    for (const motivo of Object.values(ISENTAS)) expect(motivo.length).toBeGreaterThan(5);
  });
});
