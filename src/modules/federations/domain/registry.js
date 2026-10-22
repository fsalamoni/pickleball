/**
 * O CADASTRO da federação por tipo (Etapa 3 do cadastro estruturado,
 * 2026-10-22): Central → "Filiados e cadastrados" tem uma aba por tipo
 * (Atletas, Professores, Árbitros, Clubes, Arenas e os tipos criados pelo
 * admin da plataforma) e cada pessoa ou entidade abre uma PASTA com tudo o
 * que é dela na federação.
 *
 * Zero banco: tudo aqui é conta sobre o que a Central já lê (filiações,
 * planos) e sobre as leituras da pasta (cobranças, documentos, cursos,
 * credenciais, sanções, pontos, escalas, transferências). Fonte que não
 * carregou chega `undefined` e fica de fora — nunca vira "nada".
 */
import { t, tk } from '@/core/i18n';
import { MEMBER_STATUS, PLAN_TIER } from './constants.js';
import { isOrgEntity, memberTypeOf } from './memberTypes.js';
import { instanteDoDiaEmMs } from '@/core/domain/instant';

export const REGISTRY_ALL = 'todos';

/** O vínculo: filiado (pago) ou cadastrado (gratuito). `federated` é o valor gravado. */
export const REGISTRY_BOND = Object.freeze({ ALL: 'todos', FEDERATED: PLAN_TIER.FEDERATED, REGISTERED: PLAN_TIER.REGISTERED });
export const REGISTRY_BOND_LABELS = Object.freeze({ todos: tk('Todos'), federated: tk('Filiados'), registered: tk('Cadastrados') });

/** O id do tipo de uma filiação. Filiação antiga sem tipo é de atleta; entidade sem tipo é o próprio clube/arena. */
export function memberTypeIdOf(member) {
  if (member?.person_type) return member.person_type;
  return isOrgEntity(member?.org_kind) ? member.org_kind : 'athlete';
}

/** Filiado ou cadastrado. Filiação antiga sem nível conta como filiado (era o único nível). */
export const memberBond = (member) => (member?.tier === PLAN_TIER.REGISTERED ? PLAN_TIER.REGISTERED : PLAN_TIER.FEDERATED);

/** Entra na lista do cadastro: o pedido fica em Pedidos; cancelada e recusada saem. */
export const inRegistry = (member) => Boolean(member) && ![MEMBER_STATUS.PENDING, MEMBER_STATUS.CANCELLED, MEMBER_STATUS.REJECTED].includes(member.status);

/**
 * As abas de tipo: "Todos" e cada tipo do catálogo que está LIGADO, ou que
 * tem gente ou plano (tipo desligado com filiados continua tendo a sua aba —
 * desligar impede plano novo, não esconde quem já é filiado). Tipo gravado
 * que saiu do catálogo também aparece, com o nome gravado.
 * @returns {Array<{ id: string, type: object|null, count: number, plans: number }>}
 */
export function registryTabs(catalog = [], members = [], plans = []) {
  const vivos = members.filter(inRegistry);
  const contaPorTipo = new Map();
  vivos.forEach((m) => { const id = memberTypeIdOf(m); contaPorTipo.set(id, (contaPorTipo.get(id) || 0) + 1); });
  const planosPorTipo = new Map();
  plans.forEach((p) => { const id = p?.person_type || 'athlete'; planosPorTipo.set(id, (planosPorTipo.get(id) || 0) + 1); });
  const tipos = [...catalog];
  // Tipo usado por filiação ou plano mas que não está mais no catálogo.
  [...contaPorTipo.keys(), ...planosPorTipo.keys()].forEach((id) => {
    if (!tipos.some((x) => x.id === id)) {
      const fonte = vivos.find((m) => memberTypeIdOf(m) === id) || plans.find((p) => (p?.person_type || 'athlete') === id) || { person_type: id };
      tipos.push(memberTypeOf(catalog, fonte));
    }
  });
  const abas = tipos
    .filter((x) => x.active !== false || contaPorTipo.get(x.id) || planosPorTipo.get(x.id))
    .map((x) => ({ id: x.id, type: x, count: contaPorTipo.get(x.id) || 0, plans: planosPorTipo.get(x.id) || 0 }));
  return [{ id: REGISTRY_ALL, type: null, count: vivos.length, plans: plans.length }, ...abas];
}

/** A lista de uma aba, com o filtro de vínculo. */
export function registryList(members = [], { tipo = REGISTRY_ALL, vinculo = REGISTRY_BOND.ALL } = {}) {
  return members.filter(inRegistry)
    .filter((m) => tipo === REGISTRY_ALL || memberTypeIdOf(m) === tipo)
    .filter((m) => vinculo === REGISTRY_BOND.ALL || memberBond(m) === vinculo);
}

/** Quantos filiados e quantos cadastrados (sobre a lista já filtrada pelo tipo). */
export function bondCounts(members = []) {
  const out = { todos: members.length, federated: 0, registered: 0 };
  members.forEach((m) => { out[memberBond(m)] += 1; });
  return out;
}

/** Os planos de um tipo, os ativos primeiro. */
export function plansOfType(plans = [], tipo) {
  return plans.filter((p) => (p?.person_type || 'athlete') === tipo)
    .sort((a, b) => Number(b.active !== false) - Number(a.active !== false) || String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
}

/**
 * Os blocos da pasta. Todos têm Resumo, Cobranças, Documentos e Histórico.
 * Pessoa: Cursos e credenciais, Sanções, Pontos (atleta, ou quem já pontuou)
 * e Arbitragem (árbitro, ou quem está no quadro). Entidade: Entidade
 * (representantes, pessoas, torneios sediados) e Sanções.
 * @param {object} member
 * @param {object} type o tipo resolvido (`memberTypeOf`)
 * @param {{ hasPoints?: boolean, rostered?: boolean }} [extra]
 */
export function folderBlocks(member, type, { hasPoints = false, rostered = false } = {}) {
  const org = isOrgEntity(member?.org_kind) || isOrgEntity(type?.entity);
  const blocos = ['resumo', 'cobrancas', 'documentos'];
  if (org) blocos.push('entidade');
  else {
    blocos.push('cursos');
    if (type?.category === 'athlete' || hasPoints) blocos.push('pontos');
    if (type?.category === 'referee' || rostered) blocos.push('arbitragem');
  }
  blocos.push('sancoes', 'historico');
  return blocos;
}

// Data sem hora (`issued_at`, `starts_at`) vale o dia local, não 21h do dia anterior.
const ms = (v) => instanteDoDiaEmMs(v) || null;

/**
 * O HISTÓRICO da pasta: os fatos datados de cada fonte, do mais novo ao mais
 * antigo. A filiação guarda só a ÚLTIMA data de cada mudança (pedido,
 * decisão, ativação, suspensão…); pagamentos, documentos, transferências,
 * sanções, cursos, credenciais, pontos e escalas entram um por um.
 * @returns {Array<{ at: number, kind: string, text: string }>}
 */
export function memberTimeline(member, fontes = {}) {
  if (!member) return [];
  const ev = [];
  const add = (at, kind, text) => { const m = ms(at); if (m) ev.push({ at: m, kind, text }); };
  add(member.imported_at_ms, 'filiacao', t('Importado pela secretaria'));
  add(member.requested_at_ms || member.requested_at, 'filiacao', t('Pediu a filiação no plano {plano}', { plano: member.plan_name || '—' }));
  if (member.decided_at_ms && member.status !== MEMBER_STATUS.REJECTED) add(member.decided_at_ms, 'filiacao', t('Pedido aprovado'));
  if (member.status === MEMBER_STATUS.REJECTED) add(member.decided_at_ms, 'filiacao', t('Pedido recusado'));
  add(member.activated_at_ms, 'filiacao', t('Filiação ativada (última ativação ou renovação)'));
  add(member.suspended_at_ms, 'filiacao', t('Filiação suspensa'));
  add(member.reinstated_at_ms, 'filiacao', t('Filiação reintegrada'));
  add(member.cancelled_at_ms, 'filiacao', t('Filiação encerrada'));
  (fontes.charges || []).forEach((c) => {
    if (c.paid_at_ms || c.paid_at) add(c.paid_at_ms || c.paid_at, 'pagamento', t('Pagamento confirmado: {oque}', { oque: c.plan_name || c.description || c.origin || '' }));
    else if (c.declared_at) add(c.declared_at, 'pagamento', t('Informou o pagamento de uma cobrança'));
  });
  (fontes.documents || []).forEach((d) => add(d.created_at_ms || d.created_at, 'documento', t('Enviou um documento: {nome}', { nome: d.label || d.file_name || d.kind || '' })));
  (fontes.transfers || []).forEach((tr) => add(tr.requested_at_ms, 'transferencia', t('Transferência pedida')));
  (fontes.sanctions || []).forEach((s) => add(s.created_at_ms || s.created_at || s.starts_at, 'sancao', t('Sanção registrada')));
  (fontes.enrollments || []).forEach((e) => add(e.created_at_ms || e.created_at, 'curso', t('Inscreveu-se no curso {curso}', { curso: e.course_name || '' })));
  (fontes.credentials || []).forEach((c) => add(c.issued_at || c.created_at_ms || c.created_at, 'credencial', t('Recebeu a credencial {curso}', { curso: c.course_name || '' })));
  (fontes.points || []).forEach((p) => add(p.created_at_ms || p.updated_at_ms, 'pontos', t('{n} pontos em {torneio}', { n: Number(p.points) || 0, torneio: p.tournament_name || '' })));
  (fontes.assignments || []).forEach((a) => add(a.created_at_ms, 'arbitragem', t('Escalado(a) para {evento}', { evento: a.event?.name || '' })));
  return ev.sort((a, b) => b.at - a.at);
}

/**
 * Os pontos do atleta nesta federação, por ano: soma dos lançamentos que
 * valem (cancelado fica de fora, mas aparece na lista com o motivo).
 * @returns {Array<{ season: number, total: number, items: object[] }>}
 */
export function pointsBySeason(points = []) {
  const porAno = new Map();
  points.forEach((p) => {
    const ano = Number(p.season) || 0;
    if (!porAno.has(ano)) porAno.set(ano, { season: ano, total: 0, items: [] });
    const g = porAno.get(ano);
    g.items.push(p);
    if (p.status !== 'cancelled') g.total += Number(p.points) || 0;
  });
  return [...porAno.values()].sort((a, b) => b.season - a.season)
    .map((g) => ({ ...g, items: g.items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))) }));
}

/**
 * As pessoas da entidade cruzadas com o cadastro da federação: cada membro do
 * clube (ou gestor da arena) com a filiação que ele tem AQUI, se tiver.
 * @returns {Array<{ uid: string, name: string, photo: string, role: string, member: object|null }>}
 */
export function orgPeopleWithMembership(people = [], members = []) {
  const porUid = new Map(members.filter((m) => m.user_id && inRegistry(m)).map((m) => [m.user_id, m]));
  const vistos = new Set();
  return people.filter((p) => p?.user_id && !vistos.has(p.user_id) && vistos.add(p.user_id))
    .map((p) => ({ uid: p.user_id, name: p.user_name || '', photo: p.user_photo || '', role: p.role || '', member: porUid.get(p.user_id) || null }))
    .sort((a, b) => Number(Boolean(b.member)) - Number(Boolean(a.member)) || a.name.localeCompare(b.name, 'pt-BR'));
}
