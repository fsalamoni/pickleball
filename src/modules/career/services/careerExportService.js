/**
 * O que a exportação de dados (LGPD) leva da Minha carreira: os torneios de
 * fora e a lista das fotos enviadas (`carreira/{uid}/`). Cada parte falha
 * SOZINHA e vai para `incomplete` — nunca um arquivo "completo" com buraco.
 * Entra sempre, com a flag ligada ou não: o que a pessoa registrou é dela.
 */
import { tk } from '@/core/i18n';
import { listCareerEvents, listMyCareerPhotoPaths } from './careerService.js';

/** @returns {Promise<{ career: object, incomplete: string[] }>} `incomplete` em `tk` (a tela traduz). */
export async function collectCareerExport(uid) {
  const partes = [
    ['events', tk('Torneios de fora (Minha carreira)'), () => listCareerEvents(uid)],
    ['photos', tk('Lista das fotos da Minha carreira'), () => listMyCareerPhotoPaths(uid)],
  ];
  const lidas = await Promise.allSettled(partes.map(([, , ler]) => ler()));
  const career = {};
  const incomplete = [];
  partes.forEach(([chave, rotulo], i) => {
    if (lidas[i].status === 'fulfilled') career[chave] = lidas[i].value;
    else incomplete.push(rotulo);
  });
  return { career, incomplete };
}
