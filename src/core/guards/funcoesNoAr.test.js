/**
 * Guarda: a falha do deploy das Cloud Functions não volta a passar calada.
 *
 * 🐞 Do #315 ao #321 o passo "Deploy Cloud Functions" (não fatal, de
 * propósito) falhou em todo deploy: o site e as regras saíram, as funções
 * novas da federação não, e nada avisou. Três vigias, e este teste reprova
 * quem desligar qualquer uma:
 *   1. o deploy grava o resultado (`scripts/functions-health.cjs deploy`) e
 *      põe a falha em destaque no resumo da execução;
 *   2. a vigilância grava cada conferência (`… check`), que o painel admin
 *      mostra em Sistema → Diagnóstico → "Funções no ar";
 *   3. o e2e sobe o emulador de FUNÇÕES e roda o ciclo da filiação.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);
const { montar } = require('../../../scripts/functions-health.cjs');
const DEPLOY = readFileSync('.github/workflows/deploy-firebase.yml', 'utf8');
const VIGIA = readFileSync('.github/workflows/functions-watchdog.yml', 'utf8');
const E2E = readFileSync('scripts/e2e.sh', 'utf8');

describe('funções no ar', () => {
  it('o deploy grava o resultado e destaca a falha no resumo', () => {
    expect(DEPLOY).toMatch(/node scripts\/functions-health\.cjs deploy ok/);
    expect(DEPLOY).toMatch(/node scripts\/functions-health\.cjs deploy falhou/);
    expect(DEPLOY).toMatch(/As Cloud Functions NÃO foram publicadas[\s\S]*GITHUB_STEP_SUMMARY/);
  });

  it('a vigilância grava cada conferência', () => {
    expect(VIGIA).toMatch(/node scripts\/functions-health\.cjs check esperadas\.txt publicadas\.txt faltando\.txt sem_rotulo\.txt/);
  });

  it('o e2e sobe o emulador de funções', () => {
    expect(E2E).toMatch(/emulators:exec --only [a-z,]*functions/);
  });

  it('o registro da falha preserva quando o deploy deu certo pela última vez', () => {
    const agora = new Date('2026-10-23T12:00:00Z');
    const ok = montar(['deploy', 'ok'], agora).deploy;
    expect(ok).toMatchObject({ ok: true, error: null, last_ok_at: agora });
    const falha = montar(['deploy', 'falhou', 'Error: Changing from an HTTPS function'], agora).deploy;
    expect(falha).toMatchObject({ ok: false, error: 'Error: Changing from an HTTPS function' });
    expect(falha).not.toHaveProperty('last_ok_at'); // no merge, o anterior fica
  });

  // 🐞 #423: UMA função de 131 falhou (IAM, passageiro) e o painel disse que o
  // deploy inteiro tinha falhado, mostrando um aviso de cota com códigos de cor.
  it('o script tenta de novo SÓ as funções que a CLI listou como falhas', () => {
    const SCRIPT = readFileSync('scripts/functions-deploy.sh', 'utf8');
    expect(SCRIPT).toMatch(/for TENTATIVA in 1 2 3/);
    expect(SCRIPT).toMatch(/\[ -z "\$FALHAS" \] && break/); // sem lista, não repete (e nunca `--only` vazio)
    expect(SCRIPT).toMatch(/echo "FUNCOES_COM_FALHA=\$FALHAS"/);
    const log = [
      '\u001b[32m\u001b[1m✔ \u001b[22m\u001b[39m functions[picklerush:leagues(southamerica-east1)] Successful update operation.',
      'Functions deploy had errors with the following functions:',
      '\tpicklerush:tournamentScheduleWorker(southamerica-east1)',
      '',
      'Unable to set the invoker for the IAM policy on the following functions:',
      '\tpicklerush:tournamentScheduleWorker(southamerica-east1)',
      '\tpicklerush:leagueAutoConfirmWorker(southamerica-east1)',
      '\toutro:naoENossa(us-central1)',
    ].join('\n');
    const falhas = (entrada) => execFileSync('bash', ['scripts/functions-deploy-falhas.sh', 'picklerush'], { input: entrada, encoding: 'utf8' }).trim();
    expect(falhas(log)).toBe('leagueAutoConfirmWorker,tournamentScheduleWorker');
    expect(falhas('Error: Changing from an HTTPS function to a background triggered function is not allowed')).toBe('');
  });

  // 🐞 #424: a CLI saiu com código 0 sem "Deploy complete!" e sem confirmar 7
  // de 131 funções (cota, "Waiting to retry..."). O passo ficou verde.
  it('código 0 não basta: função pedida sem linha de confirmação é tentada de novo', () => {
    const SCRIPT = readFileSync('scripts/functions-deploy.sh', 'utf8');
    expect(SCRIPT).toMatch(/functions-deploy-falhas\.sh "\$CODEBASE" "\$PEDIDAS"/);
    expect(SCRIPT).toMatch(/\[ -z "\$FALHAS" \] && exit 0/); // só sai "ok" com todas confirmadas
    expect(SCRIPT).not.toMatch(/\[ "\$RC" -eq 0 \] && exit 0/);
    const semConfirmar = (pedidas, entrada) => execFileSync('bash', ['scripts/functions-deploy-falhas.sh', 'picklerush', pedidas], { input: entrada, encoding: 'utf8' }).trim();
    const log = [
      'i  functions: updating Node.js 22 (2nd Gen) function picklerush:leagues(southamerica-east1)...',
      'i  functions: updating Node.js 22 (2nd Gen) function picklerush:clubDocs(southamerica-east1)...',
      'i  functions: updating Node.js 22 (2nd Gen) function picklerush:adminDeleteAccounts(southamerica-east1)...',
      '⚠  functions: Got "Quota Exceeded" error while trying to update projects/p/locations/southamerica-east1/functions/clubDocs. Waiting to retry...',
      '\u001b[32m\u001b[1m✔ \u001b[22m\u001b[39m functions[picklerush:leagues(southamerica-east1)] Successful update operation.',
      '✔  functions[picklerush:career(southamerica-east1)] Skipped (No changes detected)',
      '✔  functions[picklerush:novaFuncao(southamerica-east1)] Successful create operation.',
    ].join('\n');
    expect(semConfirmar('leagues,clubDocs,adminDeleteAccounts,career,novaFuncao', log)).toBe('adminDeleteAccounts,clubDocs');
    expect(semConfirmar('leagues,career,novaFuncao', log)).toBe('');
    // Nenhuma linha de confirmação no log inteiro: o formato da CLI mudou, e
    // sem como conferir vale o código de saída (nunca 131 "falhas" inventadas).
    expect(semConfirmar('leagues,clubDocs', '✔  Deploy complete!')).toBe('');
  });

  it('o deploy grava a ÚLTIMA linha de erro, sem cor, e quais funções ficaram', () => {
    expect(DEPLOY).toMatch(/LIMPO=\$\(echo "\$OUT" \| sed 's\/\\x1b/);
    expect(DEPLOY).toMatch(/grep -E "\^Error:" \| tail -1/);
    expect(DEPLOY).toMatch(/functions-health\.cjs deploy falhou "[^"]+" "\$FALHAS"/);
    const agora = new Date('2026-11-13T15:00:00Z');
    const parte = montar(['deploy', 'falhou', '\u001b[1m\u001b[31mError:\u001b[39m\u001b[22m There was an error deploying functions', 'tournamentScheduleWorker, x;rm'], agora).deploy;
    expect(parte).toMatchObject({ ok: false, error: 'Error: There was an error deploying functions', failed: ['tournamentScheduleWorker'] });
    expect(montar(['deploy', 'falhou', 'Error: x'], agora).deploy.failed).toEqual([]);
    expect(montar(['deploy', 'ok'], agora).deploy.failed).toEqual([]);
  });

  it('a conferência conta só as ESPERADAS no ar e separa as que sobram', () => {
    const dir = mkdtempSync(join(tmpdir(), 'funcoes-'));
    const arq = (nome, linhas) => { const p = join(dir, nome); writeFileSync(p, linhas.join('\n')); return p; };
    const r = montar(['check', arq('e', ['a', 'b', 'c']), arq('p', ['a', 'b', 'velha1', 'velha2']), arq('f', ['c']), arq('s', []), arq('x', ['velha1', 'velha2'])], new Date()).check;
    expect(r).toMatchObject({ expected: 3, published: 2, missing: ['c'], extra: ['velha1', 'velha2'] });
    expect(VIGIA).toMatch(/comm -23 - esperadas\.txt > sobrando\.txt/);
  });

  // Decisão do dono (2026-11-13): as duas funções antigas saem de produção. O
  // projeto é compartilhado com outro app, então apagar é por lista fechada.
  it('função aposentada só é apagada pelo nome, se sobra no ar e saiu do código', () => {
    const SCRIPT = readFileSync('scripts/functions-apagar-aposentadas.sh', 'utf8');
    expect(SCRIPT).toMatch(/^APOSENTADAS="expireStaleNotifications federationDocumentsSync"$/m);
    const apagar = SCRIPT.split('\n').filter((l) => /firebase functions:delete/.test(l) && !/^\s*#/.test(l));
    expect(apagar).toHaveLength(1);
    expect(apagar[0]).toMatch(/functions:delete "\$NOME" --region "\$FUNCTIONS_REGION" --project "\$FIREBASE_PROJECT_ID"/);
    expect(VIGIA).toMatch(/bash scripts\/functions-apagar-aposentadas\.sh esperadas\.txt sobrando\.txt publicadas\.txt/);
    // Só a vigilância apaga; o deploy, nunca.
    expect(readFileSync('.github/workflows/deploy-firebase.yml', 'utf8')).not.toMatch(/functions:delete|functions-apagar-aposentadas/);
    expect(readFileSync('scripts/functions-deploy.sh', 'utf8')).not.toMatch(/functions:delete/);

    const dir = mkdtempSync(join(tmpdir(), 'aposentadas-'));
    const arq = (nome, linhas) => { const p = join(dir, nome); writeFileSync(p, linhas.length ? `${linhas.join('\n')}\n` : ''); return p; };
    // CLI falsa: anota o pedido e responde como a de verdade, SEMPRE com código
    // 0 (🐞 a de verdade sai com 0 mesmo sem apagar). "node" falso: anota a
    // chamada ao caminho direto e dá certo ou errado conforme o arquivo.
    const COR = '\\x1b[32m';
    writeFileSync(join(dir, 'firebase'), [
      '#!/bin/bash',
      `echo "$@" >> "${join(dir, 'chamadas')}"`,
      `case "$(cat "${join(dir, 'modo')}")" in`,
      `  ok) printf '${COR}functions[picklerush:%s(southamerica-east1)]\\x1b[39m Successful delete operation.\\n' "$2" ;;`,
      `  sem-tarefa) echo "Request to https://cloudscheduler.googleapis.com/v1/projects/p/locations/southamerica-east1/jobs/firebase-schedule-$2-southamerica-east1 had HTTP Error: 404, Job not found." ;;`,
      '  *) echo "Functions deploy had errors with the following functions:" ;;',
      'esac',
      'exit 0',
      '',
    ].join('\n'), { mode: 0o755 });
    writeFileSync(join(dir, 'node'), `#!/bin/bash\necho "$@" >> "${join(dir, 'direto')}"\nexit "$(cat "${join(dir, 'direto-rc')}")"\n`, { mode: 0o755 });
    const rodar = (esperadas, sobrando, publicadas, modo = 'ok', diretoRc = 0) => {
      for (const n of ['chamadas', 'direto']) writeFileSync(join(dir, n), '');
      writeFileSync(join(dir, 'modo'), modo);
      writeFileSync(join(dir, 'direto-rc'), String(diretoRc));
      const e = arq('e', esperadas); const s = arq('s', sobrando); const p = arq('p', publicadas);
      const saida = execFileSync('bash', ['scripts/functions-apagar-aposentadas.sh', e, s, p], {
        encoding: 'utf8',
        env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, FIREBASE_PROJECT_ID: 'proj', FUNCTIONS_REGION: 'southamerica-east1' },
      });
      const ler = (arquivo) => readFileSync(arquivo, 'utf8').split('\n').filter(Boolean);
      return { saida, chamadas: ler(join(dir, 'chamadas')), direto: ler(join(dir, 'direto')), sobrando: ler(s), publicadas: ler(p) };
    };

    // Sobra no ar e saiu do código: apaga SÓ ela, pelo nome e pela região; a
    // outra que sobra (fora da lista) fica.
    const a = rodar(['leagues'], ['expireStaleNotifications', 'outraAntiga'], ['expireStaleNotifications', 'leagues', 'outraAntiga']);
    expect(a.chamadas).toEqual(['functions:delete expireStaleNotifications --region southamerica-east1 --project proj --force']);
    expect(a.direto).toEqual([]);
    expect(a.sobrando).toEqual(['outraAntiga']);
    expect(a.publicadas).toEqual(['leagues', 'outraAntiga']);
    expect(a.saida).toMatch(/expireStaleNotifications saiu de produção/);
    // Voltou ao código: não apaga, mesmo que apareça como sobrando.
    expect(rodar(['federationDocumentsSync'], ['federationDocumentsSync'], ['federationDocumentsSync']).chamadas).toEqual([]);
    // Não sobra no ar (já saiu, ou não é do nosso codebase): nada a fazer.
    expect(rodar(['leagues'], [], ['leagues']).chamadas).toEqual([]);

    // 🐞 2026-11-14: a CLI saiu com 0 sem apagar e o script disse "saiu de
    // produção". Sem a linha de confirmação da função, ela NÃO saiu.
    const b = rodar([], ['federationDocumentsSync'], ['federationDocumentsSync'], 'erro');
    expect(b.direto).toEqual([]);
    expect(b.sobrando).toEqual(['federationDocumentsSync']);
    expect(b.publicadas).toEqual(['federationDocumentsSync']);
    expect(b.saida).toMatch(/federationDocumentsSync segue publicada/);
    expect(b.saida).not.toMatch(/saiu de produção/);
    // Função agendada sem a tarefa (404 do Cloud Scheduler): a CLI desiste, e
    // só então a função sai direto pela API — pelo nome.
    const c = rodar([], ['expireStaleNotifications'], ['expireStaleNotifications'], 'sem-tarefa');
    expect(c.direto).toEqual(['scripts/functions-apagar-direto.cjs expireStaleNotifications']);
    expect(c.sobrando).toEqual([]);
    // O caminho direto também pode falhar: aí ela segue listada.
    const d = rodar([], ['expireStaleNotifications'], ['expireStaleNotifications'], 'sem-tarefa', 1);
    expect(d.sobrando).toEqual(['expireStaleNotifications']);
    expect(d.saida).not.toMatch(/saiu de produção/);
    // O caminho direto precisa do firebase-admin: roda depois das dependências.
    expect(VIGIA.indexOf('npm --prefix functions ci')).toBeLessThan(VIGIA.indexOf('functions-apagar-aposentadas.sh esperadas.txt'));
  });

  it('o caminho direto apaga uma função só, pelo nome, e recusa a de outro codebase', async () => {
    const { apagar } = require('../../../scripts/functions-apagar-direto.cjs');
    const base = { projeto: 'p', regiao: 'southamerica-east1', espera: 0 };
    const resp = (status, corpo = {}) => ({ status, json: async () => corpo });
    const falsa = (roteiro) => {
      const pedidos = [];
      const api = async (caminho, init = {}) => { pedidos.push(`${init.method || 'GET'} ${caminho}`); return roteiro(caminho, init.method || 'GET', pedidos.length); };
      return { api, pedidos };
    };
    const FN = 'projects/p/locations/southamerica-east1/functions/expireStaleNotifications';

    // Nossa (ou sem rótulo): pede para apagar e espera a operação terminar.
    const ok = falsa((caminho, metodo) => {
      if (metodo === 'DELETE') return resp(200, { name: 'projects/p/locations/southamerica-east1/operations/op1', done: false });
      if (caminho.includes('/operations/')) return resp(200, { done: true });
      return resp(200, { labels: { 'firebase-functions-codebase': 'picklerush' } });
    });
    expect(await apagar({ ...base, api: ok.api, nome: 'expireStaleNotifications' })).toBe('apagada');
    expect(ok.pedidos).toEqual([`GET ${FN}`, `DELETE ${FN}`, 'GET projects/p/locations/southamerica-east1/operations/op1']);

    // Do outro app (o projeto é compartilhado): recusa sem pedir para apagar.
    const alheia = falsa(() => resp(200, { labels: { 'firebase-functions-codebase': 'default' } }));
    await expect(apagar({ ...base, api: alheia.api, nome: 'expireStaleNotifications' })).rejects.toThrow(/não apago/);
    expect(alheia.pedidos).toEqual([`GET ${FN}`]);

    // Já não existe: nada a fazer. Operação com erro: falha. Nome estranho: nem pergunta.
    const sumiu = falsa(() => resp(404));
    expect(await apagar({ ...base, api: sumiu.api, nome: 'expireStaleNotifications' })).toBe('ja-nao-existe');
    const falhou = falsa((caminho, metodo) => (metodo === 'DELETE' ? resp(200, { done: true, error: { message: 'negado' } }) : resp(200, {})));
    await expect(apagar({ ...base, api: falhou.api, nome: 'expireStaleNotifications' })).rejects.toThrow(/negado/);
    const estranho = falsa(() => resp(200));
    await expect(apagar({ ...base, api: estranho.api, nome: '../outra' })).rejects.toThrow(/inválido/);
    expect(estranho.pedidos).toEqual([]);
  });

  it('a conferência conta as listas e corta as longas', () => {
    const r = montar(['check', 'nao-existe-1', 'nao-existe-2', 'nao-existe-3', 'nao-existe-4'], new Date());
    expect(r.check).toMatchObject({ expected: 0, published: 0, missing: [], unlabeled: [] });
    expect(() => montar(['outro'], new Date())).toThrow(/modo desconhecido/);
  });
});
