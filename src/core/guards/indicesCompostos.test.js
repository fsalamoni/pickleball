/**
 * 🛡️ Consulta que precisa de índice composto E NÃO TEM.
 *
 * ## Por que este teste existe
 *
 * `where('arena_id','==',x)` + `orderBy('date')` exige um índice composto no
 * Firestore. Sem ele a consulta **falha** — e como o padrão do projeto é
 * `const { data = [] } = useX()`, o erro vira lista vazia e a tela mente em
 * silêncio. Foi exatamente isso com `arena_unavailabilities`: a consulta
 * nunca funcionou, o calendário nunca recebeu um bloqueio, e o sintoma que
 * apareceu meses depois foi "o dia de jogo não fecha a quadra".
 *
 * Havia mais três iguais (fila de espera por slot, fila por atleta,
 * checklists da arena) — todas mortas desde que foram escritas.
 *
 * Este teste lê o CÓDIGO e o `firestore.indexes.json` e reprova a combinação
 * sem índice. Quem precisar de uma consulta assim tem duas saídas honestas:
 * criar o índice (mexe no banco, decisão consciente) ou ordenar em memória.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/* ------------------------------------------------------------- índices -- */

const indices = JSON.parse(readFileSync('firestore.indexes.json', 'utf8'));

/** collectionGroup → lista de vetores de campos indexados. */
const INDICES_POR_COLECAO = indices.indexes.reduce((acc, i) => {
  const campos = i.fields.map((f) => f.fieldPath);
  return { ...acc, [i.collectionGroup]: [...(acc[i.collectionGroup] || []), campos] };
}, {});

/**
 * O Firestore serve a consulta se existir um índice que comece pelos campos de
 * IGUALDADE (em qualquer ordem entre si) e siga pelos de ordenação.
 */
function temIndice(colecao, igualdades, ordenacoes) {
  const candidatos = INDICES_POR_COLECAO[colecao] || [];
  return candidatos.some((campos) => {
    const prefixo = campos.slice(0, igualdades.length);
    const cobreIgualdades = igualdades.every((c) => prefixo.includes(c));
    const resto = campos.slice(igualdades.length);
    const cobreOrdem = ordenacoes.every((c, i) => resto[i] === c);
    return cobreIgualdades && cobreOrdem;
  });
}

/* -------------------------------------------------------------- código -- */

function arquivosDeServico(dir, saida = []) {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosDeServico(caminho, saida);
    else if (nome.endsWith('.js') && !nome.includes('.test.')) saida.push(caminho);
  }
  return saida;
}

/** Resolve `collection(db, X)` para o nome real, quando X é literal no arquivo. */
function resolveColecao(src, expressao) {
  const exp = expressao.trim();
  const literal = exp.match(/^'([^']+)'$/);
  if (literal) return literal[1];
  // `COL` / `COL_X` declarados no próprio arquivo
  const constante = src.match(new RegExp(`const\\s+${exp.replace(/[.[\\]]/g, '\\\\$&')}\\s*=\\s*'([^']+)'`));
  if (constante) return constante[1];
  // `MAPA.chave` — procura a chave dentro de um objeto no arquivo
  const comPonto = exp.match(/^[A-Za-z_$][\w$]*\.([\w$]+)$/);
  if (comPonto) {
    const naChave = src.match(new RegExp(`${comPonto[1]}:\\s*'([^']+)'`));
    if (naChave) return naChave[1];
  }
  return null;
}

/** Todas as consultas com `where` + `orderBy` encontradas no código. */
function consultasComOrdenacao() {
  const achados = [];
  for (const arquivo of arquivosDeServico('src/modules')) {
    const src = readFileSync(arquivo, 'utf8');
    if (!src.includes('orderBy(')) continue;

    // Cada `query(` até o fecha-parênteses equilibrado.
    for (let i = src.indexOf('query('); i !== -1; i = src.indexOf('query(', i + 1)) {
      let nivel = 0;
      let fim = i + 'query('.length - 1;
      for (let j = i + 'query('.length - 1; j < src.length; j++) {
        if (src[j] === '(') nivel += 1;
        else if (src[j] === ')') { nivel -= 1; if (nivel === 0) { fim = j; break; } }
      }
      const corpo = src.slice(i, fim + 1);
      const ordenacoes = [...corpo.matchAll(/orderBy\(\s*'([^']+)'/g)].map((m) => m[1]);
      if (ordenacoes.length === 0) continue;
      const igualdades = [...corpo.matchAll(/where\(\s*'([^']+)'\s*,\s*'=='/g)].map((m) => m[1]);
      const faixas = [...corpo.matchAll(/where\(\s*'([^']+)'\s*,\s*'(?:<|<=|>|>=|!=|in|not-in|array-contains[^']*)'/g)].map((m) => m[1]);
      if (igualdades.length === 0 && faixas.length === 0) continue; // só orderBy: índice simples basta

      const alvo = corpo.match(/collection\(\s*db\s*,\s*([^)]+)\)/);
      const colecao = alvo ? resolveColecao(src, alvo[1]) : null;
      achados.push({
        arquivo,
        linha: src.slice(0, i).split('\n').length,
        colecao,
        igualdades,
        faixas,
        ordenacoes,
      });
    }
  }
  return achados;
}

/* --------------------------------------------------------------- testes -- */

/**
 * Consultas cuja coleção o teste não consegue resolver do literal — cada uma
 * conferida À MÃO contra `firestore.indexes.json`. Entrar aqui é uma decisão,
 * não um esquecimento.
 */
const CONFERIDAS_A_MAO = new Set([
  // A coleção vem de variável (o ranking do clube escolhe entre a tabela
  // normal e a `_ext`). As quatro consultas batem com índices existentes:
  'src/modules/clubs/hooks/useClubInternalRanking.js',   // club_internal_ratings[club_id, wins] e a de duplas
  'src/modules/progression/services/missionService.js',  // user_missions[uid, date]
  'src/modules/progression/services/seasonRankingService.js', // season_rankings[seasonId, xp] e [uid, xp]
  'src/modules/progression/services/hallOfFameService.js',    // `in` num campo só: índice simples basta
]);

describe('🛡️ nenhuma consulta pede índice composto que não existe', () => {
  const consultas = consultasComOrdenacao();

  it('encontra consultas para conferir (o varredor não está cego)', () => {
    expect(consultas.length).toBeGreaterThan(5);
  });

  it('⭐ toda consulta com where + orderBy tem índice — ou não existe', () => {
    const semIndice = consultas
      .filter((c) => c.colecao && !temIndice(c.colecao, [...c.igualdades, ...c.faixas], c.ordenacoes))
      .map((c) => `${c.arquivo}:${c.linha} · ${c.colecao} · ==[${c.igualdades}] faixa[${c.faixas}] orderBy[${c.ordenacoes}]`);
    expect(semIndice).toEqual([]);
  });

  it('as coleções que o varredor não resolve estão conferidas à mão', () => {
    const naoResolvidas = [...new Set(consultas.filter((c) => !c.colecao).map((c) => c.arquivo))]
      .filter((f) => !CONFERIDAS_A_MAO.has(f));
    expect(naoResolvidas).toEqual([]);
  });
});
