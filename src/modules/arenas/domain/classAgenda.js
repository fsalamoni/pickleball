/**
 * A agenda de aulas, do ponto de vista de quem olha.
 *
 * A mesma lista de aulas responde a perguntas diferentes:
 *
 * | Quem | Próximas | Passadas |
 * |---|---|---|
 * | **Arena** | todas, inclusive as canceladas (com o selo) | todas — é onde se registra o pagamento de quem já teve aula |
 * | **Professor** | as DELE | as DELE — os alunos que ele atendeu |
 * | **Atleta** | as abertas + as suas (a cancelada aparece com o motivo) | só as suas — é o histórico dele |
 *
 * 🐞 Antes a lista trazia só aulas `scheduled`: marcar como "dada" fazia a
 * aula SUMIR — e com ela o botão de registrar o pagamento de quem estava lá.
 * E o aviso de cancelamento levava o aluno a uma tela onde a aula cancelada
 * não aparecia, com o motivo que a arena escreveu escondido.
 *
 * PURO. Sem I/O.
 */
import { CLASS_STATUS, isClassOpen } from './classes.js';

export const AGENDA_ROLE = Object.freeze({
  ARENA: 'arena',
  COACH: 'coach',
  ATHLETE: 'athlete',
});

const chave = (a) => `${a?.date || ''}${a?.start || ''}`;
const asc = (a, b) => chave(a).localeCompare(chave(b));
const desc = (a, b) => chave(b).localeCompare(chave(a));

/**
 * Separa a agenda em próximas e passadas, conforme quem olha.
 *
 * @param {Array<object>} aulas
 * @param {{ hoje: string, role: string, coachId?: string|null, myClassIds?: Set<string>|Array<string> }} opts
 * @returns {{ futuras: Array<object>, passadas: Array<object> }}
 */
export function splitClassAgenda(aulas = [], { hoje, role = AGENDA_ROLE.ATHLETE, coachId = null, myClassIds } = {}) {
  const minhas = myClassIds instanceof Set ? myClassIds : new Set(myClassIds || []);
  const dia = String(hoje || '');
  let base = (aulas || []).filter(Boolean);

  if (role === AGENDA_ROLE.COACH) base = base.filter((a) => coachId && a.coach_id === coachId);

  const futuras = [];
  const passadas = [];
  base.forEach((a) => {
    const passou = String(a.date || '') < dia;
    if (role === AGENDA_ROLE.ATHLETE) {
      const souAluno = minhas.has(a.id);
      if (passou) {
        if (souAluno) passadas.push(a);
      } else if (isClassOpen(a) || souAluno) {
        futuras.push(a);
      }
      return;
    }
    (passou ? passadas : futuras).push(a);
  });

  return { futuras: futuras.sort(asc), passadas: passadas.sort(desc) };
}

/**
 * As próximas aulas com vaga, para a página da arena — a vitrine.
 *
 * @param {Array<object>} aulas
 * @param {{ hoje: string, limit?: number }} opts
 */
export function nextOpenClasses(aulas = [], { hoje, limit = 3 } = {}) {
  const dia = String(hoje || '');
  return (aulas || [])
    .filter((a) => a && isClassOpen(a) && String(a.date || '') >= dia)
    .sort(asc)
    .slice(0, Math.max(0, Number(limit) || 0));
}

/**
 * As matrículas da pessoa em todas as arenas, prontas para listar.
 *
 * A matrícula não guarda data nem horário (moram na aula), então a linha junta
 * as duas. Matrícula cuja aula sumiu (apagada pela arena) sai da lista: não há
 * o que mostrar, e uma linha "aula desconhecida" só confunde.
 *
 * Ordem: as que vêm pela frente, da mais próxima; depois as passadas, da mais
 * recente — quem abre "minhas aulas" quer saber primeiro a próxima.
 *
 * @param {Array<object>} bookings           `arena_class_bookings` da pessoa
 * @param {Map<string, object>} aulasPorId   `arena_classes` por id
 * @param {Map<string, object>} arenasPorId  `arenas` por id
 * @param {string} hoje                       AAAA-MM-DD
 */
export function enrollmentRows(bookings = [], aulasPorId = new Map(), arenasPorId = new Map(), hoje = '') {
  const dia = String(hoje || '');
  const linhas = (bookings || [])
    .map((b) => {
      const aula = aulasPorId.get(b?.class_id);
      if (!aula) return null;
      return {
        key: b.id,
        booking: b,
        aula,
        arenaId: aula.arena_id || b.arena_id,
        arenaName: arenasPorId.get(aula.arena_id || b.arena_id)?.name || 'Arena',
        upcoming: String(aula.date || '') >= dia,
        cancelled: aula.status === CLASS_STATUS.CANCELLED,
        given: aula.status === CLASS_STATUS.COMPLETED,
      };
    })
    .filter(Boolean);
  const vindo = linhas.filter((l) => l.upcoming).sort((a, b) => asc(a.aula, b.aula));
  const foi = linhas.filter((l) => !l.upcoming).sort((a, b) => desc(a.aula, b.aula));
  return [...vindo, ...foi];
}

/**
 * As aulas que o professor DÁ, em todas as arenas, para a agenda dele.
 *
 * @param {Array<{ arena_id: string, id: string }>} perfis  cadastros dele em `arena_coaches`
 * @param {Map<string, Array<object>>} aulasPorPerfil       aulas por id de cadastro
 * @param {Map<string, object>} arenasPorId
 * @param {string} hoje
 * @returns {{ proximas: Array<object>, passadas: Array<object> }}
 */
export function taughtClassRows(perfis = [], aulasPorPerfil = new Map(), arenasPorId = new Map(), hoje = '') {
  const dia = String(hoje || '');
  const linhas = [];
  (perfis || []).forEach((p) => {
    (aulasPorPerfil.get(p.id) || []).forEach((aula) => {
      linhas.push({
        key: aula.id,
        aula,
        arenaId: p.arena_id,
        arenaName: arenasPorId.get(p.arena_id)?.name || 'Arena',
        cancelled: aula.status === CLASS_STATUS.CANCELLED,
        given: aula.status === CLASS_STATUS.COMPLETED,
      });
    });
  });
  return {
    proximas: linhas.filter((l) => String(l.aula.date || '') >= dia && !l.cancelled)
      .sort((a, b) => asc(a.aula, b.aula)),
    passadas: linhas.filter((l) => String(l.aula.date || '') < dia)
      .sort((a, b) => desc(a.aula, b.aula)),
  };
}
