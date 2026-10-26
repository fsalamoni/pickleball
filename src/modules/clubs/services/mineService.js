/**
 * O que os clubes-associação guardam da PRÓPRIA pessoa — I/O (Bloco G).
 *
 * O navegador não consulta "todos os clubes de uma vez" (as espécies moram sob
 * `club_x/{clube}/…`), então a leitura é do servidor (`clubMine`), sempre pelo uid de quem
 * chama. `pending` alimenta o "Precisa de você" da Minha área; `export` alimenta a exportação
 * de dados (LGPD). Nada é gravado.
 */
import { chamar } from './associationService.js';

/** @returns {Promise<{ clubs: object[], incomplete: boolean, failed: number }>} */
export const fetchMyClubData = (scope = 'pending') => chamar('clubMine', { scope }, { timeout: 60_000 });

/**
 * A parte dos clubes na exportação de dados. Um clube que não pôde ser lido (`incomplete`) vai
 * escrito no arquivo — nunca um arquivo "completo" com buraco.
 * @returns {Promise<{ clubs: object[], incomplete: string[] }>}
 */
export async function collectClubExport() {
  const r = await fetchMyClubData('export');
  return { clubs: r.clubs || [], incomplete: r.incomplete ? ['Associações em clubes'] : [] };
}
