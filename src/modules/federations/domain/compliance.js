/**
 * Conformidade da federação (Central → Indicadores → Conformidade): o que a
 * Lei Geral do Esporte (Lei 14.597/2023) e a boa governança pedem a uma
 * entidade de administração do esporte, conferido contra o que já está na
 * plataforma — diretoria, mandato, equipe, agenda, acervo e módulos.
 *
 * Zero banco: só lê o que a Central já carregou. Cada item diz `ok`,
 * `attention` (dá para resolver, e a aba que resolve vai junto) ou `unknown`
 * (a fonte não carregou ou não está ligada). Sem dado NUNCA é reprovado — a
 * plataforma não sabe o que a federação guarda fora dela. É aviso, não trava.
 */
import { t, tk, fmtData } from '@/core/i18n';
import { womenQuota } from './governance';
import { transparencyChecklist } from './acervo';
import { convocationNotice } from './meeting';
import { normalizeFederationRules, fedModuleOn } from './federation';
import { staffPerms } from './staff';
import { FED_PERMISSION, SANCTION_STATUS, STAFF_ROLE } from './constants';
import { prizeParity } from './competitions';

export const COMPLIANCE_STATUS = Object.freeze({ OK: 'ok', ATTENTION: 'attention', UNKNOWN: 'unknown' });

/** Mandato máximo de dirigente (art. 36: até 4 anos, uma recondução). */
export const MANDATE_MAX_MONTHS = 48;

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const meses = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
const br = (iso) => fmtData(new Date(`${iso}T12:00:00`));
const hojeIso = (nowMs) => new Date(nowMs - 3 * 3600_000).toISOString().slice(0, 10);

const item = (id, label, basis, tab, status, detail) => ({ id, label, basis, tab, status, detail });

/** Com o mandato a menos disto do fim, a eleição já deveria estar marcada. */
export const ELECTION_LEAD_DAYS = 180;
const somaDias = (iso, d) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86400000).toISOString().slice(0, 10);

/**
 * @param {{ federation: object, staff?: object[], docs?: object[], events?: object[], budgets?: object[], accountReports?: object[], elections?: object[], tournaments?: object[], nowMs?: number }} fontes
 *   Fonte ausente (undefined) = não carregou ⇒ o item fica "não deu para conferir".
 *   `budgets`/`accountReports` só valem com o módulo `accounts`; `elections` com `elections`;
 *   `tournaments` (os torneios com a federação) dá a isonomia de premiação.
 * @returns {Array<{ id, label, basis, tab, status, detail }>}
 */
export function complianceChecklist({ federation, staff, docs, events, budgets, accountReports, elections, tournaments, nowMs = Date.now() } = {}) {
  const f = federation || {};
  const g = f.governance || {};
  const hoje = hojeIso(nowMs);
  const ano = Number(hoje.slice(0, 4));
  const acervoOn = fedModuleOn(f, 'official_docs');
  const transp = acervoOn && Array.isArray(docs) ? transparencyChecklist(docs, { nowMs }) : null;
  const doc = (id) => transp?.find((x) => x.id === id);
  const out = [];

  // 1. Estatuto publicado.
  const temEstatuto = Boolean(g.statute_url) || Boolean(doc('statute')?.ok);
  out.push(item('statute', tk('Estatuto publicado'), tk('Lei 14.597/2023, art. 36, § 4º, I'), acervoOn ? 'acervo' : 'governanca',
    temEstatuto ? 'ok' : (transp || !acervoOn ? 'attention' : 'unknown'),
    temEstatuto ? t('O estatuto vigente está ao alcance de quem visita a página.') : t('Publique o estatuto vigente no acervo ou informe o link em Transparência.')));

  // 2. Mulheres na direção (no mínimo 30%).
  const q = womenQuota(g);
  out.push(item('women', tk('Mulheres na direção'), tk('Lei 14.597/2023, art. 36, IX'), 'governanca',
    q.status === 'ok' ? 'ok' : 'attention',
    q.status === 'empty' ? t('Cadastre a diretoria em Transparência para conferir o mínimo de 30%.')
      : q.status === 'unknown' ? t('Diga quantas mulheres ocupam os {total} cargos: a lei pede no mínimo {min}.', { total: q.total, min: q.min })
        : t('{n} de {total} cargos com mulheres (mínimo {min}).', { n: q.women, total: q.total, min: q.min })));

  // 3. Mandato da diretoria: informado, até 4 anos e em vigor.
  const ini = DATA.test(String(g.mandate?.start || '')) ? g.mandate.start : '';
  const fim = DATA.test(String(g.mandate?.end || '')) ? g.mandate.end : '';
  let mStatus = 'ok';
  let mDetail = t('Mandato de {ini} a {fim}.', { ini: br(ini), fim: br(fim) });
  if (!ini || !fim) { mStatus = 'attention'; mDetail = t('Informe o início e o fim do mandato da diretoria em Transparência.'); }
  else if (meses(ini, fim) > MANDATE_MAX_MONTHS) { mStatus = 'attention'; mDetail = t('O mandato informado passa de 4 anos ({n} meses). A lei permite até 4 anos, com uma recondução.', { n: meses(ini, fim) }); }
  else if (fim < hoje) { mStatus = 'attention'; mDetail = t('O mandato terminou em {fim}. Registre a nova diretoria ou a eleição.', { fim: br(fim) }); }
  out.push(item('mandate', tk('Mandato da diretoria'), tk('Lei 14.597/2023, art. 36, I'), 'governanca', mStatus, mDetail));

  // 3a. Eleição marcada antes do fim do mandato (módulo de eleições).
  if (fedModuleOn(f, 'elections')) {
    const lb = [tk('Eleição antes do fim do mandato'), tk('Lei 14.597/2023, art. 36, I e X, h')];
    if (!fim) out.push(item('election', ...lb, 'governanca', 'unknown', t('Informe o fim do mandato em Transparência para conferir a eleição.')));
    else if (!Array.isArray(elections)) out.push(item('election', ...lb, 'eleicoes', 'unknown', t('Não deu para ler as eleições.')));
    else {
      const desde = somaDias(fim, -ELECTION_LEAD_DAYS);
      const posse = (e) => e.calendar?.inauguration_on || e.calendar?.result_on || '';
      const valida = elections.filter((e) => !['draft', 'cancelled'].includes(e.status) && posse(e) >= desde)
        .sort((a, b) => posse(a).localeCompare(posse(b)))[0];
      if (valida) {
        out.push(item('election', ...lb, 'eleicoes', 'ok', valida.status === 'closed'
          ? t('Eleição "{titulo}" concluída. Atualize a diretoria e o novo mandato em Transparência.', { titulo: valida.title })
          : t('Eleição "{titulo}" publicada, com resultado em {data}.', { titulo: valida.title, data: br(posse(valida)) })));
      } else if (hoje < desde) {
        out.push(item('election', ...lb, 'eleicoes', 'ok', t('O mandato vai até {fim}. Publique o edital da eleição a partir de {data}.', { fim: br(fim), data: br(desde) })));
      } else {
        out.push(item('election', ...lb, 'eleicoes', 'attention', fim < hoje
          ? t('O mandato terminou em {fim} e não há eleição publicada para a sucessão.', { fim: br(fim) })
          : t('O mandato termina em {fim}. Publique o edital da eleição: a sucessão precisa estar resolvida antes.', { fim: br(fim) })));
      }
    }
  }

  // 4. Conselho fiscal nomeado (quem tem `fiscal` sem ser admin — o conselho é autônomo da diretoria).
  if (!Array.isArray(staff)) {
    out.push(item('fiscal', tk('Conselho fiscal'), tk('Lei 14.597/2023, art. 36, X, f'), 'equipe', 'unknown', t('Não deu para ler a equipe.')));
  } else {
    const fiscais = staff.filter((s) => {
      const p = staffPerms(s, nowMs);
      return s.role === STAFF_ROLE.FISCAL_COUNCIL || (p.includes(FED_PERMISSION.FISCAL) && !p.includes(FED_PERMISSION.ADMIN));
    }).length;
    out.push(item('fiscal', tk('Conselho fiscal'), tk('Lei 14.597/2023, art. 36, X, f'), 'equipe', fiscais ? 'ok' : 'attention',
      fiscais ? t('{n} pessoa(s) no conselho fiscal.', { n: fiscais }) : t('Nomeie o conselho fiscal na Equipe (cargo "Conselho fiscal"). O parecer dele vem antes da aprovação das contas.')));
  }

  // 5. Assembleia geral ordinária do ano, convocada com a antecedência do estatuto.
  if (!fedModuleOn(f, 'calendar')) {
    out.push(item('assembly', tk('Assembleia geral ordinária'), tk('Lei 14.597/2023, art. 36, X, j'), 'modulos', 'unknown', t('Ligue o calendário oficial para publicar e convocar as assembleias.')));
  } else if (!Array.isArray(events)) {
    out.push(item('assembly', tk('Assembleia geral ordinária'), tk('Lei 14.597/2023, art. 36, X, j'), 'agenda', 'unknown', t('Não deu para ler a agenda.')));
  } else {
    const ago = events.filter((e) => e.type === 'assembly_ordinary' && e.status !== 'cancelled' && String(e.date || '').startsWith(String(ano)))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
    const aviso = ago && convocationNotice(ago, normalizeFederationRules(f.rules).convocation_min_days);
    out.push(item('assembly', tk('Assembleia geral ordinária'), tk('Lei 14.597/2023, art. 36, X, j'), 'agenda',
      ago && !aviso?.late ? 'ok' : 'attention',
      !ago ? t('Marque na agenda pública a assembleia ordinária de {ano}, que aprova as contas do ano anterior.', { ano })
        : aviso?.late ? t('Convocada com {d} dias de antecedência; o estatuto pede {min}.', { d: aviso.days, min: aviso.min })
          : aviso ? t('Marcada para {data}, convocada com {d} dias de antecedência.', { data: br(ago.date), d: aviso.days })
            : t('Marcada para {data}. Lembre de convocar com a antecedência do estatuto.', { data: br(ago.date) })));
  }

  // 6. Demonstrações financeiras do ano anterior publicadas até abril.
  // Com o módulo de contas, vale a prestação de contas publicada (já passou pelo
  // conselho fiscal); senão, o documento do acervo.
  const contasOn = fedModuleOn(f, 'accounts');
  const atrasado = hoje.slice(5) > '04-30';
  if (contasOn && Array.isArray(accountReports)) {
    const rel = accountReports.find((r) => Number(r.year) === ano - 1);
    const ok = rel?.status === 'published' || Boolean(doc('accounts')?.ok);
    const fase = rel && !ok ? ({ draft: t('em rascunho'), submitted: t('com o conselho fiscal'), opinion: t('com parecer, esperando a aprovação'), approved: t('aprovada, falta publicar'), rejected: t('reprovada; refaça e envie de novo') }[rel.status] || '') : '';
    out.push(item('accounts', tk('Contas do ano anterior'), tk('Lei 14.597/2023, art. 63'), 'prestacao-contas', ok ? 'ok' : 'attention',
      ok ? t('A prestação de contas de {ano} está publicada.', { ano: ano - 1 })
        : fase ? t('A prestação de contas de {ano} está {fase}.', { ano: ano - 1, fase })
          : atrasado ? t('As demonstrações de {ano} deviam estar publicadas até o último dia útil de abril.', { ano: ano - 1 })
            : t('Publique as demonstrações de {ano} até o último dia útil de abril.', { ano: ano - 1 })));
  } else if (!transp) {
    out.push(item('accounts', tk('Contas do ano anterior'), tk('Lei 14.597/2023, art. 63'), acervoOn ? 'acervo' : 'modulos', 'unknown',
      acervoOn ? t('Não deu para ler o acervo.') : t('Ligue o acervo oficial para publicar as demonstrações financeiras.')));
  } else {
    const ok = Boolean(doc('accounts')?.ok);
    out.push(item('accounts', tk('Contas do ano anterior'), tk('Lei 14.597/2023, art. 63'), 'acervo', ok ? 'ok' : 'attention',
      ok ? t('As demonstrações financeiras estão publicadas.')
        : atrasado ? t('As demonstrações de {ano} deviam estar publicadas até o último dia útil de abril.', { ano: ano - 1 })
          : t('Publique as demonstrações de {ano} até o último dia útil de abril.', { ano: ano - 1 })));
  }

  // 6a. Orçamento do ano aprovado (módulo de contas).
  if (contasOn) {
    const lb = [tk('Orçamento do ano aprovado'), tk('Boa prática (Lei 14.597/2023, art. 36, X, f)')];
    if (!Array.isArray(budgets)) out.push(item('budget', ...lb, 'orcamento-anual', 'unknown', t('Não deu para ler os orçamentos.')));
    else {
      const b = budgets.find((x) => Number(x.year) === ano && !x.copy_of);
      const ok = b && ['approved', 'published'].includes(b.status);
      out.push(item('budget', ...lb, 'orcamento-anual', ok ? 'ok' : 'attention',
        ok ? (b.status === 'published' ? t('O orçamento de {ano} está aprovado e publicado.', { ano }) : t('O orçamento de {ano} está aprovado. Publique-o na transparência.', { ano }))
          : b ? t('O orçamento de {ano} ainda não foi aprovado.', { ano }) : t('Monte o orçamento de {ano} e leve-o à aprovação.', { ano })));
    }
  }

  // 7. Transparência: o que a lei manda publicar (os itens de "boa prática" não contam aqui).
  if (!transp) {
    out.push(item('transparency', tk('Página de transparência'), tk('Lei 14.597/2023, art. 36, § 4º'), acervoOn ? 'transparencia' : 'modulos', 'unknown',
      acervoOn ? t('Não deu para ler o acervo.') : t('Ligue o acervo oficial para montar a página de transparência.')));
  } else {
    const leis = transp.filter((x) => !/^Boa prática/.test(x.basis));
    const faltam = leis.filter((x) => !x.ok);
    out.push(item('transparency', tk('Página de transparência'), tk('Lei 14.597/2023, art. 36, § 4º'), 'transparencia', faltam.length ? 'attention' : 'ok',
      faltam.length ? t('{n} de {total} itens publicados. Falta: {lista}.', { n: leis.length - faltam.length, total: leis.length, lista: faltam.map((x) => t(x.label)).join(', ') })
        : t('Todos os {total} itens que a lei pede estão publicados.', { total: leis.length })));
  }

  // 8. Canal de manifestação (ouvidoria) e processo disciplinar.
  const disc = fedModuleOn(f, 'discipline');
  out.push(item('ombudsman', tk('Ouvidoria e disciplina'), tk('Boa prática (Lei 14.597/2023, art. 59)'), 'modulos', disc ? 'ok' : 'attention',
    disc ? t('Filiados e público têm canal de manifestação, com protocolo.') : t('Ligue o módulo de disciplina: ele abre a ouvidoria com protocolo e o processo com defesa.')));

  // 9. Atletas representados na direção.
  const board = Array.isArray(g.board) ? g.board : [];
  const temAtleta = board.some((b) => /atleta/i.test(String(b?.role || '')));
  out.push(item('athletes', tk('Atletas na direção'), tk('Lei 14.597/2023, art. 36, X, h'), 'governanca', temAtleta ? 'ok' : 'attention',
    temAtleta ? t('A diretoria tem cargo de representante dos atletas.') : t('Inclua na diretoria o representante dos atletas (a lei pede atletas nos órgãos e no colégio eleitoral).')));

  // 10. Isonomia de premiação entre gêneros nos torneios chancelados do ano.
  const lp = [tk('Premiação igual entre gêneros'), tk('Lei 14.597/2023, art. 36, IX; Lei 14.611/2023')];
  if (!Array.isArray(tournaments)) {
    out.push(item('prize_equality', ...lp, 'chancelas', 'unknown', t('Não deu para ler os torneios chancelados.')));
  } else {
    const doAno = tournaments.filter((x) => x?.federation_sanction?.status === SANCTION_STATUS.APPROVED
      && String(x.starts_at || '').slice(0, 4) === String(ano));
    const desiguais = doAno.filter((x) => prizeParity(x.federation_sanction.prize).state === 'unequal');
    const declarados = doAno.filter((x) => ['equal', 'none', 'unequal'].includes(prizeParity(x.federation_sanction.prize).state));
    if (desiguais.length) {
      out.push(item('prize_equality', ...lp, 'chancelas', 'attention', t('{n} torneio(s) chancelado(s) em {ano} com premiação diferente entre feminino e masculino: {lista}.', { n: desiguais.length, ano, lista: desiguais.slice(0, 3).map((x) => x.name).join(', ') })));
    } else if (declarados.length) {
      out.push(item('prize_equality', ...lp, 'chancelas', 'ok', t('Os {n} torneios chancelados em {ano} que declararam a premiação pagam igual.', { n: declarados.length, ano })));
    } else {
      out.push(item('prize_equality', ...lp, 'chancelas', 'unknown', doAno.length
        ? t('Nenhum torneio chancelado em {ano} declarou a premiação por gênero. O organizador informa no pedido de chancela.', { ano })
        : t('Nenhum torneio chancelado em {ano} ainda.', { ano })));
    }
  }

  // 11. Proteção de crianças e adolescentes (curso e certidão de quem trabalha com menores).
  const sg = fedModuleOn(f, 'safeguarding');
  out.push(item('safeguarding', tk('Proteção de crianças e adolescentes'), tk('Boa prática (ECA, Lei 8.069/1990)'), sg ? 'protecao' : 'modulos', sg ? 'ok' : 'attention',
    sg ? t('Professores, árbitros e diretores que trabalham com menores precisam do curso de proteção e da certidão conferida.') : t('Ligue o módulo de proteção de menores: ele exige curso e certidão de antecedentes de quem trabalha com crianças e abre a denúncia prioritária.')));

  return out;
}

/** Quantos itens em cada estado. */
export function complianceSummary(items = []) {
  const n = (s) => items.filter((x) => x.status === s).length;
  return { ok: n('ok'), attention: n('attention'), unknown: n('unknown'), total: items.length };
}
