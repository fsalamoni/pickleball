/**
 * A varredura de "falha não é lista vazia" (ferramenta de guarda).
 *
 * ⚠️ Este arquivo NÃO vai para o navegador: só o teste de guarda o importa.
 *
 * ## Por que ele existe
 *
 * O guarda nasceu com uma LISTA ESCRITA À MÃO das telas que precisam
 * distinguir falha de vazio. Funcionou para travar o que já tinha sido
 * corrigido — e falhou exatamente onde um guarda não pode falhar: **ele não
 * sabe o que ninguém lembrou de colocar nele**.
 *
 * Foi assim que, depois de três ondas seguidas fechando "a classe", sobraram a
 * lista de torneios (*"Nenhum torneio público no momento"*), a aba de
 * modalidades (*"Comece criando a primeira modalidade"* — convidando a criar
 * uma DUPLICADA), a visão de equipes, o histórico de participação e o
 * organizador LEGADO do clube, este último com o mesmo defeito de sorteio da
 * Onda AW ainda vivo.
 *
 * Uma lista à mão é a mesma doença que a série inteira vem tratando: confiar
 * em quem lembrar. Então a lista virou VARREDURA — quem entra no escopo é
 * examinado por existir, não por ter sido lembrado — e a exceção passou a
 * exigir um MOTIVO ESCRITO.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Tira comentários, para não acusar o texto que EXPLICA o defeito. */
export function semComentarios(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');
}

/**
 * Frases em que a tela AFIRMA que algo não existe.
 *
 * Não entram aqui: rótulo de opção ("— Nenhuma —"), mensagem de `toast` depois
 * de uma ação explícita, e texto que veio por `props` — nesses casos quem
 * decide não é esta tela.
 */
export const AFIRMACOES_DE_VAZIO = [
  /Nenhum[ao]?\s+[a-zç]/i,
  /Sem (jogos|resultados|próximos|partidas|participantes|equipes)/i,
  /não encontrad[oa]/i,
  /ainda não (foi|há|existe|tem|participou|publicad|gerad|sortead)/i,
  /não há nenhum/i,
];

/** A tela afirma vazio em algum lugar? */
export function afirmaVazio(src) {
  const limpo = semComentarios(src);
  return AFIRMACOES_DE_VAZIO.some((re) => re.test(limpo));
}

/**
 * A tela sabe que uma consulta pode FALHAR?
 *
 * Vale `isError` (React Query), `isLoadingError`, `status === 'error'` e
 * também o estado de erro próprio de telas que não usam React Query
 * (`setError(...)` + banner) — o que importa é existir um caminho em que a
 * tela diz "falhou" em vez de "não existe".
 */
export function sabeDistinguirFalha(src) {
  const limpo = semComentarios(src);
  return /isError|isLoadingError|status === 'error'|setError\s*\(/.test(limpo);
}

/**
 * Hooks do próprio React: não buscam nada, então não podem falhar.
 * ⚠️ Sem esta lista, `useMemo` fazia um componente que só recebe `props` ser
 * acusado de "afirmar vazio sem tratar falha" — e guarda que acusa inocente
 * é guarda que alguém desliga.
 */
const HOOKS_DO_REACT = new Set([
  'useMemo', 'useState', 'useEffect', 'useLayoutEffect', 'useCallback', 'useRef',
  'useContext', 'useReducer', 'useId', 'useTransition', 'useDeferredValue',
  'useImperativeHandle', 'useDebugValue', 'useSyncExternalStore',
]);

/** A tela consulta alguma coisa? (sem consulta, não há falha possível) */
export function temConsulta(src) {
  const limpo = semComentarios(src);
  if (/useQuery|useInfiniteQuery|useQueries/.test(limpo)) return true;
  for (const m of limpo.matchAll(/\buse([A-Z][A-Za-z0-9]*)\(/g)) {
    if (!HOOKS_DO_REACT.has(`use${m[1]}`)) return true;
  }
  return false;
}

/** Varre um diretório e devolve os caminhos de arquivo que casam com `filtro`. */
export function varrer(raiz, filtro) {
  const achados = [];
  const visitar = (dir) => {
    for (const nome of readdirSync(dir)) {
      const caminho = join(dir, nome);
      if (statSync(caminho).isDirectory()) visitar(caminho);
      else if (filtro(caminho)) achados.push(caminho);
    }
  };
  visitar(raiz);
  return achados.sort();
}

/**
 * Quem, no escopo dado, afirma vazio sem saber distinguir falha.
 * @returns {string[]} caminhos, ordenados
 */
export function telasQueMentemNoVazio(caminhos) {
  return caminhos.filter((c) => {
    const src = readFileSync(c, 'utf8');
    return temConsulta(src) && afirmaVazio(src) && !sabeDistinguirFalha(src);
  });
}
