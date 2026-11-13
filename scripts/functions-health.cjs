#!/usr/bin/env node
/**
 * Grava em `platform_settings/functions_health` o que a vigilância e o deploy
 * viram das Cloud Functions, para o painel admin mostrar (Sistema →
 * Diagnóstico → "Funções no ar"). Do #315 ao #321 o passo de deploy das
 * funções falhou calado (ele é não fatal) e nada na plataforma dizia isso.
 *
 *   node scripts/functions-health.cjs check <esperadas.txt> <publicadas.txt> <faltando.txt> <sem_rotulo.txt> [sobrando.txt]
 *   node scripts/functions-health.cjs deploy ok|falhou [mensagem de erro] [funções que falharam, por vírgula]
 *
 * O documento é público como o resto de `platform_settings` (o painel do
 * ranking lê `ranking_worker` do mesmo jeito): só nomes de funções, contagens,
 * o commit e o link da execução. Usa o firebase-admin das funções
 * (`npm --prefix functions ci`) e a credencial de GOOGLE_APPLICATION_CREDENTIALS.
 * Nunca falha o job: sem gravar, avisa e sai com 0.
 */
const fs = require('node:fs');
const path = require('node:path');

const funcoes = path.join(__dirname, '..', 'functions');
const exigir = (m) => require(require.resolve(m, { paths: [funcoes] }));

const linhas = (arquivo) => (arquivo && fs.existsSync(arquivo)
  ? fs.readFileSync(arquivo, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean)
  : []);

/** O log da CLI vem com códigos de cor do terminal: fora, antes de gravar. */
// eslint-disable-next-line no-control-regex
const semCor = (texto) => String(texto || '').replace(/\x1b\[[0-9;]*m/g, '').trim();

function execucao() {
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_SHA } = process.env;
  return {
    commit: (GITHUB_SHA || '').slice(0, 12) || null,
    run_url: GITHUB_RUN_ID ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}` : null,
  };
}

/** O que gravar, a partir dos argumentos. Exportado para o teste. */
function montar(argv, agora) {
  const [modo, ...resto] = argv;
  if (modo === 'check') {
    const [esperadas, publicadas, faltando, semRotulo, sobrando] = resto;
    const falta = linhas(faltando);
    const esperadasNoAr = new Set(linhas(publicadas));
    return {
      check: {
        at: agora,
        expected: linhas(esperadas).length,
        // 🐞 Contava TUDO o que há na região ("133 de 131"): as funções
        // antigas que o código não exporta mais entravam na conta. Agora é
        // quantas das ESPERADAS estão no ar; as que sobram vão em `extra`.
        published: linhas(esperadas).filter((f) => esperadasNoAr.has(f)).length,
        missing: falta.slice(0, 100),
        unlabeled: linhas(semRotulo).slice(0, 100),
        extra: linhas(sobrando).slice(0, 100),
        ...execucao(),
      },
    };
  }
  if (modo === 'deploy') {
    const ok = resto[0] === 'ok';
    const failed = ok ? [] : String(resto[2] || '').split(',').map((f) => f.trim()).filter((f) => /^[A-Za-z0-9_]+$/.test(f)).slice(0, 100);
    // `last_ok_at` só entra no sucesso: no merge, a falha preserva o anterior.
    // `failed` vazio numa falha = a CLI não apontou função: o deploy inteiro não saiu.
    return { deploy: { at: agora, ok, error: ok ? null : semCor(resto[1]).slice(0, 500) || null, failed, ...execucao(), ...(ok ? { last_ok_at: agora } : {}) } };
  }
  throw new Error(`modo desconhecido: ${modo}`);
}

async function main() {
  const dados = montar(process.argv.slice(2), new Date());
  const { initializeApp } = exigir('firebase-admin/app');
  const { getFirestore, FieldValue } = exigir('firebase-admin/firestore');
  initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || undefined });
  await getFirestore('pickleball').doc('platform_settings/functions_health')
    .set({ ...dados, updated_at: FieldValue.serverTimestamp() }, { merge: true });
  console.log('Registro das funções gravado em platform_settings/functions_health.');
}

if (require.main === module) {
  main().catch((e) => {
    console.log(`::warning title=Registro das funções::Não deu para gravar platform_settings/functions_health (${e.message}). O painel admin mostra o registro anterior.`);
  });
}

module.exports = { montar };
