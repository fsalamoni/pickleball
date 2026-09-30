/**
 * 🛡️ "Hoje" na arena é o dia do BRASIL, não o de Greenwich.
 *
 * `new Date().toISOString().slice(0, 10)` devolve a data em UTC. Das 21h à
 * meia-noite (horário de Brasília) isso já é AMANHÃ — e o módulo da arena
 * inteiro errava por três horas todo dia:
 *
 *  - o calendário de reserva tratava HOJE como dia passado (`isPast`) e o da
 *    arena abria no dia seguinte;
 *  - jogos abertos, aulas e torneios da casa de hoje sumiam das listas "a
 *    partir de hoje";
 *  - a compra e a venda lançadas no Mercado depois das 21h saíam com a data de
 *    amanhã, e a validade dos produtos ficava um dia adiantada.
 *
 * O dia local sai de `todayISO()` / `formatDateISO(d)`
 * (`modules/arenas/domain/calendar.js`). Este guarda lê o CÓDIGO do módulo e
 * reprova quem voltar a fatiar a data ISO.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZES = ['src/modules/arenas', 'src/v2/components/arenas'];
const PAGINAS = 'src/v2/pages';

function arquivos(dir, saida = []) {
  if (!existsSync(dir)) return saida;
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivos(caminho, saida);
    else if (/\.(js|jsx)$/.test(nome) && !/\.test\./.test(nome)) saida.push(caminho);
  }
  return saida;
}

function doEscopo() {
  const lista = RAIZES.flatMap((r) => arquivos(r));
  for (const nome of readdirSync(PAGINAS)) {
    if (/^V2Arena.*\.jsx$/.test(nome) && !/\.test\./.test(nome)) lista.push(join(PAGINAS, nome));
  }
  return lista;
}

/** Apaga comentários (a explicação do defeito cita o próprio defeito). */
function semComentarios(src) {
  return src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
}

const DATA_EM_UTC = /toISOString\(\)\s*\.\s*(slice\(\s*0\s*,\s*10\s*\)|split\(\s*['"]T['"]\s*\)\s*\[\s*0\s*\])/;

describe('🛡️ a arena usa o dia local', () => {
  const escopo = doEscopo();

  it('varre o módulo (o guarda não está cego)', () => {
    expect(escopo.length).toBeGreaterThan(50);
  });

  it('⭐ nenhuma data "de hoje" é fatiada da ISO em UTC', () => {
    const achados = [];
    for (const arquivo of escopo) {
      const linhas = semComentarios(readFileSync(arquivo, 'utf8')).split('\n');
      linhas.forEach((linha, i) => {
        if (DATA_EM_UTC.test(linha)) achados.push(`${arquivo}:${i + 1}`);
      });
    }
    expect(achados).toEqual([]);
  });
});
