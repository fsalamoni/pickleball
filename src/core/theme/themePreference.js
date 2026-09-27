/**
 * A ESCOLHA do modo escuro — de quem é, onde fica e o que ela resolve.
 *
 * Domínio puro (o armazenamento é o `viewPreference`, que nunca lança). As
 * decisões que moram aqui, e por quê:
 *
 *  1. ⭐ **A escolha é de cada USUÁRIO**, não do navegador: fica em
 *     `v2:view:<uid>:aparencia:tema`. Num tablet de clube duas pessoas usam o
 *     mesmo navegador, e uma não pode herdar o escuro da outra.
 *  2. **Três opções**: Claro, Escuro e Automático (acompanha o aparelho — o
 *     celular que escurece às 18h escurece a plataforma junto). O padrão é o
 *     CLARO: é o que todo mundo via até aqui, e ninguém acorda com a
 *     plataforma diferente sem ter pedido.
 *  3. **Só vale para quem está logado, com a flag ligada.** Quem visita a
 *     landing, o login ou uma página pública não escolheu nada — vê o claro.
 *     Flag desligada: todos no claro, e ninguém fica preso no escuro.
 *  4. **O aparelho guarda um ESPELHO** (`picklerush:tema`) da escolha em
 *     vigor, só para o script de `index.html` pintar a primeira tela certa —
 *     antes de o React, a autenticação e as flags carregarem. Sem ele, quem
 *     escolheu o escuro veria um clarão branco a cada abertura. O espelho só
 *     existe enquanto o escuro pode valer; em qualquer outro caso é apagado.
 *
 * Nada aqui toca o banco.
 */
import { readViewPreference, writeViewPreference } from '@/core/lib/viewPreference';

/** As três aparências. Os valores são contrato de armazenamento. */
export const TEMA = Object.freeze({
  CLARO: 'claro',
  ESCURO: 'escuro',
  AUTOMATICO: 'automatico',
});

/** O que todo mundo vê sem ter escolhido. */
export const TEMA_PADRAO = TEMA.CLARO;

/** Id da preferência por usuário (`viewPreference`). Mudar apaga a escolha de todos. */
export const TEMA_PREF_ID = 'aparencia:tema';

/**
 * Chave do ESPELHO no aparelho, lida pelo script de `index.html` antes da
 * primeira pintura. ⚠️ Está escrita também lá (há teste de paridade).
 */
export const TEMA_DISPOSITIVO_KEY = 'picklerush:tema';

/**
 * A cor da barra do navegador/sistema (`<meta name="theme-color">`) em cada
 * modo. ⚠️ Cópia da paleta (`META_THEME_COLOR` em `palette.js`, que não entra
 * no pacote do navegador) e do script de `index.html` — há teste de paridade.
 */
export const COR_DA_BARRA = Object.freeze({
  claro: '#065f46',
  escuro: '#070B13',
});

/**
 * As rotas que ficam CLARAS sempre: os dois telões, o totem da arena e a
 * impressão do torneio (ver `AparenciaClara`). ⚠️ O script de `index.html` tem
 * a mesma expressão, para a abertura direta não sair escura — há teste de
 * paridade, e outro conferindo que as rotas de `App.jsx` estão envolvidas.
 */
export const ROTA_SEMPRE_CLARA = /\/(telao|totem|imprimir)\/?$/;

/** Consulta de mídia do aparelho no escuro. */
export const MIDIA_SISTEMA_ESCURO = '(prefers-color-scheme: dark)';

/** As opções, na ordem em que aparecem para a pessoa. */
export const OPCOES_DE_TEMA = Object.freeze([
  Object.freeze({
    valor: TEMA.CLARO,
    rotulo: 'Claro',
    descricao: 'O visual de sempre, com fundo claro.',
  }),
  Object.freeze({
    valor: TEMA.ESCURO,
    rotulo: 'Escuro',
    descricao: 'Fundo escuro, mais confortável à noite e com pouca luz.',
  }),
  Object.freeze({
    valor: TEMA.AUTOMATICO,
    rotulo: 'Automático',
    descricao: 'Acompanha o aparelho: claro de dia, escuro quando ele escurecer.',
  }),
]);

const VALIDOS = new Set(Object.values(TEMA));

/**
 * Um valor lido de qualquer lugar vira uma aparência conhecida, ou `null`.
 * Uma escolha de uma versão antiga, que ofereça outra opção, nunca ressuscita
 * como algo que a tela não sabe desenhar.
 * @param {unknown} valor
 * @returns {'claro'|'escuro'|'automatico'|null}
 */
export function normalizarTema(valor) {
  return typeof valor === 'string' && VALIDOS.has(valor) ? /** @type {any} */ (valor) : null;
}

/**
 * O escuro pode valer para esta pessoa agora? Só com a flag ligada e alguém
 * logado — a escolha é do usuário, e o visitante não escolheu nada.
 * @param {{ ligado?: boolean, autenticado?: boolean }} ctx
 */
export function temaDisponivel({ ligado, autenticado } = {}) {
  return Boolean(ligado && autenticado);
}

/**
 * A aparência que vale AGORA: 'claro' ou 'escuro'.
 * @param {{ ligado?: boolean, autenticado?: boolean, escolha?: unknown, sistemaEscuro?: boolean }} ctx
 * @returns {'claro'|'escuro'}
 */
export function temaEfetivo({ ligado, autenticado, escolha, sistemaEscuro } = {}) {
  if (!temaDisponivel({ ligado, autenticado })) return TEMA.CLARO;
  const t = normalizarTema(escolha) || TEMA_PADRAO;
  if (t === TEMA.ESCURO) return TEMA.ESCURO;
  if (t === TEMA.AUTOMATICO) return sistemaEscuro ? TEMA.ESCURO : TEMA.CLARO;
  return TEMA.CLARO;
}

/**
 * O que o ESPELHO do aparelho deve guardar — ou `null` para apagá-lo. Guarda
 * a ESCOLHA (não o efeito): "automático" precisa ser reavaliado a cada
 * abertura, porque o aparelho pode ter escurecido desde a última.
 * @param {{ ligado?: boolean, autenticado?: boolean, escolha?: unknown }} ctx
 * @returns {'escuro'|'automatico'|null}
 */
export function espelhoDoDispositivo({ ligado, autenticado, escolha } = {}) {
  if (!temaDisponivel({ ligado, autenticado })) return null;
  const t = normalizarTema(escolha);
  return t === TEMA.ESCURO || t === TEMA.AUTOMATICO ? t : null;
}

/**
 * A escolha salva desta pessoa (ou o padrão).
 * @param {string|null|undefined} uid
 * @returns {'claro'|'escuro'|'automatico'}
 */
export function lerEscolhaDeTema(uid) {
  if (!uid) return TEMA_PADRAO;
  return normalizarTema(readViewPreference(uid, TEMA_PREF_ID)) || TEMA_PADRAO;
}

/**
 * Salva a escolha desta pessoa. Grava também o "claro", de propósito: se um
 * dia o padrão mudar, quem ESCOLHEU o claro continua no claro.
 * @param {string|null|undefined} uid
 * @param {unknown} escolha
 * @returns {boolean} se gravou (a interface ignora: falhar em guardar nunca trava um clique)
 */
export function salvarEscolhaDeTema(uid, escolha) {
  const t = normalizarTema(escolha);
  if (!uid || !t) return false;
  return writeViewPreference(uid, TEMA_PREF_ID, t);
}
