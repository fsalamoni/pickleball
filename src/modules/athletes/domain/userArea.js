/**
 * MINHA ÁREA (flag `user_hub`): o `/perfil` como a central da pessoa.
 *
 * Duas respostas puras, para a tela não decidir nada sozinha:
 *  - `userAreaSections(papeis, flags)`: as seções que ESTA pessoa vê, na
 *    ordem do plano aprovado. Seção que não é do papel não existe — e, como a
 *    tela só monta a seção aberta, também não consulta nada.
 *  - `userAreaPending(fontes)`: a faixa "Precisa de você". Fonte `undefined`
 *    (não carregou OU falhou) não entra e NUNCA vira zero — a faixa não afirma
 *    "tudo em dia" sem saber. As contas são as MESMAS das telas que resolvem.
 *
 * Papel: `true` (é), `false` (não é), `'erro'` (a leitura falhou) ou
 * `undefined` (carregando). Seção de papel aparece com `true` e com `'erro'` —
 * no segundo caso é ela que mostra a falha e o "Tentar de novo", em vez de a
 * pessoa achar que perdeu a arena.
 */

export const USER_AREA_SECTION = Object.freeze({
  RESUMO: 'resumo',
  /** Perfil e conta (eram duas seções até a Fase 3 do plano de UX, 2026-10-11). */
  PERFIL: 'perfil',
  TREINO: 'treino',
  /** Meus jogos: o que vem e o que foi (eram "Jogo" e "Agenda"). */
  JOGOS: 'jogos',
  TORNEIOS: 'torneios',
  TROFEUS: 'trofeus',
  CLUBES: 'clubes',
  PROFESSOR: 'professor',
  ARENAS: 'arenas',
  ADMIN: 'admin',
});

/** Ids antigos nos links guardados (`?secao=`): caem na seção que os absorveu. */
const SECAO_ANTIGA = Object.freeze({ jogo: 'jogos', agenda: 'jogos', conta: 'perfil' });

/** As duas linhas da barra: o que é da pessoa e o que ela gere. */
export const USER_AREA_GROUPS = Object.freeze([
  { id: 'voce', label: 'Você' },
  { id: 'gestao', label: 'Gerencio' },
]);

const S = USER_AREA_SECTION;

/**
 * Ordem = a do plano. `quem`: 'todos' ou um papel (`professor`, `arenas`,
 * `clubes`, `admin`).
 */
const META = Object.freeze([
  { id: S.RESUMO, label: 'Resumo', icone: 'LayoutGrid', grupo: 'voce', quem: 'todos' },
  { id: S.PERFIL, label: 'Perfil e conta', icone: 'User', grupo: 'voce', quem: 'todos' },
  { id: S.TREINO, label: 'Treino', icone: 'Dumbbell', grupo: 'voce', quem: 'todos' },
  { id: S.JOGOS, label: 'Meus jogos', icone: 'Swords', grupo: 'voce', quem: 'todos' },
  { id: S.TORNEIOS, label: 'Torneios', icone: 'Trophy', grupo: 'voce', quem: 'todos' },
  { id: S.TROFEUS, label: 'Troféus', icone: 'Medal', grupo: 'voce', quem: 'todos' },
  { id: S.CLUBES, label: 'Clubes', icone: 'Users', grupo: 'voce', quem: 'clubes' },
  { id: S.PROFESSOR, label: 'Professor', icone: 'GraduationCap', grupo: 'gestao', quem: 'professor' },
  { id: S.ARENAS, label: 'Arenas', icone: 'Building2', grupo: 'gestao', quem: 'arenas' },
  { id: S.ADMIN, label: 'Admin', icone: 'LayoutDashboard', grupo: 'gestao', quem: 'admin' },
]);

const temPapel = (v) => v === true || v === 'erro';

/**
 * @param {{ professor?: boolean|'erro', arenas?: boolean|'erro', clubes?: boolean|'erro', admin?: boolean }} papeis
 * @returns {Array<{ id: string, label: string, icone: string, grupo: string, dica: string }>}
 */
export function userAreaSections(papeis = {}) {
  return META
    .filter((s) => s.quem === 'todos' || temPapel(papeis[s.quem]))
    .map(({ id, label, icone, grupo }) => ({ id, label, icone, grupo, dica: `minha-area-${id}` }));
}

/** A seção pedida na URL (ou a que absorveu um id antigo), se esta pessoa a vê; senão o resumo. */
export function resolveUserAreaSection(pedida, secoes = []) {
  const id = SECAO_ANTIGA[pedida] || pedida;
  return secoes.some((s) => s.id === id) ? id : S.RESUMO;
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const lista = (x) => (Array.isArray(x) ? x : undefined);
const numero = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : undefined);

/**
 * "Precisa de você". Cada item leva ao lugar que resolve: `to` (outra tela)
 * ou `secao` (uma seção da Minha área).
 *
 * @param {{
 *   arenas?: Array<{ id: string, name?: string, pendentes?: number }>,
 *   convitesClube?: object[],
 *   convitesEvento?: object[],
 *   aulasAResponder?: number,
 *   treinosNaoLidos?: number,
 *   duvidasEsperando?: number,
 * }} fontes cada uma `undefined` quando não carregou ou falhou
 * @returns {Array<{ id: string, count: number, label: string, detalhe?: string, to?: string, secao?: string }>}
 */
export function userAreaPending(fontes = {}) {
  const itens = [];

  for (const a of lista(fontes.arenas) || []) {
    const n = numero(a?.pendentes);
    if (!a?.id || !n) continue;
    itens.push({
      id: `arena:${a.id}`, count: n, detalhe: a.name || 'Arena',
      label: plural(n, 'pedido de reserva esperando resposta', 'pedidos de reserva esperando resposta'),
      to: `/arenas/${a.id}/gerir?aba=reservas`,
    });
  }

  const aulas = numero(fontes.aulasAResponder);
  if (aulas) {
    itens.push({
      id: 'aulas', count: aulas, to: '/aulas?aba=agenda',
      label: plural(aulas, 'pedido de aula esperando resposta', 'pedidos de aula esperando resposta'),
    });
  }

  const convites = lista(fontes.convitesClube);
  if (convites?.length) {
    itens.push({
      id: 'convites-clube', count: convites.length, secao: S.CLUBES,
      label: plural(convites.length, 'convite para entrar num clube', 'convites para entrar em clubes'),
    });
  }

  // Convite de evento só "precisa de você" enquanto não foi respondido.
  const eventos = lista(fontes.convitesEvento)?.filter((i) => i?.status === 'invited');
  if (eventos?.length) {
    itens.push({
      id: 'convites-evento', count: eventos.length, secao: S.CLUBES,
      label: plural(eventos.length, 'convite para evento de clube', 'convites para eventos de clube'),
    });
  }

  const duvidas = numero(fontes.duvidasEsperando);
  if (duvidas) {
    itens.push({
      id: 'duvidas', count: duvidas, to: '/treino?aba=duvidas',
      label: plural(duvidas, 'dúvida de treino esperando você', 'dúvidas de treino esperando você'),
    });
  }

  const treinos = numero(fontes.treinosNaoLidos);
  if (treinos) {
    itens.push({
      id: 'treinos', count: treinos, to: '/treino?aba=recebidos',
      label: plural(treinos, 'treino recebido para ver', 'treinos recebidos para ver'),
    });
  }

  // Só chega aqui quem ligou o balanço do jogo para si (flag `game_debrief`).
  const balancos = numero(fontes.balancosPendentes);
  if (balancos) {
    itens.push({
      id: 'balancos', count: balancos, to: '/treino?aba=balanco',
      label: plural(balancos, 'jogo esperando o seu balanço', 'jogos esperando o seu balanço'),
    });
  }

  return itens;
}

/** O ano em que a conta foi criada (o "Membro desde"), ou `null`. */
export function memberSince(profile) {
  const ts = profile?.created_at;
  const date = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date.getFullYear();
}
