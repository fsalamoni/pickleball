/**
 * RELATÓRIO ANUAL DE ATIVIDADES (Central → Indicadores → Relatório anual,
 * Bloco 5): o retrato do ano para a assembleia e para a transparência —
 * diretoria, filiados, competições, ranking, cursos, disciplina, finanças e
 * conformidade —, montado SÓ com o que a Central já leu. Zero banco.
 *
 * Fonte que não carregou (`undefined`) vira "não deu para conferir", NUNCA
 * zero (docs/27): o relatório vai para uma assembleia e um zero falso ali é
 * uma afirmação sobre a federação. Bloco de módulo desligado não aparece.
 *
 * Nada pessoal sai da disciplina nem da ouvidoria: só contagens.
 */
import { t, tk, fmtNumero } from '@/core/i18n';
import { CHARGE_ORIGIN_LABELS, COURSE_KIND_LABELS, DISCIPLINE_KIND_LABELS, MEMBER_STATUS, SANCTION_STATUS } from './constants';
import { fedModuleOn } from './federation';
import { formatBrlCents } from './charges';
import { membershipState, toISODate } from './membership';
import { personTypeLabel } from './memberTypes';
import { womenQuota } from './governance';
import { prizeParity } from './competitions';
import { SANCTION_ORIGIN } from './sanction';
import { ACCOUNT_REPORT_STATUS, ACCOUNT_REPORT_STATUS_LABELS, chargePaidDate } from './accounts';
import { complianceSummary } from './compliance';

/** Os anos que o relatório oferece: o atual e os quatro anteriores. */
export function annualReportYears(nowMs = Date.now()) {
  const ano = new Date(nowMs - 3 * 3600_000).getUTCFullYear();
  return Array.from({ length: 5 }, (_, i) => ano - i);
}

const doAno = (iso, ano) => String(iso || '').slice(0, 4) === String(ano);
const num = (n) => fmtNumero(n);
const linha = (label, value) => ({ label, value });
const br = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

function contarPor(itens, chave, rotulo) {
  const mapa = new Map();
  itens.forEach((x) => { const k = chave(x) || ''; mapa.set(k, (mapa.get(k) || 0) + 1); });
  return [...mapa.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => linha(rotulo(k), num(n)));
}

function secao(id, title, { rows = [], list = [], listTitle = '', note = '', missing = [] } = {}) {
  return { id, title, rows, list, listTitle, note, missing };
}

/**
 * @param {{ federation: object, year: number, members?: object[], charges?: object[], tournaments?: object[],
 *   results?: object[], ranking?: object|null, courses?: object[], reports?: object[], sanctions?: object[],
 *   accountReports?: object[], compliance?: object[], nowMs?: number }} fontes
 * @returns {{ year: number, federation: object, sections: Array<{ id, title, rows, list, listTitle, note, missing: string[] }> }}
 */
export function annualReport({ federation, year, members, charges, tournaments, results, ranking, courses, reports, sanctions, accountReports, compliance, nowMs = Date.now() } = {}) {
  const f = federation || {};
  const g = f.governance || {};
  const ano = Number(year);
  const atual = ano === annualReportYears(nowMs)[0];
  const sections = [];

  // 1. Diretoria.
  const board = Array.isArray(g.board) ? g.board : [];
  const q = womenQuota(g);
  sections.push(secao('governance', tk('Diretoria e governança'), {
    rows: [
      linha(t('Mandato'), g.mandate?.start && g.mandate?.end ? t('de {ini} a {fim}', { ini: br(g.mandate.start), fim: br(g.mandate.end) }) : t('não informado')),
      linha(t('Mulheres na direção'), q.women == null ? t('não informado') : t('{n} de {total} cargos', { n: q.women, total: q.total })),
    ],
    listTitle: tk('Composição'),
    list: board.map((b) => linha(b.role, b.name)),
    note: board.length ? '' : t('A diretoria não está cadastrada em Transparência.'),
  }));

  // 2. Filiados.
  if (Array.isArray(members)) {
    const emDia = members.filter((m) => membershipState(m).status === MEMBER_STATUS.ACTIVE);
    // O número da filiação (SIGLA-ANO-000001) é fixo desde a emissão: o ANO dele é o ano em que a pessoa entrou.
    const novos = members.filter((m) => String(m.member_number || '').split('-')[1] === String(ano));
    const naoRenovou = members.filter((m) => { const st = membershipState(m); return st.status === MEMBER_STATUS.EXPIRED && doAno(st.validUntil, ano); });
    sections.push(secao('members', tk('Filiados'), {
      rows: [
        linha(atual ? t('Em dia hoje') : t('Em dia hoje (o retrato do ano passado não é guardado)'), num(emDia.length)),
        linha(t('Entraram em {ano}', { ano }), num(novos.length)),
        linha(t('Venceram em {ano} sem renovar', { ano }), num(naoRenovou.length)),
        linha(t('Dependentes (menores de 12) em dia'), num(emDia.filter((m) => m.guardian_uid).length)),
      ],
      listTitle: tk('Em dia, por tipo'),
      list: contarPor(emDia, (m) => m.person_type || 'athlete', (k) => personTypeLabel(emDia.find((m) => (m.person_type || 'athlete') === k))),
    }));
  } else {
    sections.push(secao('members', tk('Filiados'), { missing: [t('filiados')] }));
  }

  // 3. Competições (módulo de torneios).
  if (fedModuleOn(f, 'tournaments')) {
    const rows = [];
    const missing = [];
    if (Array.isArray(tournaments)) {
      const ch = tournaments.filter((x) => x?.federation_sanction?.status === SANCTION_STATUS.APPROVED && doAno(x.starts_at, ano));
      const declarados = ch.filter((x) => ['equal', 'none', 'unequal'].includes(prizeParity(x.federation_sanction.prize).state));
      rows.push(
        linha(t('Torneios chancelados'), num(ch.length)),
        linha(t('Realizados pela própria federação'), num(ch.filter((x) => x.federation_sanction.origin === SANCTION_ORIGIN.FEDERATION).length)),
        linha(t('Com premiação igual entre gêneros'), declarados.length ? t('{n} de {total} que declararam', { n: declarados.filter((x) => prizeParity(x.federation_sanction.prize).state !== 'unequal').length, total: declarados.length }) : t('nenhum declarou')),
      );
    } else missing.push(t('torneios'));
    if (Array.isArray(results)) {
      const doAnoR = results.filter((r) => Number(r.season) === ano && r.status !== 'rejected');
      const atletas = new Set(doAnoR.flatMap((r) => (r.rows || []).map((x) => x.uid).filter(Boolean)));
      rows.push(linha(t('Categorias com resultado enviado'), num(doAnoR.length)), linha(t('Atletas com colocação'), num(atletas.size)));
    } else missing.push(t('resultados'));
    sections.push(secao('competitions', tk('Competições'), { rows, missing }));
  }

  // 4. Ranking oficial (o topo do geral).
  if (fedModuleOn(f, 'ranking')) {
    if (ranking === undefined) sections.push(secao('ranking', tk('Ranking oficial'), { missing: [t('ranking')] }));
    else {
      const topo = (ranking?.general || []).slice(0, 5);
      sections.push(secao('ranking', tk('Ranking oficial'), {
        rows: [linha(t('Atletas no ranking'), num((ranking?.general || []).length))],
        listTitle: tk('Os cinco primeiros do geral'),
        list: topo.map((l) => linha(`${l.position}º`, t('{nome} · {pontos} pontos', { nome: l.name, pontos: num(l.points) }))),
        note: ranking ? '' : t('Nenhum resultado foi enviado ao ranking em {ano}.', { ano }),
      }));
    }
  }

  // 5. Cursos.
  if (fedModuleOn(f, 'courses')) {
    if (Array.isArray(courses)) {
      const c = courses.filter((x) => doAno(toISODate(x.starts_at), ano) && !['draft', 'cancelled'].includes(x.status));
      const feitos = c.filter((x) => x.status === 'done');
      sections.push(secao('courses', tk('Cursos e formação'), {
        rows: [
          linha(t('Cursos no ano'), num(c.length)),
          linha(t('Concluídos'), num(feitos.length)),
          linha(t('Inscritos'), num(c.reduce((s, x) => s + (Number(x.enrolled_count) || 0), 0))),
          linha(t('Horas de formação oferecidas'), num(feitos.reduce((s, x) => s + (Number(x.hours) || 0), 0))),
        ],
        listTitle: tk('Por tipo'),
        list: contarPor(c, (x) => x.kind, (k) => (COURSE_KIND_LABELS[k] ? t(COURSE_KIND_LABELS[k]) : k)),
      }));
    } else sections.push(secao('courses', tk('Cursos e formação'), { missing: [t('cursos')] }));
  }

  // 6. Disciplina e ouvidoria (só contagens, nunca nomes).
  if (fedModuleOn(f, 'discipline')) {
    const rows = [];
    const missing = [];
    let list = [];
    if (Array.isArray(reports)) {
      const r = reports.filter((x) => doAno(toISODate(x.created_at), ano));
      rows.push(linha(t('Manifestações recebidas'), num(r.length)), linha(t('Encerradas'), num(r.filter((x) => x.status === 'closed').length)));
    } else missing.push(t('ouvidoria'));
    if (Array.isArray(sanctions)) {
      const s = sanctions.filter((x) => doAno(toISODate(x.created_at_ms), ano));
      rows.push(linha(t('Sanções aplicadas'), num(s.length)), linha(t('Recursos julgados'), num(s.filter((x) => x.appeal_decision).length)));
      list = contarPor(s, (x) => x.kind, (k) => (DISCIPLINE_KIND_LABELS[k] ? t(DISCIPLINE_KIND_LABELS[k]) : k));
    } else missing.push(t('sanções'));
    sections.push(secao('discipline', tk('Disciplina e ouvidoria'), { rows, list, listTitle: tk('Sanções por tipo'), missing }));
  }

  // 7. Finanças: a prestação de contas do ano, quando enviada; senão, o que entrou pela plataforma.
  const prest = Array.isArray(accountReports) ? accountReports.find((r) => String(r.period) === String(ano) && r.status && r.status !== ACCOUNT_REPORT_STATUS.DRAFT && r.snapshot) : null;
  if (prest) {
    const s = prest.snapshot;
    sections.push(secao('finance', tk('Finanças'), {
      rows: [
        linha(t('Receitas'), formatBrlCents(s.income_total)),
        linha(t('Despesas'), formatBrlCents(s.expense_total)),
        linha(t('Resultado'), formatBrlCents(s.balance)),
        linha(t('Prestação de contas'), t(ACCOUNT_REPORT_STATUS_LABELS[prest.status] || prest.status)),
      ],
      note: t('Valores congelados na prestação de contas de {ano}.', { ano }),
    }));
  } else if (Array.isArray(charges)) {
    const pagas = charges.filter((c) => c.status === 'paid' && doAno(chargePaidDate(c), ano));
    const porOrigem = new Map();
    pagas.forEach((c) => porOrigem.set(c.origin, (porOrigem.get(c.origin) || 0) + (Number(c.amount_cents) || 0)));
    sections.push(secao('finance', tk('Finanças'), {
      rows: [linha(t('Recebido pela plataforma'), formatBrlCents(pagas.reduce((s, c) => s + (Number(c.amount_cents) || 0), 0))), linha(t('Cobranças pagas'), num(pagas.length))],
      listTitle: tk('Por origem'),
      list: [...porOrigem.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => linha(CHARGE_ORIGIN_LABELS[k] ? t(CHARGE_ORIGIN_LABELS[k]) : k, formatBrlCents(v))),
      note: t('Só o que foi cobrado pela plataforma. A prestação de contas de {ano} ainda não foi enviada.', { ano }),
    }));
  } else {
    sections.push(secao('finance', tk('Finanças'), { missing: [t('cobranças')] }));
  }

  // 8. Conformidade (o estado de hoje).
  if (Array.isArray(compliance)) {
    const s = complianceSummary(compliance);
    sections.push(secao('compliance', tk('Conformidade'), {
      rows: [linha(t('Itens em dia'), t('{n} de {total}', { n: s.ok, total: s.total })), linha(t('Pedem atenção'), num(s.attention)), linha(t('Não deu para conferir'), num(s.unknown))],
      listTitle: tk('O que pede atenção'),
      list: compliance.filter((x) => x.status === 'attention').map((x) => linha(t(x.label), t(x.basis))),
      note: t('A situação de hoje, não a do fim do ano.'),
    }));
  }

  return {
    year: ano,
    federation: { name: f.name || '', acronym: f.acronym || '', cnpj: f.cnpj_masked || '', city: [f.city, f.state].filter(Boolean).join(' / '), logo: f.branding?.logo_url || '' },
    sections,
  };
}
