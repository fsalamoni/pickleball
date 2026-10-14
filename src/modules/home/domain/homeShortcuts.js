/**
 * Os ATALHOS da tela inicial e a frase de abertura (lógica pura).
 *
 * O atalho certo é o que poupa telas: quem gere uma arena vai DIRETO à
 * Central dela (não à lista de arenas), quem organiza vai ao "criar torneio",
 * quem joga vai ao "procura-se jogo". Um atalho genérico ("Arenas") que abre
 * uma lista para a pessoa achar de novo a própria arena é uma tela a mais — o
 * contrário do que esta tela existe para fazer.
 *
 * A ordem segue a das frentes (`resolveHomeFoci`): primeiro o atalho PRINCIPAL
 * de cada frente, depois os secundários — assim as três frentes mais
 * importantes nunca ficam sem porta por causa de uma frente com muitos atalhos.
 */
import { HOME_FOCUS } from './homeProfile.js';
import { NAV_ROTULOS } from '../../../core/domain/navRotulos.js';
import { agendaDayLabel } from './homeAgenda.js';
import { diasAte } from './freshness.js';
import { t, tn } from '@/core/i18n';

/** Quantos atalhos cabem sem virar um menu. */
export const SHORTCUTS_MAX = 8;

/**
 * @param {Array<{ focus: string }>} foci
 * @param {{
 *   arenas?: Array<{ id: string, name?: string, pending?: number }>,
 *   ehProfessor?: boolean,
 *   isPlatformAdmin?: boolean,
 *   arenasDesconhecidas?: boolean,     leitura das arenas falhou
 *   professorDesconhecido?: boolean,   leitura do perfil de professor falhou
 * }} [ctx]
 *
 * ⚠️ Falha não é "não tem": com a leitura das arenas falhando, "Cadastrar
 * minha arena" convidaria a criar uma DUPLICADA — o atalho vira "Minhas
 * arenas". Idem para o professor.
 * @returns {Array<{ id, label, hint, to, icon, badge? }>}
 */
export function homeShortcuts(foci = [], ctx = {}) {
  // Vocabulário da navegação: a tela pode passar `rotulos`; sem ele, o padrão.
  const rotulos = { ...NAV_ROTULOS, ...(ctx.rotulos || {}) };
  const arenas = (ctx.arenas || []).filter((a) => a?.id).slice(0, 2);
  const porFrente = {
    [HOME_FOCUS.ARENA]: arenas.length > 0
      ? arenas.map((a) => ({
        id: `arena:${a.id}`,
        label: arenas.length > 1 ? (a.name || t('Minha arena')) : t('Central da arena'),
        hint: a.pending > 0
          ? tn(a.pending, '{n} pedido esperando', '{n} pedidos esperando')
          : (a.name || t('Reservas, agenda e gestão')),
        to: `/arenas/${a.id}/gerir`,
        icon: 'Building2',
        badge: a.pending > 0 ? a.pending : undefined,
      }))
      : ctx.arenasDesconhecidas
        ? [{ id: 'arena:lista', label: t('Minhas arenas'), hint: t('Arenas e reservas'), to: '/arenas', icon: 'Building2' }]
        : [{ id: 'arena:criar', label: t('Cadastrar minha arena'), hint: t('Quadras, horários e reservas'), to: '/arenas/criar', icon: 'Building2' }],
    [HOME_FOCUS.ENSINAR]: (ctx.ehProfessor || ctx.professorDesconhecido)
      ? [{ id: 'professor', label: t('Painel do professor'), hint: t('Aulas, alunos e agenda'), to: '/aulas', icon: 'GraduationCap' }]
      : [{ id: 'professor:ativar', label: t('Ativar perfil de professor'), hint: t('Receba pedidos de aula'), to: '/perfil/editar', icon: 'GraduationCap' }],
    [HOME_FOCUS.ORGANIZAR]: [
      { id: 'torneio:criar', label: t('Criar torneio'), hint: t('Do rascunho à inscrição'), to: '/torneios/criar', icon: 'ClipboardList' },
      { id: 'torneio:meus', label: rotulos.meusTorneios, hint: t('Gestão de cada um'), to: '/perfil/torneios', icon: 'Trophy' },
    ],
    [HOME_FOCUS.COMPETIR]: [
      { id: 'torneios', label: t('Torneios abertos'), hint: t('Inscreva-se'), to: '/torneios', icon: 'Trophy' },
    ],
    [HOME_FOCUS.JOGAR]: [
      { id: 'procura-jogo', label: rotulos.vagas, hint: t('Jogos com vaga'), to: '/procura-jogo', icon: 'Megaphone' },
      { id: 'dia-de-jogo:criar', label: t('Criar dia de jogo'), hint: t('Monte a rodada'), to: '/dia-de-jogo?criar=1', icon: 'Dices' },
      { id: 'jogadores', label: rotulos.pessoas, hint: t('Do seu nível'), to: '/encontrar-jogadores', icon: 'Users' },
    ],
    [HOME_FOCUS.TREINAR]: [
      { id: 'treino', label: t('Treino de hoje'), hint: t('Rotina, biblioteca e diário'), to: '/treino', icon: 'Dumbbell' },
    ],
    [HOME_FOCUS.RESERVAR]: [
      { id: 'reservar', label: t('Reservar quadra'), hint: t('Horários livres'), to: '/arenas', icon: 'CalendarCheck' },
      { id: 'reservas', label: t('Minhas reservas'), hint: t('Pedidos e confirmadas'), to: '/minhas-reservas', icon: 'CalendarClock' },
    ],
    [HOME_FOCUS.APRENDER]: [
      { id: 'professores', label: t('Encontrar professor'), hint: t('Aulas e clínicas'), to: '/coaches', icon: 'GraduationCap' },
      { id: 'minhas-aulas', label: t('Minhas aulas'), hint: t('Agenda de aulas'), to: '/minhas-aulas', icon: 'CalendarClock' },
    ],
    [HOME_FOCUS.CLUBES]: [
      { id: 'clubes', label: t('Meus clubes'), hint: t('Eventos e comunidade'), to: '/clubes', icon: 'Users' },
    ],
    [HOME_FOCUS.RANKING]: [
      { id: 'ranking', label: t('Ranking'), hint: t('Sua posição'), to: '/ranking', icon: 'Medal' },
      { id: 'duplas', label: t('Ranking de duplas'), hint: t('Suas parcerias'), to: '/ranking/duplas', icon: 'Handshake' },
      { id: 'desempenho', label: t('Meu desempenho'), hint: t('Evolução e jogos'), to: '/meu-desempenho', icon: 'TrendingUp' },
    ],
    [HOME_FOCUS.COMUNIDADE]: [
      { id: 'comunidade', label: t('Comunidade'), hint: t('Novidades'), to: '/novidades', icon: 'Zap' },
      { id: 'atletas', label: t('Atletas'), hint: t('Diretório'), to: '/atletas', icon: 'Users' },
    ],
  };

  const listas = (foci || []).map((f) => porFrente[f.focus] || []);
  const saida = [];
  const vistos = new Set();
  const incluir = (s) => {
    if (!s || vistos.has(s.to) || saida.length >= SHORTCUTS_MAX) return;
    vistos.add(s.to);
    saida.push(s);
  };
  // Rodadas: o 1º atalho de cada frente, depois o 2º, depois o 3º.
  const rodadas = Math.max(0, ...listas.map((l) => l.length));
  for (let i = 0; i < rodadas; i += 1) listas.forEach((l) => incluir(l[i]));
  if (ctx.isPlatformAdmin) {
    // O admin tem a porta dele sempre — no lugar do último, se lotou.
    const admin = { id: 'admin', label: t('Painel admin'), hint: t('Plataforma'), to: '/admin/painel', icon: 'LayoutDashboard' };
    if (!vistos.has(admin.to)) {
      if (saida.length >= SHORTCUTS_MAX) saida.pop();
      saida.push(admin);
    }
  }
  return saida;
}

/** "Bom dia", "Boa tarde", "Boa noite" pela hora local. */
export function saudacao(agora = new Date()) {
  const h = (agora instanceof Date ? agora : new Date(agora)).getHours();
  if (h < 5) return t('Boa noite');
  if (h < 12) return t('Bom dia');
  if (h < 18) return t('Boa tarde');
  return t('Boa noite');
}

/**
 * A frase de abertura: o que a pessoa tem pela frente, em uma linha.
 *
 * Com a agenda incompleta (alguma fonte falhou ou ainda carrega), a frase NÃO
 * afirma "agenda livre" — diz o que sabe e para por aí.
 *
 * @param {{ agenda: Array<object>, hoje: string, completa: boolean, acoes?: number }} input
 * @returns {string|null}
 */
export function frasePrincipal({ agenda = [], hoje, completa = true, acoes = 0 } = {}) {
  const deHoje = agenda.filter((i) => i.dia === hoje);
  const pendente = acoes > 0
    ? ` ${tn(acoes, 'Um item pede a sua ação.', '{n} itens pedem a sua ação.')}`
    : '';
  if (deHoje.length > 0) {
    const primeiro = deHoje.find((i) => i.hora) || deHoje[0];
    const frase = primeiro.hora
      ? tn(deHoje.length, 'Hoje você tem um compromisso — o primeiro às {hora}.', 'Hoje você tem {n} compromissos — o primeiro às {hora}.', { hora: primeiro.hora })
      : tn(deHoje.length, 'Hoje você tem um compromisso.', 'Hoje você tem {n} compromissos.');
    return `${frase}${pendente}`;
  }
  if (agenda.length > 0) {
    const prox = agenda[0];
    const quando = agendaDayLabel(prox.dia, hoje);
    const amanha = diasAte(prox.dia, hoje) === 1;
    let frase;
    if (amanha) {
      frase = prox.hora
        ? t('Nada marcado para hoje. O próximo é amanhã, às {hora}.', { hora: prox.hora })
        : t('Nada marcado para hoje. O próximo é amanhã.');
    } else {
      frase = prox.hora
        ? t('Nada marcado para hoje. O próximo é em {quando}, às {hora}.', { quando, hora: prox.hora })
        : t('Nada marcado para hoje. O próximo é em {quando}.', { quando });
    }
    return `${frase}${pendente}`;
  }
  if (!completa) return pendente.trim() || null;
  return `${t('Sua agenda está livre — que tal marcar um jogo?')}${pendente}`;
}
