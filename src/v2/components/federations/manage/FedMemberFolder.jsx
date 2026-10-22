/**
 * A PASTA do filiado ou cadastrado (Etapa 3 do cadastro estruturado): tudo o
 * que é da pessoa — ou do clube/arena — nesta federação, num lugar só.
 *
 * Os blocos saem de `folderBlocks` (o tipo decide: atleta tem Pontos, árbitro
 * tem Arbitragem, entidade tem Pessoas e torneios) e as leituras de
 * `useMemberFolder`, cada uma com a permissão que a regra exige: sem ela, o
 * bloco diz QUEM vê aquilo em vez de mostrar "não carregou".
 */
import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Award, CalendarClock, ExternalLink, FileText, GraduationCap, History, Scale, ShieldAlert, Trophy, Users, Wallet } from 'lucide-react';
import { useMemberFolder } from '@/modules/federations/hooks/useMemberFolder';
import { useFederationPlatformSettings, useFederationTournaments } from '@/modules/federations/hooks/useFederations';
import { folderBlocks, memberBond, memberTimeline, orgPeopleWithMembership, pointsBySeason } from '@/modules/federations/domain/registry';
import { memberTypeName, memberTypeOf, isOrgMember } from '@/modules/federations/domain/memberTypes';
import { membershipState } from '@/modules/federations/domain/membership';
import { sortChargesForStaff, formatBrlCents } from '@/modules/federations/domain/charges';
import { transferSummary } from '@/modules/federations/domain/transfers';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { levelLabel, normalizeRefereeRules, REFEREE_STATUS_LABELS } from '@/modules/federations/domain/referees';
import {
  CHARGE_STATUS, CREDENTIAL_STATUS_LABELS, DISCIPLINE_KIND_LABELS, DISCIPLINE_STATUS_LABELS, ENROLLMENT_STATUS_LABELS, FED_PERMISSION,
  MEMBER_STATUS, PLAN_TIER_LABELS, POINTS_CANCEL_REASON_LABELS, TRANSFER_KIND_LABELS, TRANSFER_STATUS_LABELS,
} from '@/modules/federations/domain/constants';
import { V2Avatar, V2BackLink, V2Badge, V2Button, V2ErrorState, V2Skeleton, V2Surface } from '@/v2/ui/primitives';
import { V2SubTabs } from '@/v2/ui/V2SectionNav';
import { t, tk, tn } from '@/core/i18n';
import { MemberStatusBadge, quando } from '../federationUi';
import FedReceiptDialog from '../FedReceipt';
import { AssignmentBadge, funcao, periodo } from '../referees/refUi';
import { ChargeRow } from './FedFinancePanel';
import { DocRow } from './FedSecretariatPanel';
import { DadosReservados, MemberActions } from './memberShared';

const BLOCO_META = {
  resumo: { label: tk('Resumo'), icon: Users },
  cobrancas: { label: tk('Cobranças e recibos'), icon: Wallet },
  documentos: { label: tk('Documentos'), icon: FileText },
  cursos: { label: tk('Cursos e credenciais'), icon: GraduationCap },
  pontos: { label: tk('Pontos'), icon: Trophy },
  arbitragem: { label: tk('Arbitragem'), icon: Scale },
  entidade: { label: tk('Pessoas e torneios'), icon: Users },
  sancoes: { label: tk('Sanções'), icon: ShieldAlert },
  historico: { label: tk('Histórico'), icon: History },
};
// O bloco só existe com o módulo dele ligado.
const MODULO_DO_BLOCO = { cursos: 'courses', pontos: 'ranking', arbitragem: 'referees', sancoes: 'discipline' };

/** Uma fonte da pasta: sem permissão diz quem vê; falha oferece tentar de novo; nunca afirma "nada" sem ter lido. */
function Fonte({ fonte, quem, children }) {
  if (!fonte.permitido) return <p className="rounded-2xl bg-paper px-4 py-3 text-sm text-gray-600">{t('Esta parte da pasta é só para {quem}.', { quem })}</p>;
  if (fonte.isError) return <V2ErrorState inline title={t('Esta parte não carregou')} onRetry={() => fonte.refetch()} />;
  if (fonte.isLoading) return <V2Skeleton lines={3} />;
  return children(fonte.data);
}

const Vazio = ({ children }) => <p className="text-sm text-gray-500">{children}</p>;

function Titulo({ children, acao = null }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-display text-lg font-bold text-ink">{children}</h3>
      {acao}
    </div>
  );
}

function Linha({ rotulo, children }) {
  return <div className="flex flex-wrap gap-x-2"><dt className="font-semibold text-gray-700">{rotulo}</dt><dd className="text-gray-700">{children}</dd></div>;
}

/* ------------------------------------------------------------- blocos -- */

function Resumo({ member: mb, type, fontes, documentos, perms, org }) {
  const st = membershipState(mb);
  const abertas = fontes.cobrancas.permitido && fontes.cobrancas.data ? fontes.cobrancas.data.filter((c) => [CHARGE_STATUS.OPEN, CHARGE_STATUS.DECLARED].includes(c.status)).length : null;
  const docsPendentes = documentos ? documentos.filter((d) => d.status === 'pending').length : null;
  const sancoes = fontes.sancoes.permitido && fontes.sancoes.data ? fontes.sancoes.data.filter((s) => s.status === 'active' || s.status === 'appealed').length : null;
  const anoAtual = new Date().getFullYear();
  const pontosAno = fontes.pontos.permitido && fontes.pontos.data ? (pointsBySeason(fontes.pontos.data).find((g) => g.season === anoAtual)?.total ?? 0) : null;
  const numeros = [
    abertas != null && { label: t('Cobranças em aberto'), valor: abertas },
    docsPendentes != null && { label: t('Documentos em análise'), valor: docsPendentes },
    sancoes != null && { label: t('Sanções em vigor'), valor: sancoes },
    pontosAno != null && { label: t('Pontos em {ano}', { ano: anoAtual }), valor: pontosAno },
  ].filter(Boolean);
  const podeReservado = !org && (perms.includes(FED_PERMISSION.MEMBERS) || perms.includes(FED_PERMISSION.ADMIN));
  return (
    <div className="space-y-5">
      {numeros.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {numeros.map((n) => <li key={n.label} className="rounded-2xl bg-paper px-3 py-2"><p className="font-display text-xl font-bold text-ink">{n.valor}</p><p className="text-xs text-gray-500">{n.label}</p></li>)}
        </ul>
      )}
      <section className="space-y-2">
        <Titulo>{t('Situação')}</Titulo>
        <dl className="grid gap-1 text-sm">
          <Linha rotulo={t('Tipo:')}>{memberTypeName(type)}</Linha>
          <Linha rotulo={t('Vínculo:')}>{t(PLAN_TIER_LABELS[memberBond(mb)])}</Linha>
          <Linha rotulo={t('Plano:')}>{mb.plan_name || '—'}</Linha>
          {mb.member_number && <Linha rotulo={t('Número:')}>{mb.member_number}</Linha>}
          <Linha rotulo={t('Situação:')}>{st.label}{st.validUntil ? ` · ${t('até {data}', { data: quando(st.validUntil) })}` : ''}</Linha>
          {mb.affiliated_since_ms && <Linha rotulo={t('Filiado desde:')}>{quando(mb.affiliated_since_ms)}</Linha>}
          {mb.club_name && <Linha rotulo={t('Clube representado:')}>{mb.club_name}</Linha>}
          {mb.guardian_uid && <Linha rotulo={t('Responsável:')}>{mb.guardian_name || t('responsável')}</Linha>}
          {org && <Linha rotulo={t('Representantes:')}>{(mb.representatives || []).map((r) => (r.role ? `${r.name} (${r.role})` : r.name)).join(', ') || mb.representative_name || '—'}</Linha>}
          {org && (mb.org_city || mb.org_state) && <Linha rotulo={t('Cidade:')}>{[mb.org_city, mb.org_state].filter(Boolean).join('/')}</Linha>}
          {mb.suspended_reason && mb.status === MEMBER_STATUS.SUSPENDED && <Linha rotulo={t('Motivo da suspensão:')}>{mb.suspended_reason}</Linha>}
          {mb.note && <Linha rotulo={t('Observação do pedido:')}>“{mb.note}”</Linha>}
        </dl>
      </section>
      {podeReservado && (
        <section className="space-y-2">
          <Titulo>{t('Dados reservados')}</Titulo>
          <DadosReservados member={mb} />
        </section>
      )}
    </div>
  );
}

function Cobrancas({ fonte, perms, federation }) {
  const [recibo, setRecibo] = useState(null);
  const decide = perms.includes(FED_PERMISSION.FINANCE) || perms.includes(FED_PERMISSION.ADMIN);
  return (
    <section className="space-y-3">
      <Titulo>{t('Cobranças, comprovantes e recibos')}</Titulo>
      <Fonte fonte={fonte} quem={t('o financeiro, a secretaria e o conselho fiscal')}>
        {(lista = []) => (!lista.length ? <Vazio>{t('Nenhuma cobrança para esta filiação.')}</Vazio> : (
          <ul className="space-y-3">{sortChargesForStaff(lista).map((c) => <ChargeRow key={c.id} charge={c} podeDecidir={decide} onRecibo={setRecibo} />)}</ul>
        ))}
      </Fonte>
      {recibo && <FedReceiptDialog open onOpenChange={(v) => !v && setRecibo(null)} charge={recibo} federation={federation} />}
    </section>
  );
}

function Documentos({ documentos, nome, onIrParaAba }) {
  return (
    <section className="space-y-3">
      <Titulo acao={onIrParaAba && <V2Button type="button" size="sm" variant="ghost" onClick={() => onIrParaAba('documentos')}>{t('Todos os documentos')}</V2Button>}>{t('Documentos')}</Titulo>
      {documentos === null ? <p className="rounded-2xl bg-paper px-4 py-3 text-sm text-gray-600">{t('Esta parte da pasta é só para {quem}.', { quem: t('a secretaria') })}</p>
        : documentos === undefined ? <Vazio>{t('Os documentos não carregaram.')}</Vazio>
          : !documentos.length ? <Vazio>{t('Nenhum documento enviado.')}</Vazio>
            : <ul className="space-y-3">{documentos.map((d) => <DocRow key={d.id} docu={d} nome={nome} />)}</ul>}
    </section>
  );
}

function Cursos({ fontes }) {
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <Titulo>{t('Cursos')}</Titulo>
        <Fonte fonte={fontes.inscricoes} quem={t('a equipe de cursos e o financeiro')}>
          {(lista = []) => (!lista.length ? <Vazio>{t('Nenhuma inscrição em curso.')}</Vazio> : (
            <ul className="space-y-2">{[...lista].sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0)).map((e) => (
              <li key={e.id} className="rounded-2xl border border-gray-100 px-4 py-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">{e.course_name || t('Curso')}<V2Badge tone={{ passed: 'green', failed: 'red', cancelled: 'neutral', awaiting_payment: 'amber' }[e.status] || 'blue'}>{t(ENROLLMENT_STATUS_LABELS[e.status] || e.status)}</V2Badge></p>
                <p className="text-xs text-gray-500">{t('inscrição em {data}', { data: quando(e.created_at_ms) })}{e.amount_cents ? ` · ${formatBrlCents(e.amount_cents)}` : ''}{e.grade_note ? ` · ${e.grade_note}` : ''}</p>
              </li>
            ))}</ul>
          ))}
        </Fonte>
      </section>
      <section className="space-y-3">
        <Titulo>{t('Credenciais')}</Titulo>
        <Fonte fonte={fontes.credenciais} quem={t('a equipe de cursos')}>
          {(lista = []) => (!lista.length ? <Vazio>{t('Nenhuma credencial emitida.')}</Vazio> : (
            <ul className="space-y-2">{lista.map((c) => (
              <li key={c.id} className="rounded-2xl border border-gray-100 px-4 py-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink"><Award className="h-4 w-4" aria-hidden="true" />{c.course_name || t('Credencial')}<V2Badge tone={c.status === 'active' ? 'green' : 'neutral'}>{t(CREDENTIAL_STATUS_LABELS[c.status] || c.status)}</V2Badge>{c.public && <V2Badge tone="blue">{t('pública')}</V2Badge>}</p>
                <p className="text-xs text-gray-500">{[c.level, c.code, c.issued_at && t('emitida em {data}', { data: quando(c.issued_at) }), c.valid_until && t('válida até {data}', { data: quando(c.valid_until) })].filter(Boolean).join(' · ')}</p>
              </li>
            ))}</ul>
          ))}
        </Fonte>
      </section>
    </div>
  );
}

function Pontos({ fonte }) {
  return (
    <section className="space-y-3">
      <Titulo>{t('Pontos no ranking oficial')}</Titulo>
      <p className="text-sm text-gray-500">{t('Cada torneio chancelado lança os pontos aqui. O ano fecha em 31 de janeiro do ano seguinte e não muda mais.')}</p>
      <Fonte fonte={fonte} quem={t('a equipe')}>
        {(lista = []) => (!lista.length ? <Vazio>{t('Nenhum ponto lançado ainda.')}</Vazio> : pointsBySeason(lista).map((g) => (
          <div key={g.season} className="space-y-2">
            <p className="font-semibold text-ink">{t('{ano}: {n} pontos', { ano: g.season, n: g.total })}</p>
            <ul className="space-y-1 text-sm">{g.items.map((p) => (
              <li key={p.id} className={`flex flex-wrap items-baseline justify-between gap-2 rounded-xl px-3 py-2 ${p.status === 'cancelled' ? 'bg-paper text-gray-500 line-through' : 'bg-paper'}`}>
                <span>{[p.tournament_name, p.modality_name, p.position ? t('{n}º lugar', { n: p.position }) : null, p.date ? quando(p.date) : null].filter(Boolean).join(' · ')}</span>
                <span className="font-bold">{tn(Number(p.points) || 0, '{n} ponto', '{n} pontos')}</span>
                {p.status === 'cancelled' && <span className="w-full text-xs no-underline">{t('Cancelado: {motivo}', { motivo: t(POINTS_CANCEL_REASON_LABELS[p.cancel_reason] || p.cancel_reason || '') })}</span>}
              </li>
            ))}</ul>
          </div>
        )))}
      </Fonte>
    </section>
  );
}

function Arbitragem({ fontes, federation, onIrParaAba }) {
  const rules = normalizeRefereeRules(federation.referee_rules);
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <Titulo acao={onIrParaAba && <V2Button type="button" size="sm" variant="ghost" onClick={() => onIrParaAba('arbitragem-quadro')}>{t('Abrir o quadro')}</V2Button>}>{t('No quadro de arbitragem')}</Titulo>
        <Fonte fonte={fontes.quadro} quem={t('a equipe de arbitragem')}>
          {(r) => (!r ? <Vazio>{t('Não está no quadro de árbitros. A inclusão é feita em Arbitragem → Quadro.')}</Vazio> : (
            <dl className="grid gap-1 text-sm">
              <Linha rotulo={t('Situação:')}>{t(REFEREE_STATUS_LABELS[r.status] || r.status || '')}</Linha>
              <Linha rotulo={t('Nível:')}>{levelLabel(rules, r.level) || '—'}</Linha>
              {(r.functions || []).length > 0 && <Linha rotulo={t('Funções:')}>{r.functions.map(funcao).join(', ')}</Linha>}
              <Linha rotulo={t('Atuações:')}>{tn(r.stats?.acts || 0, '{n} atuação', '{n} atuações')}{r.stats?.no_show ? ` · ${tn(r.stats.no_show, '{n} ausência', '{n} ausências')}` : ''}{r.stats?.evaluations ? ` · ${t('média {m}', { m: r.stats.avg })}` : ''}</Linha>
            </dl>
          ))}
        </Fonte>
      </section>
      <section className="space-y-3">
        <Titulo acao={onIrParaAba && <V2Button type="button" size="sm" variant="ghost" onClick={() => onIrParaAba('arbitragem')}>{t('Abrir as escalas')}</V2Button>}>{t('Escalas e diárias')}</Titulo>
        <Fonte fonte={fontes.escalas} quem={t('a equipe de arbitragem')}>
          {(lista = []) => (!lista.length ? <Vazio>{t('Nenhuma escala ainda.')}</Vazio> : (
            <ul className="space-y-2">{[...lista].sort((a, b) => String(b.event?.date || '').localeCompare(String(a.event?.date || ''))).map((a) => (
              <li key={a.id} className="rounded-2xl border border-gray-100 px-4 py-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-ink"><CalendarClock className="h-4 w-4" aria-hidden="true" />{a.event?.name}<AssignmentBadge status={a.status} /></p>
                <p className="text-xs text-gray-500">{[funcao(a.function), periodo(a.event), a.amount_cents ? t('diária {v}', { v: formatBrlCents(a.amount_cents) }) : null, a.paid_at_ms ? t('paga em {data}', { data: quando(a.paid_at_ms) }) : null].filter(Boolean).join(' · ')}</p>
              </li>
            ))}</ul>
          ))}
        </Fonte>
      </section>
    </div>
  );
}

function Entidade({ member: mb, fonte, members, federation, onAbrirPasta }) {
  const torneiosQ = useFederationTournaments(federation.id);
  const campo = mb.org_kind === 'arena' ? 'arena_id' : 'club_id';
  const sediados = (torneiosQ.data || []).filter((tt) => tt[campo] === mb.org_id && tt.archived !== true);
  const pagina = mb.org_kind === 'arena' ? `/arenas/${mb.org_id}` : `/clubes/${mb.org_id}`;
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <Titulo acao={mb.org_id && <V2Button asChild size="sm" variant="ghost"><Link to={pagina}><ExternalLink className="h-4 w-4" aria-hidden="true" />{mb.org_kind === 'arena' ? t('Página da arena') : t('Página do clube')}</Link></V2Button>}>
          {mb.org_kind === 'arena' ? t('Gestores da arena') : t('Membros do clube')}
        </Titulo>
        <p className="text-sm text-gray-500">{t('Quem também tem filiação aqui aparece com o vínculo; toque para abrir a pasta da pessoa.')}</p>
        <Fonte fonte={fonte} quem={t('a equipe')}>
          {(lista = []) => {
            const pessoas = orgPeopleWithMembership(lista, members);
            if (!pessoas.length) return <Vazio>{t('Ninguém cadastrado nesta entidade na plataforma.')}</Vazio>;
            return (
              <ul className="divide-y divide-gray-100">{pessoas.map((p) => (
                <li key={p.uid} className="flex flex-wrap items-center gap-3 py-2">
                  <V2Avatar name={p.name} photoUrl={p.photo} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{p.name || t('Sem nome')}</p>
                    <p className="text-xs text-gray-500">{p.role ? `${p.role} · ` : ''}{p.member ? t('{vinculo} · {plano}', { vinculo: t(PLAN_TIER_LABELS[memberBond(p.member)]), plano: p.member.plan_name || '' }) : t('Sem vínculo com a federação')}</p>
                  </div>
                  {p.member && <V2Button type="button" size="sm" variant="ghost" onClick={() => onAbrirPasta(p.member.id)}>{t('Abrir pasta')}</V2Button>}
                </li>
              ))}</ul>
            );
          }}
        </Fonte>
      </section>
      <section className="space-y-3">
        <Titulo>{mb.org_kind === 'arena' ? t('Torneios sediados') : t('Torneios do clube')}</Titulo>
        {torneiosQ.isError ? <V2ErrorState inline title={t('Os torneios não carregaram')} onRetry={() => torneiosQ.refetch()} />
          : torneiosQ.isLoading ? <V2Skeleton lines={2} />
            : !sediados.length ? <Vazio>{t('Nenhum torneio da federação ligado a esta entidade.')}</Vazio>
              : <ul className="space-y-2">{sediados.map((tt) => <li key={tt.id}><Link to={`/torneios/${tt.id}`} className="block rounded-2xl border border-gray-100 px-4 py-3 text-sm hover:border-ink"><span className="font-semibold text-ink">{tt.name}</span><span className="block text-xs text-gray-500">{[tt.starts_at && quando(tt.starts_at), tt.city].filter(Boolean).join(' · ')}</span></Link></li>)}</ul>}
      </section>
    </div>
  );
}

function Sancoes({ fonte, onIrParaAba }) {
  return (
    <section className="space-y-3">
      <Titulo acao={onIrParaAba && <V2Button type="button" size="sm" variant="ghost" onClick={() => onIrParaAba('sancoes')}>{t('Abrir a Disciplina')}</V2Button>}>{t('Sanções')}</Titulo>
      <Fonte fonte={fonte} quem={t('a disciplina')}>
        {(lista = []) => (!lista.length ? <Vazio>{t('Nenhuma sanção registrada.')}</Vazio> : (
          <ul className="space-y-2">{[...lista].sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0)).map((s) => (
            <li key={s.id} className="rounded-2xl border border-gray-100 px-4 py-3 text-sm">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">{t(DISCIPLINE_KIND_LABELS[s.kind] || s.kind)}<V2Badge tone={s.status === 'active' ? 'red' : s.status === 'appealed' ? 'amber' : 'neutral'}>{t(DISCIPLINE_STATUS_LABELS[s.status] || s.status)}</V2Badge></p>
              <p className="text-xs text-gray-500">{[quando(s.created_at_ms), s.starts_at && s.ends_at ? t('de {ini} a {fim}', { ini: quando(s.starts_at), fim: quando(s.ends_at) }) : null, s.fine_cents ? formatBrlCents(s.fine_cents) : null, s.tournament_name].filter(Boolean).join(' · ')}</p>
              {s.reason && <p className="mt-1 text-gray-700">{s.reason}</p>}
            </li>
          ))}</ul>
        ))}
      </Fonte>
    </section>
  );
}

function Historico({ member: mb, fontes, documentos, transfers }) {
  const lido = (f) => (f.permitido && f.data ? f.data : undefined);
  const eventos = memberTimeline(mb, {
    charges: lido(fontes.cobrancas), documents: documentos || undefined, transfers, sanctions: lido(fontes.sancoes),
    enrollments: lido(fontes.inscricoes), credentials: lido(fontes.credenciais), points: lido(fontes.pontos), assignments: lido(fontes.escalas),
  });
  return (
    <div className="space-y-5">
      {transfers && transfers.length > 0 && (
        <section className="space-y-2">
          <Titulo>{t('Transferências')}</Titulo>
          <ul className="space-y-2">{transfers.map((tr) => (
            <li key={tr.id} className="rounded-2xl border border-gray-100 px-4 py-3 text-sm">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">{t(TRANSFER_KIND_LABELS[tr.kind] || tr.kind)}<V2Badge tone={{ pending: 'amber', approved: 'green', rejected: 'red' }[tr.status] || 'neutral'}>{t(TRANSFER_STATUS_LABELS[tr.status] || tr.status)}</V2Badge></p>
              <p className="text-xs text-gray-500">{transferSummary(tr)} · {t('pedida em {data}', { data: quando(tr.requested_at) })}</p>
            </li>
          ))}</ul>
        </section>
      )}
      <section className="space-y-2">
        <Titulo>{t('Linha do tempo')}</Titulo>
        <p className="text-sm text-gray-500">{t('Só entra o que você pode ver: partes da pasta reservadas a outra função ficam de fora.')}</p>
        {!eventos.length ? <Vazio>{t('Nada registrado ainda.')}</Vazio> : (
          <ol className="space-y-2 border-l-2 border-gray-100 pl-4">
            {eventos.map((e, i) => <li key={`${e.at}${i}`} className="text-sm"><span className="block text-xs text-gray-500">{quando(e.at)}</span><span className="text-ink">{e.text}</span></li>)}
          </ol>
        )}
      </section>
    </div>
  );
}

/* --------------------------------------------------------------- pasta -- */

/**
 * @param {object} props
 * @param {object} props.federation
 * @param {object} props.member a filiação aberta
 * @param {object[]} props.members todas as filiações (cruza as pessoas da entidade)
 * @param {object} [props.documentsQ] documentos da federação (secretaria)
 * @param {object} [props.transfersQ] transferências (secretaria)
 * @param {string[]} props.perms permissões de quem vê
 * @param {(aba: string) => void} [props.onIrParaAba]
 * @param {(memberId: string|null) => void} props.onAbrirPasta
 */
export default function FedMemberFolder({ federation, member: mb, members = [], documentsQ, transfersQ, perms = [], onIrParaAba, onAbrirPasta }) {
  const { catalog } = useFederationPlatformSettings();
  const type = memberTypeOf(catalog, mb);
  const org = isOrgMember(mb);
  const fontes = useMemberFolder(federation, mb, perms);
  const [bloco, setBloco] = useState('resumo');
  const podeDocs = perms.includes(FED_PERMISSION.MEMBERS) || perms.includes(FED_PERMISSION.ADMIN);
  // null = sem permissão; undefined = não carregou; [] = leu e não há.
  const documentos = useMemo(() => {
    if (!podeDocs) return null;
    if (!documentsQ?.isSuccess) return undefined;
    return documentsQ.data.filter((d) => d.member_id === mb.id).sort((a, b) => (b.created_at_ms || 0) - (a.created_at_ms || 0));
  }, [podeDocs, documentsQ?.isSuccess, documentsQ?.data, mb.id]);
  const transfers = transfersQ?.isSuccess ? transfersQ.data.filter((tr) => tr.member_id === mb.id || (mb.user_id && tr.user_id === mb.user_id)) : undefined;
  const blocos = folderBlocks(mb, type, { hasPoints: (fontes.pontos.data || []).length > 0, rostered: Boolean(fontes.quadro.data) })
    .filter((b) => !MODULO_DO_BLOCO[b] || fedModuleOn(federation, MODULO_DO_BLOCO[b]));
  const ativo = blocos.includes(bloco) ? bloco : 'resumo';
  const st = membershipState(mb);
  const nome = mb.org_name || mb.user_name;
  const [params] = useSearchParams();
  const semPasta = new URLSearchParams(params);
  semPasta.delete('pasta');

  return (
    <section className="space-y-4" aria-label={t('Pasta de {nome}', { nome })} data-dica="federacao-pasta">
      <V2BackLink to={{ search: `?${semPasta}` }}>{t('Voltar à lista')}</V2BackLink>
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <div className="flex flex-wrap items-start gap-3">
          <V2Avatar name={nome} photoUrl={mb.photo_url || mb.org_logo} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-2 font-display text-xl font-bold text-ink">{nome}<MemberStatusBadge status={st.status} label={st.label} /></h2>
            <p className="text-sm text-gray-500">{[memberTypeName(type), t(PLAN_TIER_LABELS[memberBond(mb)]), mb.plan_name, mb.member_number].filter(Boolean).join(' · ')}</p>
            {mb.user_id && !org && <Link to={`/atleta/${mb.user_id}`} className="text-xs font-semibold text-ink underline underline-offset-2">{t('Perfil na plataforma')}</Link>}
          </div>
        </div>
        <MemberActions member={mb} federation={federation} pedido={mb.status === MEMBER_STATUS.PENDING} />
      </V2Surface>
      <V2SubTabs ariaLabel={t('Partes da pasta')} tabs={blocos.map((b) => ({ value: b, label: t(BLOCO_META[b].label), icon: BLOCO_META[b].icon }))} activeValue={ativo} onSelect={(x) => setBloco(x.value)} />
      <V2Surface variant="compacto" className="p-4">
        {ativo === 'resumo' && <Resumo member={mb} type={type} fontes={fontes} documentos={documentos} perms={perms} org={org} />}
        {ativo === 'cobrancas' && <Cobrancas fonte={fontes.cobrancas} perms={perms} federation={federation} />}
        {ativo === 'documentos' && <Documentos documentos={documentos} nome={nome} onIrParaAba={onIrParaAba} />}
        {ativo === 'cursos' && <Cursos fontes={fontes} />}
        {ativo === 'pontos' && <Pontos fonte={fontes.pontos} />}
        {ativo === 'arbitragem' && <Arbitragem fontes={fontes} federation={federation} onIrParaAba={onIrParaAba} />}
        {ativo === 'entidade' && <Entidade member={mb} fonte={fontes.pessoas} members={members} federation={federation} onAbrirPasta={onAbrirPasta} />}
        {ativo === 'sancoes' && <Sancoes fonte={fontes.sancoes} onIrParaAba={onIrParaAba} />}
        {ativo === 'historico' && <Historico member={mb} fontes={fontes} documentos={documentos} transfers={transfers} />}
      </V2Surface>
    </section>
  );
}
