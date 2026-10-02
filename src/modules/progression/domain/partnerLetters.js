/**
 * partnerLetters — a carta ao companheiro.
 *
 * Depois de jogar duplas, uma frase para o parceiro: "obrigado pela parceria",
 * "adorei jogar com você". Anônima por padrão — quem escreve decide se
 * assina. É a mecânica mais barata do estudo e a de maior valor emocional:
 * uma mensagem de gratidão de alguém que jogou ao seu lado.
 *
 * ## Privacidade e segurança
 *
 *  - O documento que o DESTINATÁRIO lê **não carrega quem escreveu** quando a
 *    carta é anônima — a identidade fica num documento à parte (`...Author`),
 *    legível só por quem escreveu e pelo admin (moderação). Esconder o nome só
 *    na tela não seria anonimato: o campo estaria no documento que a pessoa
 *    consegue ler.
 *  - Só dá para escrever ao PARCEIRO DE DUPLA de um jogo (não a adversários, não
 *    a qualquer um): carta é gratidão, não mensagem direta.
 *  - O destinatário pode DENUNCIAR; a carta denunciada vai para a fila de
 *    moderação do admin. O destinatário também decide, nas preferências, se
 *    aceita cartas — o servidor/regra respeitam.
 *
 * Lógica pura, sem I/O.
 */
export const LETTER_MAX = 280;
export const LETTER_MIN = 3;

/** Sugestões de abertura — para quem trava diante do campo em branco. */
export const LETTER_STARTERS = Object.freeze([
  'Obrigado pela parceria! ',
  'Adorei jogar com você. ',
  'Valeu pela paciência e pela energia. ',
  'Foi uma honra dividir a quadra. ',
]);

/**
 * Para quem dá para escrever: os companheiros de dupla (com conta) do jogo.
 * @param {{ partnerUids?: string[] }} record
 * @param {string} myUid
 */
export function letterTargets(record, myUid) {
  return [...new Set((record?.partnerUids || []).filter((u) => u && u !== myUid))];
}

/** Uma carta por jogo e por par. */
export function letterDocId(matchKey, fromUid, toUid) {
  return `${String(matchKey).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 90)}__${fromUid}__${toUid}`;
}

/**
 * Valida e normaliza.
 * @returns {{ ok: true, value: object } | { ok: false, error: string }}
 */
export function validateLetter({ fromUid, toUid, matchKey, text, showName = false } = {}) {
  if (!fromUid || !toUid || fromUid === toUid) return { ok: false, error: 'Escolha o companheiro da carta.' };
  if (!matchKey) return { ok: false, error: 'Informe o jogo.' };
  const limpo = String(text || '').replace(/\s+/g, ' ').trim().slice(0, LETTER_MAX);
  if (limpo.length < LETTER_MIN) return { ok: false, error: 'Escreva ao menos uma frase.' };
  if (/https?:\/\/|www\./i.test(limpo)) return { ok: false, error: 'Cartas não levam links.' };
  return { ok: true, value: { fromUid, toUid, matchKey, text: limpo, showName: Boolean(showName) } };
}

/**
 * O que o destinatário vê: sem `fromUid` quando anônima. Função única para a
 * tela e para o teste de que o anonimato é real.
 */
export function letterForRecipient(letter, authorName = null) {
  return {
    id: letter.id,
    text: letter.text,
    createdAt: letter.createdAt,
    readAt: letter.readAt || null,
    from: letter.showName && authorName ? authorName : 'Um parceiro de dupla',
    anonymous: !(letter.showName && authorName),
  };
}
