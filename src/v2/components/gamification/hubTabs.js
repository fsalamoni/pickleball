import { Gift, Route, Swords, Target, Users } from 'lucide-react';

/** As abas do hub, na ordem em que uma pessoa nova as aprende. `modules`: some se TODOS estiverem desligados. */
export const HUB_TABS = [
  { id: 'jornada', label: 'Jornada', icon: Route, dica: 'aba-jornada' },
  { id: 'missoes', label: 'Missões', icon: Target, dica: 'aba-missoes' },
  { id: 'competir', label: 'Competir', icon: Swords, dica: 'aba-competir' },
  { id: 'social', label: 'Social', icon: Users, dica: 'aba-social', modules: ['match_reviews', 'partner_letters', 'social_bonds'] },
  { id: 'recompensas', label: 'Recompensas', icon: Gift, dica: 'aba-recompensas', modules: ['rewards'] },
];

/** Nomes antigos e atalhos dos avisos: `?aba=duelo` leva a Competir etc. */
export const HUB_TAB_ALIAS = {
  duelo: 'competir', desafios: 'competir', temporada: 'competir',
  avaliacoes: 'social', cartas: 'social', reputacao: 'social',
  convite: 'jornada', primeiros: 'jornada', revisao: 'jornada',
};

/** A aba pedida pela URL, ou a Jornada — nunca em branco. */
export function abaDaUrl(valor, abasDisponiveis = HUB_TABS) {
  const v = HUB_TAB_ALIAS[valor] || valor;
  return abasDisponiveis.some((a) => a.id === v) ? v : 'jornada';
}
