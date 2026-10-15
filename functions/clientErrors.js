/**
 * Erros do navegador → Google Cloud Error Reporting.
 *
 * O aplicativo manda o erro (mensagem, pilha, rota, versão) para
 * `/api/erro` (rewrite do Hosting para `clientErrorReport`), e esta função o
 * grava no log no formato que o Error Reporting reconhece: ele agrupa os
 * iguais, conta quantas vezes e quantas pessoas, e avisa por e-mail quando
 * aparece um erro novo. Nada de serviço de fora: o dado fica no mesmo projeto
 * do Google onde o resto já está.
 *
 * Esta função é a fronteira de confiança: o corpo vem de qualquer um. Por
 * isso tudo é cortado em tamanho, o e-mail que apareça na mensagem é
 * apagado, e o navegador (user-agent) vem do cabeçalho, não do corpo.
 */

const TIPO = 'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent';
const SERVICO = 'picklerush-web';
const MAX_CORPO = 16 * 1024;

const texto = (v, max) => (typeof v === 'string' ? v : '').slice(0, max);
const semEmail = (s) => s.replace(/[^\s@/:()]+@[^\s@/:()]+\.[a-z]{2,}/gi, '[e-mail]');

/**
 * Uma linha de pilha no formato do V8 ("    at f (arquivo:1:2)"), que é o que
 * o Error Reporting sabe agrupar. Safari e Firefox escrevem "f@arquivo:1:2":
 * viram o mesmo formato. Linha que não é quadro de pilha devolve `null`.
 */
function quadroV8(linha) {
  if (/^\s*at .+:\d+:\d+\)?\s*$/.test(linha)) return `    ${linha.trim()}`;
  const m = linha.trim().match(/^(.*?)@(.+?):(\d+):(\d+)$/);
  return m ? `    at ${m[1] || '<anonymous>'} (${m[2]}:${m[3]}:${m[4]})` : null;
}

/**
 * O relatório que chegou → a entrada de log do Error Reporting, ou `null`
 * quando não há o que registrar.
 * @param {unknown} corpo
 * @param {{ userAgent?: string }} [requisicao]
 */
function entradaDeLog(corpo, { userAgent = '' } = {}) {
  if (!corpo || typeof corpo !== 'object') return null;
  const mensagem = semEmail(texto(corpo.mensagem, 500)).replace(/\s+/g, ' ').trim();
  if (!mensagem) return null;
  const nome = texto(corpo.nome, 80).replace(/[^\w$.]/g, '') || 'Error';
  const fonte = texto(corpo.fonte, 80) || 'app';
  const rota = texto(corpo.rota, 200) || '/';
  const uid = texto(corpo.uid, 128);
  // A 1ª linha da pilha repete a mensagem SEM o e-mail apagado: só os quadros.
  const quadros = texto(corpo.pilha, 4000).split('\n').map(quadroV8).filter(Boolean).slice(0, 30);

  return {
    severity: 'ERROR',
    message: [`${nome}: ${mensagem}`, ...quadros].join('\n'),
    '@type': TIPO,
    serviceContext: { service: SERVICO, version: texto(corpo.versao, 40) || 'desconhecida' },
    context: {
      httpRequest: { url: rota, userAgent: texto(userAgent, 300) },
      ...(uid ? { user: uid } : {}),
      // Sem pilha (ex.: promessa rejeitada com texto), o Error Reporting exige o local.
      ...(quadros.length ? {} : { reportLocation: { filePath: rota, lineNumber: 0, functionName: fonte } }),
    },
    fonte,
    fatal: corpo.fatal === true,
  };
}

/** O corpo cru da requisição (o `sendBeacon` manda texto) → objeto ou `null`. */
function lerCorpo(req) {
  if ((req.rawBody?.length || 0) > MAX_CORPO) return null;
  const b = req.body;
  if (b && typeof b === 'object' && !Buffer.isBuffer(b)) return b;
  try { return JSON.parse(String(b ?? '')); } catch { return null; }
}

/**
 * Teto por instância: 120 relatórios por minuto (e a função tem no máximo 2
 * instâncias). Segura um laço de erro num aparelho ou alguém enchendo o log.
 * ponytail: o contador vive na instância e zera quando ela recicla; com abuso
 * de verdade, App Check no endpoint.
 */
function criarLimite(porMinuto = 120) {
  let janela = 0;
  let usados = 0;
  return (agora = Date.now()) => {
    const minuto = Math.floor(agora / 60000);
    if (minuto !== janela) { janela = minuto; usados = 0; }
    usados += 1;
    return usados <= porMinuto;
  };
}

module.exports = { entradaDeLog, lerCorpo, criarLimite, quadroV8, SERVICO };
