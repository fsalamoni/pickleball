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
import { FED_PERMISSION, STAFF_ROLE } from './constants';

export const COMPLIANCE_STATUS = Object.freeze({ OK: 'ok', ATTENTION: 'attention', UNKNOWN: 'unknown' });

/** Mandato máximo de dirigente (art. 36: até 4 anos, uma recondução). */
export const MANDATE_MAX_MONTHS = 48;

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const meses = (a, b) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
const br = (iso) => fmtData(new Date(`${iso}T12:00:00`));
const hojeIso = (nowMs) => new Date(nowMs - 3 * 3600_000).toISOString().slice(0, 10);

const item = (id, label, basis, tab, status, detail) => ({ id, label, basis, tab, status, detail });

/**
 * @param {{ federation: object, staff?: object[], docs?: object[], events?: object[], nowMs?: number }} fontes
 *   `staff`, `docs` e `events` ausentes (undefined) = não carregaram ⇒ o item fica "não deu para conferir".
 * @returns {Array<{ id, label, basis, tab, status, detail }>}
 */
export function complianceChecklist({ federation, staff, docs, events, nowMs = Date.now() } = {}) {
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
  if (!transp) {
    out.push(item('accounts', tk('Contas do ano anterior'), tk('Lei 14.597/2023, art. 63'), acervoOn ? 'acervo' : 'modulos', 'unknown',
      acervoOn ? t('Não deu para ler o acervo.') : t('Ligue o acervo oficial para publicar as demonstrações financeiras.')));
  } else {
    const ok = Boolean(doc('accounts')?.ok);
    const atrasado = hoje.slice(5) > '04-30';
    out.push(item('accounts', tk('Contas do ano anterior'), tk('Lei 14.597/2023, art. 63'), 'acervo', ok ? 'ok' : 'attention',
      ok ? t('As demonstrações financeiras estão publicadas.')
        : atrasado ? t('As demonstrações de {ano} deviam estar publicadas até o último dia útil de abril.', { ano: ano - 1 })
          : t('Publique as demonstrações de {ano} até o último dia útil de abril.', { ano: ano - 1 })));
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

  return out;
}

/** Quantos itens em cada estado. */
export function complianceSummary(items = []) {
  const n = (s) => items.filter((x) => x.status === s).length;
  return { ok: n('ok'), attention: n('attention'), unknown: n('unknown'), total: items.length };
}
