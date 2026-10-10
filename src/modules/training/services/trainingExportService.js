/**
 * O que a exportação de dados (LGPD) leva do Centro de Treino — e das metas.
 *
 * Cada parte é lida pelo campo que a REGRA confere (`author_uid`, `uid`,
 * `from_uid`/`to_uid`, `asker_uid`/`coach_uid`, `reporter_uid`) e falha
 * SOZINHA: o que não veio entra em `incomplete`, e a exportação diz o que
 * ficou de fora — nunca entrega um arquivo "completo" com um buraco calado.
 *
 * Fica de fora, de propósito: os comentários que um PROFESSOR fez no diário
 * dos alunos. Eles moram no diário de outra pessoa, e a consulta só por
 * `shared_coach_id` não é provável pela regra (que confere o vínculo ativo
 * aluno a aluno).
 */
import { listMyItems } from './trainingItemService.js';
import { listComments, listMySessions } from './sessionService.js';
import { listMyPlans } from './planService.js';
import { listMyDebriefs } from './debriefService.js';
import { getMeta } from './metaService.js';
import { listInbox, listSent } from './shareService.js';
import { listCoachQuestions, listMessages, listMyQuestions } from './questionService.js';
import { listMyReports } from './reportService.js';
import { listMyUploadPaths } from './mediaUploadService.js';
import { listGoals } from '@/modules/progression/services/goalService';

/** Cada filho (comentário, mensagem) falha sozinho; o pai vem mesmo assim. */
async function comFilhos(pais, buscar, campo) {
  const r = await Promise.allSettled(pais.map((p) => buscar(p.id)));
  const falhou = r.some((x) => x.status === 'rejected');
  return {
    lista: pais.map((p, i) => ({ ...p, [campo]: r[i].status === 'fulfilled' ? r[i].value : null })),
    falhou,
  };
}

/**
 * @param {string} uid
 * @returns {Promise<{ training: object, goals: object[]|undefined, incomplete: string[] }>}
 */
export async function collectTrainingExport(uid) {
  const incomplete = [];
  const partes = [
    ['items', 'Itens de treino que você criou', () => listMyItems(uid)],
    ['sessions', 'Diário de treino', () => listMySessions(uid)],
    ['plans', 'Planos de treino', () => listMyPlans(uid)],
    ['debriefs', 'Balanços dos jogos', () => listMyDebriefs(uid)],
    ['meta', 'Rotina e preferências do treino', () => getMeta(uid)],
    ['sent', 'Treinos que você enviou', () => listSent(uid)],
    ['received', 'Treinos que você recebeu', () => listInbox(uid)],
    ['asked', 'Dúvidas que você fez', () => listMyQuestions(uid)],
    ['answered', 'Dúvidas que você recebeu como professor', () => listCoachQuestions(uid)],
    ['reports', 'Denúncias que você fez', () => listMyReports(uid)],
    ['media', 'Lista de fotos e vídeos de treino enviados', () => listMyUploadPaths(uid)],
    ['goals', 'Metas pessoais', () => listGoals(uid)],
  ];
  const lidas = await Promise.allSettled(partes.map(([, , ler]) => ler()));
  const v = {};
  partes.forEach(([chave, rotulo], i) => {
    if (lidas[i].status === 'fulfilled') v[chave] = lidas[i].value;
    else incomplete.push(rotulo);
  });

  const sessoes = await comFilhos(v.sessions || [], listComments, 'comments');
  if (sessoes.falhou) incomplete.push('Comentários do diário de treino');
  const perguntas = [...(v.asked || []), ...(v.answered || [])];
  const duvidas = await comFilhos(perguntas, listMessages, 'messages');
  if (duvidas.falhou) incomplete.push('Mensagens das dúvidas');

  return {
    training: {
      items: v.items || [],
      sessions: sessoes.lista,
      plans: v.plans || [],
      debriefs: v.debriefs || [],
      meta: v.meta || null,
      shares: { sent: v.sent || [], received: v.received || [] },
      questions: duvidas.lista,
      reports: v.reports || [],
      media_paths: v.media || [],
    },
    goals: v.goals,
    incomplete,
  };
}
