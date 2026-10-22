/**
 * Os blocos PÚBLICOS dos módulos da federação (PR 2) — a MESMA leitura na
 * página dentro do app (`/federacoes/:id`) e na pública (`/f/:slug`):
 *  - `FedAffiliatesSection`: clubes e arenas filiados (módulo `affiliations`);
 *  - `FedSanctionedTournaments`: torneios chancelados (módulo `tournaments`);
 *  - `FedRankingBlock`: o ranking oficial da temporada (módulo `ranking`),
 *    gravado pelo servidor — a tela só lê, filtra por classe e pagina.
 * Cada bloco só monta com o módulo ligado (`fedModuleOn`) e diz quando a
 * leitura falhou (`docs/27-FALHA-NAO-E-VAZIO.md`).
 */
import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Building2, GraduationCap, Landmark, Medal, MessageSquareWarning, Trophy, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/core/lib/FirebaseAuthContext';
import { fedModuleOn } from '@/modules/federations/domain/federation';
import { approvedAffiliations } from '@/modules/federations/domain/affiliations';
import { splitSanctionedTournaments } from '@/modules/federations/domain/sanction';
import { tournamentPath } from '@/modules/federations/domain/agenda';
import { todayISO } from '@/modules/arenas/domain/calendar';
import { canCancelEnrollment, courseState, credentialState, seatsLeft, sortCourses } from '@/modules/federations/domain/courses';
import { protocolToId, reportProtocol, validateReportInput } from '@/modules/federations/domain/discipline';
import { formatBrlCents } from '@/modules/federations/domain/charges';
import { verifyPath } from '@/modules/federations/domain/card';
import { COURSE_KIND_LABELS, ENROLLMENT_STATUS, ENROLLMENT_STATUS_LABELS, REPORT_KIND, REPORT_KIND_LABELS, REPORT_MAX_CHARS, REPORT_STATUS_LABELS, SANCTION_TIER_LABELS } from '@/modules/federations/domain/constants';
import { courseAction, createReport } from '@/modules/federations/services/federationService';
import { useApprovedAffiliations, useFederationMutation, useFederationRanking, useFederationTournaments, useMyEnrollments, usePublicCourses, usePublicCredentials, useReport } from '@/modules/federations/hooks/useFederations';
import { AGE_CATEGORY_LABELS, GENDER_CATEGORY_LABELS, MODALITY_FORMAT_LABELS } from '@/modules/tournament/domain/constants';
import { V2Avatar, V2Badge, V2Button, V2ErrorState, V2Field, V2Input, V2Select, V2Skeleton, V2Surface, V2Textarea, V2Toggle } from '@/v2/ui/primitives';
import { fmtData, t, tn } from '@/core/i18n';

/* ------------------------------------------------------- filiados (orgs) -- */

/**
 * Para onde leva o clube/arena filiado. Sem conta, o app inteiro manda para o
 * login: o clube abre a página pública (`/c/:id`) e a arena, que não tem
 * página pública, fica só com o nome.
 */
export const orgLink = (aff, { logado = false } = {}) => {
  if (aff.kind === 'club') return logado ? `/clubes/${aff.org_id}` : `/c/${aff.org_id}`;
  return logado ? `/arenas/${aff.org_id}` : null;
};

const CARTAO_ORG = 'flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3';

function OrgCard({ aff, logado }) {
  const to = orgLink(aff, { logado });
  const Icone = aff.kind === 'club' ? Users : Building2;
  const miolo = (
    <>
      {aff.org_logo ? <img src={aff.org_logo} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" loading="lazy" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper text-gray-500"><Icone className="h-5 w-5" aria-hidden="true" /></span>}
      <span className="min-w-0">
        <span className="block truncate font-semibold text-ink">{aff.org_name}</span>
        <span className="block truncate text-xs text-gray-500">{[aff.org_city, aff.org_state].filter(Boolean).join(' · ') || (aff.kind === 'club' ? t('Clube') : t('Arena'))}</span>
      </span>
    </>
  );
  return (
    <li>
      {to
        ? <Link to={to} className={`${CARTAO_ORG} transition-colors hover:border-acid/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30`}>{miolo}</Link>
        : <div className={CARTAO_ORG}>{miolo}</div>}
    </li>
  );
}

/** Clubes e arenas filiados (só os aprovados — a consulta é pública). */
export function FedAffiliatesSection({ federation, titulo = true }) {
  const ligado = fedModuleOn(federation, 'affiliations');
  const { isAuthenticated } = useAuth();
  const logado = Boolean(isAuthenticated);
  const q = useApprovedAffiliations(federation?.id, { enabled: ligado });
  if (!ligado) return null;
  const grupos = q.isSuccess ? approvedAffiliations(q.data) : null;
  return (
    <section aria-labelledby="fed-filiados-orgs" className="space-y-3" data-dica="federacao-filiados-orgs">
      {titulo && <h2 id="fed-filiados-orgs" className="font-display text-xl font-bold text-ink">{t('Clubes e arenas filiados')}</h2>}
      {q.isError && <V2ErrorState inline title={t('Não carregaram os filiados')} onRetry={() => q.refetch()} />}
      {q.isLoading && <V2Skeleton lines={2} />}
      {grupos && grupos.clubs.length + grupos.arenas.length === 0 && <p className="text-sm text-gray-500">{t('Ainda não há clube ou arena filiado. Quem administra um clube ou uma arena pede a filiação na gestão dele, na parte Federação.')}</p>}
      {grupos && grupos.clubs.length > 0 && (
        <div>
          <p className="mb-2 text-2xs font-bold uppercase tracking-widest text-gray-500">{tn(grupos.clubs.length, '{n} clube', '{n} clubes')}</p>
          <ul className="grid gap-2 sm:grid-cols-2">{grupos.clubs.map((a) => <OrgCard key={a.id} aff={a} logado={logado} />)}</ul>
        </div>
      )}
      {grupos && grupos.arenas.length > 0 && (
        <div>
          <p className="mb-2 text-2xs font-bold uppercase tracking-widest text-gray-500">{tn(grupos.arenas.length, '{n} arena', '{n} arenas')}</p>
          <ul className="grid gap-2 sm:grid-cols-2">{grupos.arenas.map((a) => <OrgCard key={a.id} aff={a} logado={logado} />)}</ul>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------- torneios chancelados -- */

/** "05 nov." — com o ano quando não é o corrente ("05 nov. 2027" numa lista de vários anos é o que evita engano). */
const dataCurta = (iso) => {
  const d = new Date(String(iso || '').slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return '';
  const outroAno = d.getFullYear() !== new Date().getFullYear();
  return fmtData(d, outroAno ? { day: '2-digit', month: 'short', year: 'numeric' } : { day: '2-digit', month: 'short' });
};

function TorneioItem({ tt, logado }) {
  return (
    <li>
      <Link to={tournamentPath(tt.id, { inApp: logado })} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 transition-colors hover:border-acid/60 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-acid/30">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-paper text-gray-500"><Trophy className="h-5 w-5" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{tt.name}</span>
          <span className="block truncate text-xs text-gray-500">{[dataCurta(tt.starts_at), tt.city || tt.location, t(SANCTION_TIER_LABELS[tt.federation_sanction?.tier] || SANCTION_TIER_LABELS.regional)].filter(Boolean).join(' · ')}</span>
        </span>
        {tt.federation_sanction?.requires_membership && <V2Badge tone="amber">{t('Só filiados')}</V2Badge>}
      </Link>
    </li>
  );
}

/**
 * Os torneios chancelados: os que vêm (do mais próximo) e, atrás de um botão,
 * os encerrados. Nada some calado — passou do limite, "Ver todos".
 */
export function FedSanctionedTournaments({ federation, limite = 12, titulo = true }) {
  const ligado = fedModuleOn(federation, 'tournaments');
  const { isAuthenticated } = useAuth();
  const logado = Boolean(isAuthenticated);
  const [max, setMax] = useState(limite);
  const [verEncerrados, setVerEncerrados] = useState(false);
  const q = useFederationTournaments(federation?.id, { enabled: ligado });
  if (!ligado) return null;
  const grupos = q.isSuccess ? splitSanctionedTournaments(q.data, todayISO()) : null;
  const total = grupos ? grupos.proximos.length + grupos.encerrados.length : 0;
  return (
    <section aria-labelledby="fed-torneios" className="space-y-3" data-dica="federacao-torneios-chancelados">
      {titulo && <h2 id="fed-torneios" className="font-display text-xl font-bold text-ink">{t('Torneios chancelados')}</h2>}
      {q.isError && <V2ErrorState inline title={t('Não carregaram os torneios')} onRetry={() => q.refetch()} />}
      {q.isLoading && <V2Skeleton lines={2} />}
      {grupos && total === 0 && <p className="text-sm text-gray-500">{t('Ainda não há torneio chancelado por esta federação.')}</p>}
      {grupos && total > 0 && grupos.proximos.length === 0 && <p className="text-sm text-gray-500">{t('Nenhum torneio chancelado marcado para os próximos dias.')}</p>}
      {grupos && grupos.proximos.length > 0 && (
        <>
          <ul className="grid gap-2 sm:grid-cols-2">{grupos.proximos.slice(0, max).map((tt) => <TorneioItem key={tt.id} tt={tt} logado={logado} />)}</ul>
          {grupos.proximos.length > max && <V2Button type="button" variant="ghost" size="sm" onClick={() => setMax(grupos.proximos.length)}>{t('Ver todos ({n})', { n: grupos.proximos.length })}</V2Button>}
        </>
      )}
      {grupos && grupos.encerrados.length > 0 && (
        verEncerrados ? (
          <div className="space-y-2">
            <p className="text-2xs font-bold uppercase tracking-widest text-gray-500">{t('Encerrados')}</p>
            <ul className="grid gap-2 sm:grid-cols-2">{grupos.encerrados.map((tt) => <TorneioItem key={tt.id} tt={tt} logado={logado} />)}</ul>
          </div>
        ) : <V2Button type="button" variant="ghost" size="sm" onClick={() => setVerEncerrados(true)} aria-expanded={false}>{tn(grupos.encerrados.length, 'Ver {n} torneio encerrado', 'Ver {n} torneios encerrados')}</V2Button>
      )}
    </section>
  );
}

/* ------------------------------------------------------- ranking oficial -- */

export const classeLabel = (c) => [GENDER_CATEGORY_LABELS[c.gender_category] || c.gender_category, AGE_CATEGORY_LABELS[c.age_category] || c.age_category, MODALITY_FORMAT_LABELS[c.format] || c.format].filter(Boolean).join(' · ');

function Linha({ l, destaque }) {
  return (
    <li className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${destaque ? 'bg-acid/15' : 'odd:bg-paper/60'}`}>
      <span className="w-8 shrink-0 text-center font-display text-lg font-bold text-ink">{l.position}º</span>
      <V2Avatar name={l.name} photoUrl={l.photo_url} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{l.name || t('Atleta')}</span>
        <span className="block text-xs text-gray-500">{tn(l.events, '{n} torneio', '{n} torneios')}{l.titles ? ` · ${tn(l.titles, '{n} título', '{n} títulos')}` : ''}</span>
      </span>
      <span className="font-display text-lg font-bold text-ink">{l.points}</span>
    </li>
  );
}

/**
 * O ranking oficial da temporada. `meUid` destaca a linha da pessoa.
 * `anos`: as temporadas oferecidas (padrão: este ano e o anterior).
 */
export function FedRankingBlock({ federation, meUid = null, titulo = true, compacto = false }) {
  const ligado = fedModuleOn(federation, 'ranking');
  const anoAtual = new Date().getFullYear();
  const [season, setSeason] = useState(anoAtual);
  const [classe, setClasse] = useState('geral');
  const [limite, setLimite] = useState(compacto ? 10 : 25);
  const q = useFederationRanking(federation?.id, season, { enabled: ligado });
  const dados = q.isSuccess ? q.data : null;
  const linhas = useMemo(() => {
    if (!dados) return [];
    if (classe === 'geral') return dados.general || [];
    return (dados.categories || []).find((c) => c.key === classe)?.rows || [];
  }, [dados, classe]);
  if (!ligado) return null;
  return (
    <section aria-labelledby="fed-ranking" className="space-y-3" data-dica="federacao-ranking-oficial">
      <div className="flex flex-wrap items-end justify-between gap-3">
        {titulo && <h2 id="fed-ranking" className="font-display text-xl font-bold text-ink">{t('Ranking oficial')}</h2>}
        <div className="flex flex-wrap gap-2">
          <V2Select aria-label={t('Temporada')} className="h-10 w-28" value={season} onChange={(e) => setSeason(Number(e.target.value))} options={[anoAtual, anoAtual - 1, anoAtual - 2].map((a) => ({ value: a, label: String(a) }))} />
          <V2Select aria-label={t('Classe')} className="h-10 min-w-40" value={classe} onChange={(e) => setClasse(e.target.value)} options={[{ value: 'geral', label: t('Geral') }, ...(dados?.categories || []).map((c) => ({ value: c.key, label: classeLabel(c) }))]} />
        </div>
      </div>
      {q.isError && <V2ErrorState inline title={t('Não carregou o ranking')} onRetry={() => q.refetch()} />}
      {q.isLoading && <V2Skeleton lines={4} />}
      {q.isSuccess && !dados && <V2Surface variant="compacto" className="flex items-center gap-3 p-4 text-sm text-gray-600"><Medal className="h-5 w-5 text-gray-500" aria-hidden="true" />{t('A temporada {ano} ainda não tem resultado enviado. O ranking nasce quando o organizador de um torneio chancelado envia o resultado de uma categoria.', { ano: season })}</V2Surface>}
      {dados && linhas.length === 0 && <p className="text-sm text-gray-500">{t('Ninguém pontuou nesta classe ainda.')}</p>}
      {dados && linhas.length > 0 && (
        <>
          <ol className="space-y-1">{linhas.slice(0, limite).map((l) => <Linha key={l.uid} l={l} destaque={meUid && l.uid === meUid} />)}</ol>
          {linhas.length > limite && <V2Button type="button" variant="ghost" size="sm" onClick={() => setLimite((n) => n + 25)}>{t('Ver mais ({n} de {total})', { n: limite, total: linhas.length })}</V2Button>}
          <p className="text-xs text-gray-500">
            {t('Atualizado em {data}.', { data: dados.updated_at_ms ? fmtData(new Date(dados.updated_at_ms), { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—' })}
            {' '}{dados.config?.members_only === false ? '' : t('Pontuam só os filiados em dia na data do torneio.')}
            {' '}{dados.config?.best_n ? t('Contam os {n} melhores resultados de cada classe.', { n: dados.config.best_n }) : t('Contam todos os resultados de cada classe.')}
            {dados.config?.members_only === false ? ` ${t('Nesta federação todo mundo pontua, filiado ou não.')}` : ''}
          </p>
        </>
      )}
      {!q.isLoading && !q.isError && <p className="flex items-center gap-1 text-xs text-gray-500"><Landmark className="h-3.5 w-3.5" aria-hidden="true" />{t('Ranking oficial da {sigla}: soma só torneios chancelados por ela. O ranking da plataforma segue à parte.', { sigla: federation?.acronym || federation?.name })}</p>}
    </section>
  );
}

/* ---------------------------------------------- PR 3: cursos, credenciados, ouvidoria -- */

/**
 * Os cursos com inscrição aberta (e os já realizados) — módulo `courses`.
 * Logado, a pessoa se inscreve aqui (o servidor confere vaga, filiação e
 * preço); sem conta, entra para se inscrever.
 */
export function FedCoursesSection({ federation, titulo = true }) {
  const ligado = fedModuleOn(federation, 'courses');
  const { isAuthenticated, user } = useAuth();
  const q = usePublicCourses(federation?.id, { enabled: ligado });
  const eq = useMyEnrollments({ enabled: ligado && isAuthenticated });
  const m = useFederationMutation((payload) => courseAction(payload));
  if (!ligado) return null;
  const cursos = q.isSuccess ? sortCourses(q.data) : null;
  const minha = (courseId) => (eq.data || []).find((e) => e.course_id === courseId && e.status !== ENROLLMENT_STATUS.CANCELLED) || null;
  const agir = (payload, msg) => m.mutate(payload, { onSuccess: () => toast.success(msg), onError: (e) => toast.error(e.message) });
  return (
    <section aria-labelledby="fed-cursos" className="space-y-3" data-dica="federacao-cursos-publicos">
      {titulo && <h2 id="fed-cursos" className="font-display text-xl font-bold text-ink">{t('Cursos e clínicas')}</h2>}
      {q.isError && <V2ErrorState inline title={t('Não carregaram os cursos')} onRetry={() => q.refetch()} />}
      {q.isLoading && <V2Skeleton lines={2} />}
      {cursos && cursos.length === 0 && <p className="text-sm text-gray-500">{t('Nenhum curso publicado ainda.')}</p>}
      {cursos && cursos.length > 0 && (
        <ul className="space-y-2">
          {cursos.map((c) => {
            const st = courseState(c);
            const en = isAuthenticated ? minha(c.id) : null;
            const vagas = seatsLeft(c);
            return (
              <li key={c.id}>
                <V2Surface variant="compacto" className="flex flex-wrap items-center gap-3 p-4">
                  <GraduationCap className="h-5 w-5 shrink-0 text-gray-500" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-bold text-ink">{c.name}<V2Badge tone={st.open ? 'green' : 'neutral'}>{st.label}</V2Badge>{c.requires_membership && <V2Badge tone="ink">{t('só filiados')}</V2Badge>}{c.issues_credential && <V2Badge tone="ink">{t('emite credencial')}</V2Badge>}</p>
                    <p className="text-xs text-gray-500">{t(COURSE_KIND_LABELS[c.kind] || COURSE_KIND_LABELS.clinic)}{c.level ? ` · ${c.level}` : ''} · {dataCurta(c.starts_at)}{c.ends_at && c.ends_at !== c.starts_at ? ` – ${dataCurta(c.ends_at)}` : ''}{c.online ? ` · ${t('on-line')}` : c.place ? ` · ${c.place}` : ''}{c.hours ? ` · ${tn(c.hours, '{n} hora', '{n} horas')}` : ''}</p>
                    <p className="text-xs text-gray-700">{c.price_cents > 0 ? `${formatBrlCents(c.price_cents)}${c.member_price_cents != null && c.member_price_cents < c.price_cents ? ` · ${t('filiado: {valor}', { valor: formatBrlCents(c.member_price_cents) })}` : ''}` : t('Grátis')}{vagas != null ? ` · ${tn(vagas, '{n} vaga', '{n} vagas')}` : ''}{c.instructors ? ` · ${c.instructors}` : ''}</p>
                    {c.description && <p className="mt-1 text-sm text-gray-600">{c.description}</p>}
                  </div>
                  {en ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <V2Badge tone={{ awaiting_payment: 'amber', confirmed: 'green', passed: 'green', failed: 'red' }[en.status] || 'neutral'}>{t(ENROLLMENT_STATUS_LABELS[en.status] || en.status)}</V2Badge>
                      {en.status === ENROLLMENT_STATUS.AWAITING_PAYMENT && <V2Button asChild size="sm" variant="secondary"><Link to="/perfil?secao=federacoes">{t('Pagar')}</Link></V2Button>}
                      {canCancelEnrollment(en, c) && <V2Button type="button" size="sm" variant="ghost" disabled={m.isPending} onClick={() => agir({ action: 'cancel', courseId: c.id }, t('Inscrição cancelada.'))}>{t('Cancelar inscrição')}</V2Button>}
                    </div>
                  ) : st.open ? (
                    isAuthenticated
                      ? <V2Button type="button" size="sm" disabled={m.isPending || !eq.isSuccess} onClick={() => agir({ action: 'enroll', courseId: c.id }, c.price_cents > 0 ? t('Inscrição feita. Pague o Pix em Minha área → Federações.') : t('Inscrição confirmada.'))} data-dica="federacao-curso-inscrever">{t('Inscrever-se')}</V2Button>
                      : <V2Button asChild size="sm"><Link to={`/login?next=${encodeURIComponent(`/federacoes/${federation.id}`)}`}>{t('Entrar para se inscrever')}</Link></V2Button>
                  ) : null}
                </V2Surface>
              </li>
            );
          })}
        </ul>
      )}
      {eq.isError && <V2ErrorState inline title={t('Não carregaram as suas inscrições')} onRetry={() => eq.refetch()} />}
      {user && cursos && cursos.length > 0 && <p className="text-xs text-gray-500">{t('Aprovado em curso que emite credencial, você recebe a credencial da federação, com código verificável, na Minha área.')}</p>}
    </section>
  );
}

/** O diretório PÚBLICO de credenciados: só quem marcou "aparecer", válidas. */
export function FedCredentialsDirectory({ federation, titulo = true }) {
  const ligado = fedModuleOn(federation, 'courses');
  const q = usePublicCredentials(federation?.id, { enabled: ligado });
  if (!ligado) return null;
  const lista = q.isSuccess ? (q.data || []).filter((c) => credentialState(c).valid).sort((a, b) => String(a.user_name).localeCompare(String(b.user_name))) : null;
  if (q.isSuccess && !lista.length) return null;
  return (
    <section aria-labelledby="fed-credenciados" className="space-y-3" data-dica="federacao-credenciados">
      {titulo && <h2 id="fed-credenciados" className="font-display text-xl font-bold text-ink">{t('Credenciados')}</h2>}
      {q.isError && <V2ErrorState inline title={t('Não carregaram os credenciados')} onRetry={() => q.refetch()} />}
      {q.isLoading && <V2Skeleton lines={2} />}
      {lista && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {lista.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-paper-pure p-3">
              <V2Avatar name={c.user_name} photoUrl={c.public_photo === false ? '' : c.photo_url} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{c.user_name}</p>
                <p className="text-xs text-gray-500">{t(COURSE_KIND_LABELS[c.kind] || COURSE_KIND_LABELS.clinic)}{c.level ? ` · ${c.level}` : ''}{c.valid_until ? ` · ${t('até {data}', { data: dataCurta(c.valid_until) })}` : ''}</p>
              </div>
              <Link to={verifyPath(c.code)} className="text-xs font-semibold text-ink underline">{t('Verificar')}</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * A ouvidoria pública (módulo `discipline`): abrir uma manifestação (anônima
 * ou identificada; precisa de conta, para a regra barrar robô) e acompanhar
 * pelo protocolo. Quem enviou vê só o ESTADO; as anotações são da federação.
 */
export function FedOmbudsmanBlock({ federation, titulo = true }) {
  const ligado = fedModuleOn(federation, 'discipline');
  const { isAuthenticated, user } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [protocolo, setProtocolo] = useState('');
  const [consulta, setConsulta] = useState('');
  const rq = useReport(consulta, { enabled: Boolean(consulta) && isAuthenticated });
  if (!ligado) return null;
  const buscar = (e) => { e.preventDefault(); const id = protocolToId(protocolo); if (!id) { toast.error(t('Protocolo inválido.')); return; } setConsulta(id); };
  return (
    <section aria-labelledby="fed-ouvidoria" className="space-y-3" data-dica="federacao-ouvidoria-publica">
      {titulo && <h2 id="fed-ouvidoria" className="font-display text-xl font-bold text-ink">{t('Ouvidoria')}</h2>}
      <V2Surface variant="compacto" className="space-y-3 p-4">
        <p className="text-sm text-gray-600">{t('Conduta de atleta ou dirigente, arbitragem, organização de torneio: conte à federação. Pode ser anônimo — nem a plataforma guarda quem enviou. Você acompanha pelo protocolo.')}</p>
        <div className="flex flex-wrap items-center gap-2">
          {isAuthenticated
            ? <V2Button type="button" size="sm" onClick={() => setAberto(true)} data-dica="federacao-ouvidoria-abrir"><MessageSquareWarning className="h-4 w-4" />{t('Enviar manifestação')}</V2Button>
            : <V2Button asChild size="sm"><Link to={`/login?next=${encodeURIComponent(`/federacoes/${federation.id}`)}`}>{t('Entrar para enviar')}</Link></V2Button>}
          {isAuthenticated && (
            <form className="flex items-center gap-2" onSubmit={buscar}>
              <V2Input value={protocolo} onChange={(e) => setProtocolo(e.target.value.toUpperCase())} placeholder={t('Protocolo')} aria-label={t('Protocolo da manifestação')} className="h-10 w-48 font-mono uppercase" maxLength={48} />
              <V2Button type="submit" size="sm" variant="secondary">{t('Acompanhar')}</V2Button>
            </form>
          )}
        </div>
        {consulta && rq.isError && <p className="text-sm text-red-600">{t('Protocolo não encontrado, ou ele não é seu.')}</p>}
        {consulta && rq.isSuccess && !rq.data && <p className="text-sm text-red-600">{t('Protocolo não encontrado.')}</p>}
        {consulta && rq.isSuccess && rq.data && (
          <p className="text-sm text-gray-700">{t('Protocolo {p}: {estado}, enviada em {data}.', { p: reportProtocol(rq.data.id), estado: t(REPORT_STATUS_LABELS[rq.data.status] || rq.data.status), data: fmtData(new Date(rq.data.created_at_ms || 0), { day: '2-digit', month: '2-digit', year: 'numeric' }) })}</p>
        )}
      </V2Surface>
      {aberto && <OuvidoriaDialog federation={federation} uid={user?.uid} onClose={() => setAberto(false)} />}
    </section>
  );
}

function OuvidoriaDialog({ federation, uid, onClose }) {
  const [f, setF] = useState({ kind: REPORT_KIND.CONDUCT, body: '', tournament_name: '', anonymous: false });
  const [erros, setErros] = useState({});
  const [enviada, setEnviada] = useState(null);
  const m = useFederationMutation(() => createReport({ federation, uid, input: f }));
  const enviar = (e) => {
    e.preventDefault();
    const r = validateReportInput(f);
    if (!r.ok) { setErros(r.errors); return; }
    m.mutate(undefined, { onSuccess: (rep) => setEnviada(rep), onError: (er) => { setErros(er.fieldErrors || {}); toast.error(er.message); } });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent sheet className="max-w-lg">
        <DialogTitle>{t('Manifestação à ouvidoria da {sigla}', { sigla: federation.acronym || federation.name })}</DialogTitle>
        <DialogDescription>{t('A disciplina da federação recebe e apura. Guarde o protocolo para acompanhar.')}</DialogDescription>
        {enviada ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">{t('Enviada. Seu protocolo:')}</p>
            <p className="font-mono text-lg font-bold text-ink">{reportProtocol(enviada.id)}</p>
            <p className="text-xs text-gray-500">{enviada.anonymous ? t('Anônima: só com o protocolo dá para acompanhar — anote.') : t('Identificada: ela também aparece na sua Minha área → Federações.')}</p>
            <div className="flex justify-end"><V2Button type="button" onClick={onClose}>{t('Fechar')}</V2Button></div>
          </div>
        ) : (
          <form onSubmit={enviar} noValidate className="space-y-4">
            <V2Field label={t('Assunto')} htmlFor="ouv-tipo"><V2Select id="ouv-tipo" value={f.kind} onChange={(e) => setF((x) => ({ ...x, kind: e.target.value }))}>{Object.values(REPORT_KIND).map((k) => <option key={k} value={k}>{t(REPORT_KIND_LABELS[k])}</option>)}</V2Select></V2Field>
            <V2Field label={t('Torneio relacionado (opcional)')} htmlFor="ouv-torneio"><V2Input id="ouv-torneio" maxLength={120} value={f.tournament_name} onChange={(e) => setF((x) => ({ ...x, tournament_name: e.target.value }))} /></V2Field>
            <V2Field label={t('O que aconteceu')} htmlFor="ouv-texto" error={erros.body} required hint={t('Até {n} caracteres. Não inclua dado pessoal de terceiros além do necessário.', { n: REPORT_MAX_CHARS })}><V2Textarea id="ouv-texto" rows={5} maxLength={REPORT_MAX_CHARS} value={f.body} onChange={(e) => { setF((x) => ({ ...x, body: e.target.value })); setErros({}); }} /></V2Field>
            <V2Toggle id="ouv-anon" checked={f.anonymous} onChange={(v) => setF((x) => ({ ...x, anonymous: v }))} label={t('Enviar anonimamente')} hint={t('Nem a federação nem a plataforma saberão quem enviou. Só o protocolo acompanha.')} />
            <div className="flex justify-end gap-2"><V2Button type="button" variant="ghost" onClick={onClose}>{t('Voltar')}</V2Button><V2Button type="submit" disabled={m.isPending}>{t('Enviar')}</V2Button></div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
