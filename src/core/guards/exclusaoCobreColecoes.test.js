/**
 * Guarda: toda coleção do TREINO (e o que o professor publica) entra na
 * exclusão de conta — e o que é da pessoa entra na exportação dos dados.
 *
 * A exclusão (`functions/accountDeletion.js`) e a exportação
 * (`trainingExportService.js`) são listas escritas à mão. Coleção nova que
 * ninguém lembra de pôr nelas não dá erro: a conta é "excluída" com o diário
 * de treino no banco, ou a exportação sai "completa" sem ele. Este teste lê o
 * `firestore.rules` e reprova a coleção que ficou de fora — isenção só com
 * motivo escrito.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const exclusao = require('../../../functions/accountDeletion.js');

const REGRAS = readFileSync('firestore.rules', 'utf8');
const EXPORTA_ARQ = 'src/modules/training/services/trainingExportService.js';
const EXPORTA = readFileSync(EXPORTA_ARQ, 'utf8');

/** Coleções de topo vigiadas: todo `training_*` do rules + as do professor. */
const DO_TREINO = [...REGRAS.matchAll(/^\s{4}match \/(training_[a-z_]+)\//gm)].map((m) => m[1]);
const DO_PROFESSOR = ['coach_content', 'coach_packages', 'coach_products'];

/**
 * Como cada coleção chega à exportação: a função que a lê, importada pelo
 * serviço da exportação, num arquivo que cita a coleção. Coleção nova do
 * treino sem linha aqui reprova.
 */
const EXPORTADA_POR = {
  training_items: ['listMyItems'],
  training_sessions: ['listMySessions', 'listComments'],
  training_plans: ['listMyPlans'],
  training_debriefs: ['listMyDebriefs'],
  training_meta: ['getMeta'],
  training_shares: ['listSent', 'listInbox'],
  training_questions: ['listMyQuestions', 'listCoachQuestions', 'listMessages'],
  training_reports: ['listMyReports'],
  player_goals: ['listGoals'],
};

/** Fica fora da exportação de propósito — sempre com o motivo. */
const FORA_DA_EXPORTACAO = {
  // vazio: tudo o que é do treino é exportado.
};

function colecoesDaExclusao() {
  const cols = new Set();
  const de = (lista) => lista.forEach((s) => {
    if (s.col) cols.add(s.col);
    (s.cols || []).forEach((c) => cols.add(c));
  });
  de(exclusao.DELETE_BY_ID);
  de(exclusao.DELETE_BY_QUERY);
  de(exclusao.RETAINED_AS_IS);
  de(exclusao.PSEUDO_SPECS);
  return cols;
}

/** Arquivo de onde o serviço da exportação importa `nome`. */
function arquivoDe(nome) {
  const imp = [...EXPORTA.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g)]
    .find((m) => m[1].split(',').map((s) => s.trim()).includes(nome));
  if (!imp) return null;
  const caminho = imp[2].startsWith('@/')
    ? resolve('src', imp[2].slice(2))
    : resolve(dirname(EXPORTA_ARQ), imp[2]);
  return caminho.endsWith('.js') ? caminho : `${caminho}.js`;
}

describe('a exclusão e a exportação cobrem o treino', () => {
  it('o rules tem as coleções do treino (o guarda está lendo o arquivo certo)', () => {
    expect(DO_TREINO).toEqual(expect.arrayContaining(['training_items', 'training_sessions', 'training_questions']));
  });

  it('⭐ toda coleção do treino e do professor entra na exclusão de conta', () => {
    const cobre = colecoesDaExclusao();
    const faltam = [...DO_TREINO, ...DO_PROFESSOR, 'player_goals'].filter((c) => !cobre.has(c));
    expect(faltam, 'coleção sem tratamento na exclusão de conta').toEqual([]);
  });

  it('⭐ toda coleção do treino tem caminho para a exportação (ou isenção com motivo)', () => {
    const faltam = DO_TREINO.filter((c) => !EXPORTADA_POR[c] && !FORA_DA_EXPORTACAO[c]);
    expect(faltam, 'coleção do treino fora da exportação').toEqual([]);
    Object.values(FORA_DA_EXPORTACAO).forEach((motivo) => expect(String(motivo).length).toBeGreaterThan(20));
  });

  it('⭐ a função declarada é importada pela exportação e lê de fato a coleção', () => {
    Object.entries(EXPORTADA_POR).forEach(([col, funcoes]) => funcoes.forEach((fn) => {
      const arq = arquivoDe(fn);
      expect(arq, `${fn} não é importada por ${EXPORTA_ARQ}`).toBeTruthy();
      expect(readFileSync(arq, 'utf8'), `${fn} (${arq}) não cita '${col}'`).toContain(`'${col}'`);
    }));
  });

  it('o envio de fotos e vídeos sai junto: prefixo do Storage na exclusão e lista na exportação', () => {
    expect(exclusao.STORAGE_PREFIXES.map((f) => f('u1'))).toContain('treino/u1/');
    expect(arquivoDe('listMyUploadPaths')).toBeTruthy();
  });
});
