/**
 * Guarda: toda rota prometida pelo CATÁLOGO de módulos de arena existe.
 *
 * O catálogo (`moduleCatalog.js`) declara, por módulo, o caminho da tela de
 * gestão (`manage`) e o da tela pública (`public`). Quem monta os atalhos —
 * `ArenaModuleShortcuts` — lê dali, sem lista escrita à mão. É o desenho
 * certo, e tem um flanco: **um caminho com erro de digitação, ou uma rota
 * removida numa faxina, não dá erro nenhum**. Dá um botão bonito que leva a
 * uma tela em branco, para o cliente da arena, no celular, na frente da
 * recepção.
 *
 * Este teste lê os DOIS arquivos-fonte e exige que cada caminho do catálogo
 * tenha uma rota correspondente. É primo do teste que confere os links da
 * central de ajuda contra as rotas reais, e da guarda de índices compostos:
 * defeitos que o compilador não vê e o navegador só mostra tarde.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { ARENA_MODULE_DETAIL } from '@/modules/arenas/domain/moduleCatalog.js';

/** Os caminhos declarados nas rotas do V2App, normalizados sem a barra. */
function rotasDeclaradas() {
  const fonte = readFileSync('src/v2/V2App.jsx', 'utf8');
  const achadas = new Set();
  const re = /<Route\s+path="([^"]+)"/g;
  let m = re.exec(fonte);
  while (m) {
    achadas.add(m[1].replace(/^\//, ''));
    m = re.exec(fonte);
  }
  return achadas;
}

/** Os caminhos que o catálogo promete, por módulo e por tipo. */
function rotasDoCatalogo() {
  const saida = [];
  Object.entries(ARENA_MODULE_DETAIL).forEach(([id, meta]) => {
    ['manage', 'public'].forEach((tipo) => {
      if (meta?.[tipo]) saida.push({ id, tipo, caminho: meta[tipo].replace(/^\//, '') });
    });
  });
  return saida;
}

describe('as rotas do catálogo de módulos de arena', () => {
  const declaradas = rotasDeclaradas();
  const prometidas = rotasDoCatalogo();

  it('o catálogo promete rotas (senão este teste não estaria provando nada)', () => {
    expect(prometidas.length).toBeGreaterThan(10);
    expect(declaradas.size).toBeGreaterThan(30);
  });

  prometidas.forEach(({ id, tipo, caminho }) => {
    it(`${id} · ${tipo} → /${caminho} existe em V2App`, () => {
      expect(
        declaradas.has(caminho),
        `O catálogo manda o usuário para "/${caminho}" (módulo ${id}, ${tipo}), e não há `
        + '<Route path> com esse caminho em src/v2/V2App.jsx. O atalho vai virar tela em branco.',
      ).toBe(true);
    });
  });

  it('os caminhos usam :arenaId — é o nome que arenaModuleRoute troca', () => {
    // `arenaModuleRoute` faz `tpl.replace(':arenaId', arenaId)`. Um caminho
    // escrito com `:id` passaria batido e chegaria ao navegador com os dois
    // pontos literais.
    prometidas.forEach(({ id, tipo, caminho }) => {
      expect(
        /:arenaId/.test(caminho),
        `${id} (${tipo}) usa um parâmetro que não é :arenaId — "/${caminho}".`,
      ).toBe(true);
    });
  });
});
