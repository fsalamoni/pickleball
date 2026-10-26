/**
 * CONFORMIDADE E TRANSPARÊNCIA DO CLUBE-ASSOCIAÇÃO (Bloco F3) — lógica pura, zero banco.
 *
 * É a lista do que o Código Civil (arts. 53–61) e a boa governança pedem de uma associação,
 * conferida contra o que já está na plataforma: estatuto, mandatos, eleição, conselho fiscal,
 * assembleia, contas e orçamento. Cada item diz `ok`, `attention` (dá para resolver, e a aba que
 * resolve vai junto) ou `unknown` (a fonte não carregou ou a pessoa não a lê). Sem dado NUNCA é
 * reprovado: a plataforma não sabe o que o clube guarda fora dela. É aviso, não trava.
 *
 * A régua de documentos publicados é a mesma da federação (`transparencyChecklist`), com os
 * itens que fazem sentido para um clube. Mulheres na direção e atletas nos órgãos NÃO são
 * medidos aqui: o cadastro da diretoria do clube não guarda gênero (dado pessoal) nem vaga de
 * atleta, e inventar o número seria reprovar sem base.
 */
import { t, tk, fmtData } from '@/core/i18n';
import { DOC_VISIBILITY, TRANSPARENCY_ITEMS, docYear, isDocCurrent, sortDocs } from '@/modules/federations/domain/acervo';
import { convocationNotice } from '@/modules/federations/domain/meeting';
import { staffIsMaster } from './staff.js';

export const CLUB_COMPLIANCE_STATUS = Object.freeze({ OK: 'ok', ATTENTION: 'attention', UNKNOWN: 'unknown' });

/** Com o mandato a menos disto do fim, a eleição já deveria estar marcada. */
export const CLUB_ELECTION_LEAD_DAYS = 180;

const DAY = 86_400_000;
const hojeIso = (nowMs) => new Date(nowMs - 3 * 3_600_000).toISOString().slice(0, 10);
const somaDias = (iso, d) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * DAY).toISOString().slice(0, 10);
const br = (iso) => fmtData(new Date(`${iso}T12:00:00`));
const item = (id, label, basis, tab, status, detail) => ({ id, label, basis, tab, status, detail });

/** Os itens de transparência de um clube: os da federação que cabem numa associação. */
const BASE_CC = tk('Código Civil, art. 54');
const BOA = tk('Boa prática');
const ITENS_DO_CLUBE = {
  statute: BASE_CC, accounts: BASE_CC, fiscal: BOA, minutes: BOA, calendar: BOA, ethics: BOA, management: BOA, leaders: BOA,
};
export const CLUB_TRANSPARENCY_ITEMS = Object.freeze(
  TRANSPARENCY_ITEMS.filter((x) => ITENS_DO_CLUBE[x.id]).map((x) => Object.freeze({ ...x, basis: ITENS_DO_CLUBE[x.id] })),
);

/**
 * O que o clube deixou aberto a qualquer pessoa, item a item. `docs`: os documentos que a pessoa vê.
 * @returns {Array<{ id, label, basis, ok: boolean, doc: object|null }>}
 */
export function clubTransparencyChecklist(docs = [], { nowMs = Date.now() } = {}) {
  const anoMin = new Date(nowMs).getUTCFullYear() - 1;
  const vigentes = sortDocs((docs || []).filter((d) => isDocCurrent(d) && d.visibility === DOC_VISIBILITY.PUBLIC));
  return CLUB_TRANSPARENCY_ITEMS.map((x) => {
    const doc = vigentes.find((d) => x.types.includes(d.type) && (!x.fresh || (docYear(d) || 0) >= anoMin)) || null;
    return { id: x.id, label: x.label, basis: x.basis, ok: Boolean(doc), doc };
  });
}

/** A diretoria que manda no clube: quem tem o cargo master. */
const masters = (staff) => (staff || []).filter((s) => staffIsMaster(s));

/**
 * @param {{ club?: object, staff?: object[], docs?: object[], events?: object[], budgets?: object[], accountReports?: object[], elections?: object[], conveningMinDays?: number, nowMs?: number }} fontes
 *   Fonte ausente (undefined) = não carregou (ou a pessoa não a lê) ⇒ o item fica "não deu para conferir".
 * @returns {Array<{ id, label, basis, tab, status, detail }>}
 */
export function clubComplianceChecklist({ staff, docs, events, budgets, accountReports, elections, conveningMinDays, nowMs = Date.now() } = {}) {
  const hoje = hojeIso(nowMs);
  const ano = Number(hoje.slice(0, 4));
  const transp = Array.isArray(docs) ? clubTransparencyChecklist(docs, { nowMs }) : null;
  const doc = (id) => transp?.find((x) => x.id === id);
  const out = [];

  // 1. Estatuto publicado: a associação existe por ele (CC art. 54).
  out.push(item('statute', tk('Estatuto publicado'), BASE_CC, 'documentos', !transp ? 'unknown' : doc('statute')?.ok ? 'ok' : 'attention',
    !transp ? t('Não deu para ler os documentos.')
      : doc('statute')?.ok ? t('O estatuto vigente está ao alcance de quem visita a página.')
        : t('Publique o estatuto vigente em Documentos oficiais, aberto ao público.')));

  // 2. Mandatos: nenhum cargo vencido e a presidência com prazo.
  let fimMandato = '';
  if (!Array.isArray(staff)) {
    out.push(item('mandate', tk('Mandatos da diretoria'), tk('Boa prática'), 'equipe', 'unknown', t('Não deu para ler a diretoria.')));
  } else {
    const ms = masters(staff);
    const vencidos = staff.filter((s) => s.term_end_ms && Number(s.term_end_ms) <= nowMs);
    const comPrazo = ms.filter((s) => s.term_end_ms && Number(s.term_end_ms) > nowMs && /^\d{4}-\d{2}-\d{2}$/.test(String(s.term_end || '')));
    fimMandato = comPrazo.map((s) => s.term_end).sort()[0] || '';
    const semPrazo = ms.length > 0 && ms.every((s) => !s.term_end_ms);
    let status = 'ok';
    let detalhe = fimMandato ? t('O mandato da presidência vai até {fim}.', { fim: br(fimMandato) }) : t('Os mandatos estão em dia.');
    if (!staff.length) { status = 'attention'; detalhe = t('Nomeie a diretoria com início e fim de mandato em Equipe e mandatos.'); }
    else if (vencidos.length) { status = 'attention'; detalhe = t('{n} mandato(s) vencido(s): quem está com o prazo vencido perdeu as permissões. Prorrogue ou nomeie de novo.', { n: vencidos.length }); }
    else if (semPrazo) { status = 'attention'; detalhe = t('A presidência está sem prazo de mandato. Defina o fim para a sucessão não se perder.'); }
    out.push(item('mandate', tk('Mandatos da diretoria'), tk('Boa prática'), 'equipe', status, detalhe));
  }

  // 3. Eleição marcada antes do fim do mandato da presidência.
  const lbE = [tk('Eleição antes do fim do mandato'), tk('Boa prática')];
  if (!Array.isArray(elections)) out.push(item('election', ...lbE, 'eleicoes', 'unknown', t('Não deu para ler as eleições.')));
  else if (!fimMandato) out.push(item('election', ...lbE, 'equipe', 'unknown', t('Informe o fim do mandato da presidência para conferir a eleição.')));
  else {
    const desde = somaDias(fimMandato, -CLUB_ELECTION_LEAD_DAYS);
    const posse = (e) => e.calendar?.inauguration_on || e.calendar?.result_on || '';
    const valida = elections.filter((e) => !['draft', 'cancelled'].includes(e.status) && posse(e) >= desde)
      .sort((a, b) => posse(a).localeCompare(posse(b)))[0];
    if (valida) {
      out.push(item('election', ...lbE, 'eleicoes', 'ok', valida.status === 'closed'
        ? t('Eleição "{titulo}" concluída. Dê a posse aos eleitos e atualize os mandatos.', { titulo: valida.title })
        : t('Eleição "{titulo}" publicada, com resultado em {data}.', { titulo: valida.title, data: br(posse(valida)) })));
    } else if (hoje < desde) {
      out.push(item('election', ...lbE, 'eleicoes', 'ok', t('O mandato vai até {fim}. Publique o edital da eleição a partir de {data}.', { fim: br(fimMandato), data: br(desde) })));
    } else {
      out.push(item('election', ...lbE, 'eleicoes', 'attention', t('O mandato termina em {fim}. Publique o edital da eleição: a sucessão precisa estar resolvida antes.', { fim: br(fimMandato) })));
    }
  }

  // 4. Conselho fiscal nomeado (quem tem `fiscal` sem ser master: o conselho é autônomo da diretoria).
  if (!Array.isArray(staff)) {
    out.push(item('fiscal', tk('Conselho fiscal'), tk('Boa prática'), 'equipe', 'unknown', t('Não deu para ler a diretoria.')));
  } else {
    const fiscais = staff.filter((s) => !staffIsMaster(s) && (!s.term_end_ms || Number(s.term_end_ms) > nowMs)
      && (s.role_id === 'fiscal_council' || s.role === 'fiscal_council' || (Array.isArray(s.perms) && s.perms.includes('fiscal') && !s.perms.includes('admin')))).length;
    out.push(item('fiscal', tk('Conselho fiscal'), tk('Boa prática'), 'equipe', fiscais ? 'ok' : 'attention',
      fiscais ? t('{n} pessoa(s) no conselho fiscal.', { n: fiscais }) : t('Nomeie o conselho fiscal em Equipe e mandatos (cargo "Conselho fiscal"). O parecer dele vem antes da aprovação das contas.')));
  }

  // 5. Assembleia geral ordinária do ano, convocada com a antecedência do estatuto.
  if (!Array.isArray(events)) {
    out.push(item('assembly', tk('Assembleia geral ordinária'), tk('Código Civil, art. 59'), 'agenda', 'unknown', t('Não deu para ler a agenda.')));
  } else {
    const ago = events.filter((e) => e.type === 'assembly_ordinary' && e.status !== 'cancelled' && String(e.date || '').startsWith(String(ano)))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
    const aviso = ago && convocationNotice(ago, conveningMinDays);
    out.push(item('assembly', tk('Assembleia geral ordinária'), tk('Código Civil, art. 59'), 'agenda', ago && !aviso?.late ? 'ok' : 'attention',
      !ago ? t('Marque na agenda a assembleia ordinária de {ano}, que aprova as contas do ano anterior.', { ano })
        : aviso?.late ? t('Convocada com {d} dias de antecedência; o estatuto pede {min}.', { d: aviso.days, min: aviso.min })
          : aviso ? t('Marcada para {data}, convocada com {d} dias de antecedência.', { data: br(ago.date), d: aviso.days })
            : t('Marcada para {data}. Lembre de convocar com a antecedência do estatuto.', { data: br(ago.date) })));
  }

  // 6. Contas do ano anterior publicadas (já passaram pelo conselho fiscal e pela assembleia).
  const lbC = [tk('Contas do ano anterior'), BASE_CC];
  if (!Array.isArray(accountReports)) {
    out.push(item('accounts', ...lbC, 'prestacao', 'unknown', t('Não deu para ler as prestações de contas.')));
  } else {
    const rel = accountReports.find((r) => Number(r.year) === ano - 1);
    const ok = rel?.status === 'published' || Boolean(doc('accounts')?.ok);
    const fase = rel && !ok ? ({ draft: t('em rascunho'), submitted: t('com o conselho fiscal'), opinion: t('com parecer, esperando a aprovação'), approved: t('aprovada, falta publicar'), rejected: t('reprovada; refaça e envie de novo') }[rel.status] || '') : '';
    out.push(item('accounts', ...lbC, 'prestacao', ok ? 'ok' : 'attention',
      ok ? t('A prestação de contas de {ano} está publicada.', { ano: ano - 1 })
        : fase ? t('A prestação de contas de {ano} está {fase}.', { ano: ano - 1, fase })
          : t('Monte a prestação de contas de {ano}, passe pelo conselho fiscal e leve à assembleia.', { ano: ano - 1 })));
  }

  // 7. Orçamento do ano aprovado.
  const lbO = [tk('Orçamento do ano aprovado'), tk('Boa prática')];
  if (!Array.isArray(budgets)) out.push(item('budget', ...lbO, 'orcamento', 'unknown', t('Não deu para ler os orçamentos.')));
  else {
    const b = budgets.find((x) => Number(x.year) === ano && !x.copy_of);
    const ok = b && ['approved', 'published'].includes(b.status);
    out.push(item('budget', ...lbO, 'orcamento', ok ? 'ok' : 'attention',
      ok ? (b.status === 'published' ? t('O orçamento de {ano} está aprovado e publicado.', { ano }) : t('O orçamento de {ano} está aprovado. Publique-o na transparência.', { ano }))
        : b ? t('O orçamento de {ano} ainda não foi aprovado.', { ano }) : t('Monte o orçamento de {ano} e leve-o à aprovação.', { ano })));
  }

  // 8. Transparência: o que o clube deixou aberto.
  if (!transp) {
    out.push(item('transparency', tk('Transparência'), tk('Boa prática'), 'documentos', 'unknown', t('Não deu para ler os documentos.')));
  } else {
    const faltam = transp.filter((x) => !x.ok);
    out.push(item('transparency', tk('Transparência'), tk('Boa prática'), 'documentos', faltam.length ? 'attention' : 'ok',
      faltam.length ? t('{n} de {total} itens publicados. Falta: {lista}.', { n: transp.length - faltam.length, total: transp.length, lista: faltam.map((x) => t(x.label)).join(', ') })
        : t('Todos os {total} itens estão publicados.', { total: transp.length })));
  }

  return out;
}

/** Quantos itens em cada estado. */
export function clubComplianceSummary(items = []) {
  const n = (s) => items.filter((x) => x.status === s).length;
  return { ok: n('ok'), attention: n('attention'), unknown: n('unknown'), total: items.length };
}
